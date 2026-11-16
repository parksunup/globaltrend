"""Read-only official law checks. Persist only identifiers, metadata and hashes, never statute bodies."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import copy
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
import os
import subprocess
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MAX_BYTES = 6_000_000
PARSER_VERSION = 1
ROOT = Path(__file__).resolve().parents[2]

def normal(text): return re.sub(r'\s+', ' ', text).strip()
def digest(value): return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def now(): return datetime.now(timezone.utc).isoformat()
def tag(node): return node.tag.rsplit('}', 1)[-1]
def contents(node): return normal(' '.join(node.itertext()))

class SourceError(Exception): pass
class Tree(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': 'root', 'attrs': {}, 'children': [], 'parent': None}
        self.stack = [self.root]
        self.feed(text)
    def handle_starttag(self, name, attrs):
        node = {'tag': name, 'attrs': dict(attrs), 'children': [], 'parent': self.stack[-1]}
        self.stack[-1]['children'].append(node)
        if name not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'): self.stack.append(node)
    def handle_startendtag(self, name, attrs):
        self.handle_starttag(name, attrs)
        if self.stack[-1]['tag'] == name: self.stack.pop()
    def handle_endtag(self, name):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i]['tag'] == name:
                del self.stack[i:]
                break
    def handle_data(self, text): self.stack[-1]['children'].append(text)

def nodes(node):
    yield node
    for child in node['children']:
        if isinstance(child, dict): yield from nodes(child)
def html_text(node):
    if isinstance(node, str): return node
    if node['tag'] in ('script','style','nav','header','footer'): return ''
    sep = '\n' if node['tag'] in ('p','div','section','article','br','h1','h2','h3','h4','li') else ' '
    return sep + sep.join(html_text(c) for c in node['children']) + sep

def chinese_number(value):
    if value.isdigit(): return value
    digits = dict(zip('零〇一二三四五六七八九', [0,0,1,2,3,4,5,6,7,8,9]))
    result = digit = 0
    for c in value:
        if c in digits: digit = digits[c]
        elif c in '十百千': result += (digit or 1) * {'十':10,'百':100,'千':1000}[c]; digit=0
        else: return value
    return str(result+digit)

def parse_source(source, raw, historical=False):
    text = raw.decode('utf-8-sig', errors='strict')
    if not text.strip(): raise SourceError('empty_response')
    if not any(identity.lower() in text.lower() for identity in source['identity']): raise SourceError('identity_not_confirmed')
    articles = {}
    coverage='article_text'
    def add(identifier, body, label=None):
        body=normal(body)
        if len(body)<8: return
        if identifier in articles and articles[identifier]['hash'] != digest(body): raise SourceError('duplicate_article_identity')
        articles[identifier]={'label':label or identifier,'hash':digest(body)}
    parser=source['parser']; version=''; metadata={}
    if parser=='egov':
        data=json.loads(text); info=data.get('revision_info') or {}
        version=str(info.get('law_revision_id') or '')
        metadata={k:info.get(k) for k in ['law_revision_id','amendment_enforcement_date','amendment_promulgate_date','current_revision_status']}
        if not historical and info.get('current_revision_status') not in (None,'CurrentEnforced'): raise SourceError('not_currently_enforced')
        law=data.get('law_full_text')
        if isinstance(law,str) and not law.lstrip().startswith('<'):
            try:law=base64.b64decode(law,validate=True).decode('utf-8')
            except Exception:raise SourceError('unsupported_egov_body') from None
        if not isinstance(law,str) or '<!ENTITY' in law.upper() or '<!DOCTYPE' in law.upper(): raise SourceError('unsupported_egov_body')
        root=ET.fromstring(law)
        for parent in root.iter():
            if tag(parent) not in ('MainProvision','SupplProvision'):continue
            group='main' if tag(parent)=='MainProvision' else 'supplement:'+str(parent.attrib.get('AmendLawNum','original'))
            for article in parent.iter():
                if tag(article)=='Article':add(group+':'+article.attrib.get('Num',''),contents(article),'第'+article.attrib.get('Num','')+'条')
    elif parser=='uk-xml':
        if '<!ENTITY' in text.upper() or '<!DOCTYPE' in text.upper():raise SourceError('unsafe_xml')
        root=ET.fromstring(text)
        for article in root.iter():
            identifier=article.attrib.get('id','')
            if tag(article)=='P1' and re.fullmatch(r'article-\d+[A-Za-z]?',identifier):add('main:'+identifier.removeprefix('article-'),contents(article),identifier)
        # Primary articles are tracked, not inherited EU recitals or every subordinate instrument.
        version='UK GDPR current XML'
    elif parser=='chinese-html':
        data=json.loads(text).get('data') or {}
        coverage='index_and_status_only'
        metadata={k:data.get(k) for k in ['bbbs','gbrq','sxrq','sxx','xfFlag']}
        version=f"{data.get('gbrq','')} / status {data.get('sxx','')}"
        def walk(node):
            title=str(node.get('title',''));m=re.match(r'^第([零〇一二三四五六七八九十百千\d]+)条',title)
            if m:add('main:'+chinese_number(m[1]),'index-only:'+title,'第'+m[1]+'条')
            for child in node.get('children') or []:walk(child)
        walk(data.get('content') or {})
    else:
        tree=Tree(text)
        for node in nodes(tree.root):
            attrs=node['attrs'];identifier=attrs.get('id','')
            if parser=='eu-html':
                m=re.fullmatch(r'art[_-](\d+)',identifier)
                if m:add('main:'+m[1],html_text(node),'Article '+m[1])
            elif parser=='singapore-html' and 'prov1' in attrs.get('class','').split():
                ids=[n['attrs'].get('id','') for n in nodes(node)]
                id_=next((x for x in ids if re.fullmatch(r'pr[\dA-Za-z.]+-',x)), '')
                if id_:add('main:'+id_[2:-1].lower(),html_text(node),'section '+id_[2:-1])
        if parser in ('korean-html','california-html'):
            plain=html_text(tree.root)
            pattern=r'^\s*(제\s*(\d+)\s*조(?:의\s*(\d+))?)[^\n]*' if parser=='korean-html' else r'^\s*((1798\.\d+(?:\.\d+)?)\.)\s*'
            matches=list(re.finditer(pattern,plain,re.M))
            for i,m in enumerate(matches):
                identifier=m[2]+('-'+m[3] if parser=='korean-html' and m[3] else '');add('main:'+identifier,plain[m.start():matches[i+1].start() if i+1<len(matches) else len(plain)],m[1].strip()[:80])
    if len(articles)<source.get('minimumArticles',1):raise SourceError('incomplete_article_structure')
    return {'articles':articles,'metadata':metadata,'version':version,'coverage':coverage,'digest':digest({'articles':articles,'metadata':metadata})}

class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, source): self.hosts=set(source['allowedHosts'])
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl,self.hosts)
        return super().redirect_request(req,fp,code,msg,headers,newurl)
def validate_url(url,hosts):
    u=urllib.parse.urlsplit(url)
    if u.scheme!='https' or u.hostname not in hosts or u.username or u.password or u.port not in (None,443):raise SourceError('unapproved_source_url')
def fetch_source(source,url=None):
    historical=url is not None
    url=url or source['url'];validate_url(url,set(source['allowedHosts']))
    request=urllib.request.Request(urllib.parse.quote(url,safe=':/?=&.%'),headers={'User-Agent':'GlobalTrend-LegalWatch/1.0 (official law change checks)','Accept':'application/json, application/xml, text/html'})
    try:
        with urllib.request.build_opener(OfficialRedirect(source)).open(request,timeout=20) as response:
            if response.status!=200:raise SourceError('http_'+str(response.status))
            raw=response.read(MAX_BYTES+1)
            if len(raw)>MAX_BYTES:raise SourceError('source_too_large')
            return parse_source(source,raw,historical=historical)
    except urllib.error.HTTPError as e:raise SourceError('http_'+str(e.code)) from None
    except (urllib.error.URLError,TimeoutError):raise SourceError('network_unavailable') from None

def compare(before,after):
    a=before['articles'];b=after['articles']
    return {'added':sorted(set(b)-set(a)),'removed':sorted(set(a)-set(b)),'modified':sorted(k for k in set(a)&set(b) if a[k]['hash']!=b[k]['hash']),'metadataChanged':before.get('metadata')!=after.get('metadata')}

def reviewed(event, receipt):
    try:
        datetime.fromisoformat(receipt.get('reviewedAt','').replace('Z','+00:00'))
    except (ValueError,TypeError,AttributeError):return False
    return receipt.get('eventId')==event['id'] and receipt.get('sourceDigest')==event['afterDigest'] and receipt.get('translationReviewed') is True and receipt.get('comparisonReviewed') is True and bool(re.fullmatch(r'[a-f0-9]{40}',str(receipt.get('translationCommitSha',''))))

def check_one(source, previous, reviews, fetcher=fetch_source):
    checked_at=now();config=digest({'url':source['url'],'baselineUrl':source.get('baselineUrl'),'parser':source['parser'],'parserVersion':PARSER_VERSION})
    prior=copy.deepcopy(previous) if previous.get('configHash')==config else {'events':copy.deepcopy(previous.get('events',[])),'baselineOrigin':'configuration_changed' if previous else 'first_observation'}
    result={'id':source['id'],'jurisdiction':source['jurisdiction'],'name':source['name'],'url':source['url'],'scope':source['scope'],'checkedAt':checked_at,'status':'error','error':None,'changes':None,'events':prior.get('events',[]),'baselineOrigin':prior.get('baselineOrigin','first_observation')}
    try:
        current=fetcher(source)
        before=prior.get('snapshot')
        if source.get('baselineUrl') and (not before or prior.get('baselineOrigin')=='selected_edition_unavailable'):
            try:before=fetcher(source,source['baselineUrl']);result['baselineOrigin']='selected_edition'
            except Exception:result['baselineOrigin']='selected_edition_unavailable'
        if before and len(current['articles']) < .7*len(before['articles']):raise SourceError('unexpected_article_loss')
        changes=compare(before,current) if before else {'added':[],'removed':[],'modified':[],'metadataChanged':False}
        has_changes=any(changes[k] for k in ['added','removed','modified','metadataChanged'])
        event=None
        if not prior.get('snapshot') or has_changes:
            kind='source_changed' if has_changes else 'baseline_review'
            event={'id':digest([source['id'],config,before.get('digest') if before else None,current['digest'],kind]),'kind':kind,'createdAt':checked_at,'beforeDigest':before.get('digest') if before else None,'afterDigest':current['digest'],'changes':changes,'reviewed':False,'sourceUrl':source['url']}
        events=copy.deepcopy(prior.get('events',[]))
        if event and not any(e['id']==event['id'] for e in events):events.append(event)
        if len(events)>1000:raise SourceError('review_queue_limit')
        for e in events:
            e['reviewed']=any(reviewed(e,r) for r in reviews)
        result.update(coverage=current.get('coverage','article_text'),status='partial' if current.get('coverage')!='article_text' else 'changed' if has_changes else 'unchanged' if prior.get('snapshot') else 'baseline',version=current['version'],articleCount=len(current['articles']),digest=current['digest'],changes=changes,events=events,lastSuccessAt=checked_at)
        checkpoint={'configHash':config,'snapshot':current,'events':events,'baselineOrigin':result['baselineOrigin'],'lastSuccessAt':checked_at}
        return result,checkpoint
    except (SourceError,ValueError,ET.ParseError,UnicodeError,KeyError,TypeError) as error:
        result['error']=str(error) if isinstance(error,SourceError) else 'unrecognized_source_format'
    except Exception:result['error']='source_check_failed'
    result['lastSuccessAt']=prior.get('lastSuccessAt');return result,prior

def run(config, previous, reviews, fetcher=fetch_source):
    sources=config['sources']
    if len({s['id'] for s in sources})!=len(sources):raise ValueError('duplicate source ID')
    def task(s):return check_one(s,previous.get('sources',{}).get(s['id'],{}),reviews.get('reviews',[]),fetcher)
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(task,sources))
    report={'schemaVersion':1,'generatedAt':now(),'sourceCommit':config.get('sourceCommit',''),'laws':[r for r,_ in results]}
    checkpoint={'schemaVersion':1,'sources':{s['id']:c for s,(_,c) in zip(sources,results)}}
    return report,checkpoint

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--previous');p.add_argument('--out',default='.legal-watch');p.add_argument('--config',default='config/legal-watch/sources.json');args=p.parse_args()
    config=json.loads(Path(args.config).read_text());config['sourceCommit']=os.environ.get('GITHUB_SHA') or subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();previous=json.loads(Path(args.previous).read_text()) if args.previous and Path(args.previous).exists() else {}
    seed=ROOT/'data/legal-watch/initial-checkpoint.json'
    if not previous and seed.exists():previous=json.loads(seed.read_text())
    reviews=json.loads((ROOT/'config/legal-watch/reviews.json').read_text());report,checkpoint=run(config,previous,reviews)
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    for name,data in [('report.json',report),('checkpoint.json',checkpoint)]: (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    counts={k:sum(l['status']==k for l in report['laws']) for k in ['changed','unchanged','baseline','partial','error']};print(json.dumps(counts))
    # A per-source failure remains visible in a successfully delivered report. It must not discard other findings.
if __name__=='__main__':main()
