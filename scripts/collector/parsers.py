"""PR16 observed selectors; these are not a claim of live coverage."""
import datetime as dt
import hashlib
import io
import re
import unicodedata
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlsplit
from bs4 import BeautifulSoup

NORMALIZATION_VERSION = 'main-body-nfc-v1'
MONTHS = {name: i for i, name in enumerate(['january','february','march','april','may','june','july','august','september','october','november','december'],1)}
MONTHS.update({name: i for i, name in enumerate(['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],1)})

def normalize(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text)).strip()

def parse_date(text):
    """Only a displayed complete date; no current-year or URL inference."""
    text = normalize(text).lower()
    era = re.search(r'(令和|平成)(元|\d+)年\s*(\d+)月\s*(\d+)日', text)
    try:
        if era:
            n = 1 if era[2] == '元' else int(era[2])
            if n < 1: return None
            value = dt.date((2018 if era[1] == '令和' else 1988) + n, int(era[3]), int(era[4]))
            if era[1] == '令和' and value < dt.date(2019,5,1): return None
            if era[1] == '平成' and not dt.date(1989,1,8) <= value <= dt.date(2019,4,30): return None
            return value.isoformat()
        iso = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})(?:[tT].*)?', text)
        if iso: return dt.date(*map(int,iso.groups())).isoformat()
        text = re.sub(r'(\d)(st|nd|rd|th)\b', r'\1', text)
        for pattern, order in [(r'(\d{1,2})\s+([a-zéû]+)\s+(\d{4})',(1,2,3)),(r'([a-z]+)\s+(\d{1,2}),?\s+(\d{4})',(2,1,3))]:
            m=re.search(pattern,text)
            if m and m[order[1]] in MONTHS:
                return dt.date(int(m[order[2]]),MONTHS[m[order[1]]],int(m[order[0]])).isoformat()
    except ValueError: pass
    return None

def extract(source, html, url):
    soup=BeautifulSoup(html,'html.parser')
    selectors={
        'edpb':('.node-article-full__title','time.node-article-full__date',['.node-article-full__body']),
        'cnil':('main h1','main .ctn-gen-auteur',['main .page-introduction','main .ctn-gen-body','main .ctn-gen-after .ctn-gen-ascenseur']),
        'dpc':('h1','main p.date',['main .field--name-body']),
        'ftc':('h1','article.node--view-mode-banner time',['main article.node--view-mode-full .field--name-body']),
        'ppc':('h1.page-ttl',None,['main.l-main']),
        'ico':('h1',None,['main .rich-text .prose']),
        'oecd':('h1.cmp-report-header__title','time',[]),
    }
    if source not in selectors:
        raise ValueError('dynamic_or_unverified_template: no verified general parser')
    title_sel,date_sel,body_sel=selectors[source]
    title=soup.select_one(title_sel)
    date_node=soup.select_one(date_sel) if date_sel else None
    if source=='ico':
        label=soup.find('span',string=lambda t:t and t.strip()=='Date')
        date_node=label.find_next_sibling('strong') if label else None
    nodes=[n for sel in body_sel for n in soup.select(sel)]
    scope='news_html'
    if source=='oecd':
        scope='official_abstract'
        for h in soup.select('h2.cmp-title__text'):
            if normalize(h.get_text()).lower()=='abstract':
                container=h.find_parent(class_='cmp-two-column-container')
                if container: nodes=container.select('.cmp-text p')
                break
    if not title or not nodes: raise ValueError('title_or_body_missing')
    related=[]
    for node in nodes:
        for a in node.select('a[href]'):
            link=urljoin(url,a['href'])
            if urlsplit(link).scheme=='https': related.append({'url':link,'title':normalize(a.get_text()),'read':False})
        for n in node.select('nav,footer,script,style,.cookie-banner,.related-content,.field--name-field-related-content'):
            n.decompose()
    # Nested selected nodes must not be counted twice.
    nodes=[n for n in nodes if not any(parent in nodes for parent in n.parents)]
    body=normalize(' '.join(n.get_text(' ',strip=True) for n in nodes))
    if len(body)<10: raise ValueError('empty_body')
    if len(body)>80000: raise ValueError('long_document_requires_chunked_reading')
    observations=[]
    if date_node:
        observations.append({'meaning':'published_display','locator':date_sel or 'Date + strong','value':normalize(date_node.get_text())})
        if date_node.get('datetime'): observations.append({'meaning':'published_attribute','locator':'time@datetime','value':date_node['datetime']})
    if source=='ppc':
        # Do not select the first era date: notices can include enactment/update dates.
        observations=[{'meaning':'notice_date_candidate','locator':'main.l-main','value':m[0]} for m in re.finditer(r'(令和|平成)(元|\d+)年\s*\d+月\s*\d+日',body)]
    dates=[parse_date(o['value']) for o in observations]
    distinct=set(d for d in dates if d)
    published=next(iter(distinct)) if len(distinct)==1 and source!='ppc' else None
    metadata={'normalization_version':NORMALIZATION_VERSION,'parser_version':'pr16-selectors-v1','read_scope':scope,'date_observations':observations,
              'requires_review':published is None,'related_documents':related,'unread_attachments':[r['url'] for r in related],
              'factual_status':'original_statement_not_independent_legal_finding','ai_ready':False}
    return {'title_original':normalize(title.get_text()),'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,'metadata':metadata}

def extract_pdf(data,url):
    """Preserve page boundaries. OCR and a judgment-specific parser are absent."""
    from pypdf import PdfReader
    try:
        reader=PdfReader(io.BytesIO(data),strict=True)
        if reader.is_encrypted or not 1<=len(reader.pages)<=50: raise ValueError('pdf_limit_or_encrypted')
        pages=[]
        for i,page in enumerate(reader.pages,1):
            text=page.extract_text(extraction_mode='layout') or ''
            if len(normalize(text))<20: raise ValueError('pdf_text_missing_or_ocr_required')
            pages.append({'page':i,'text':text.strip()})
        return {'pages':pages,'read_scope':'pdf_text_only','url':url,'requires_review':True}
    except Exception as e: raise ValueError('pdf_extraction_failed') from e

def discover(source,html,url):
    if source=='ftc' and '<rss' in html[:1000].lower():
        if '<!DOCTYPE' in html.upper() or '<!ENTITY' in html.upper(): raise ValueError('xml_entities_rejected')
        root=ET.fromstring(html)
        return [{'url':x.findtext('link'),'title':x.findtext('title') or ''} for x in root.findall('.//item') if x.findtext('link')],None
    if source in ('pdpc','ico','curia'): raise ValueError('listing_adapter_pending_live_verification')
    soup=BeautifulSoup(html,'html.parser')
    selectors={'edpb':'main a[href*="/news/"]','cnil':'main .ctn-gen-liste-titre a[href]',
               'dpc':'main article.node--view-mode-teaser h2 a[href]','ppc':'main a[href*="/news/"]',
               'ftc':'main a[href*="/news-events/news/press-releases/"]','oecd':'main a[href*="/publications/"]'}
    links=soup.select(selectors[source]); found={}
    for a in links:
        target=urljoin(url,a['href'])
        found[target]={'url':target,'title':normalize(a.get_text())}
    next_link=soup.select_one('a[rel~="next"],.pager__item--next a,.pager-next a')
    return list(found.values()),urljoin(url,next_link['href']) if next_link else None
