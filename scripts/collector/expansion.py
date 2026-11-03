"""Observed official news routes shared with Edge; no general site scraping."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urljoin, parse_qs, urlencode
from bs4 import BeautifulSoup

ROUTES=json.loads((Path(__file__).resolve().parents[2]/'supabase/functions/trend-collector/expansion-routes.json').read_text())
CLOUD_SOURCES=('ec','eu-parliament')

def listing_request_url(source,url,since,until):
    from .core import canonical_url
    if source!='ec':return url
    start=dt.date.fromisoformat(since);end=dt.date.fromisoformat(until)
    if start>end:raise ValueError('invalid_expansion_range')
    parsed=urlsplit(canonical_url(url,[ROUTES[source]['host']]))
    if parsed.path not in ('/commission/presscorner/api/latestnews','/commission/presscorner/api/search'):raise ValueError('unverified_listing_path')
    params={k:v[0] for k,v in parse_qs(parsed.query).items()}
    params.update(language='en',pagesize='10',datefrom=start.strftime('%d%m%Y'),dateto=(end+dt.timedelta(days=1)).strftime('%d%m%Y'))
    params.setdefault('pagenumber','1')
    return canonical_url(parsed._replace(path='/commission/presscorner/api/search',query=urlencode(params)).geturl(),[ROUTES[source]['host']])

def verify_detail_response(source,requested,received):
    from .core import canonical_url
    expected=detail_request_url(source,requested)
    actual=canonical_url(received,[ROUTES[source]['host']])
    if source=='eu-parliament':
        original=re.search(r'/press-room/(\d{8}IPR\d+)(?:/|$)',urlsplit(requested).path)
        redirected=re.search(r'/press-room/(\d{8}IPR\d+)(?:/|$)',urlsplit(actual).path)
        _canonical(actual,source,requested)
        if original and redirected and original[1]==redirected[1]:return
    elif canonical_url(expected,[ROUTES[source]['host']])==actual:return
    raise ValueError('detail_redirect_identity_mismatch')

def _bounded_frozen_cursor(cursor,source):
    from .core import canonical_url
    urls=cursor.get('frozen_urls')
    if not isinstance(urls,list) or not urls or len(urls)>100 or not all(isinstance(u,str) for u in urls) or len(set(urls))!=len(urls):raise ValueError('expansion_frozen_cursor_invalid')
    for url in urls:_canonical(url,source,url)
    if type(cursor.get('offset')) is not int or not 0<=cursor['offset']<=len(urls):raise ValueError('expansion_frozen_cursor_invalid')
    if cursor.get('frozen_next') is not None:canonical_url(cursor['frozen_next'],[ROUTES[source]['host']])
    # PostgreSQL jsonb::text inserts spaces after commas/colons; default JSON
    # separators conservatively budget that exact durable cursor contract.
    if len(json.dumps(cursor,ensure_ascii=False).encode('utf-8'))>3900:raise ValueError('expansion_resume_cursor_capacity_exceeded')

def collect_frozen(config,client,store,since,until):
    """Freeze URL identities in the existing atomic DB cursor, one body per commit.

    The cursor is below the existing 4000-byte limit. Titles are read from the
    actual detail, not cached. A changed feed cannot reset a committed ordinal.
    """
    from .core import fetch_listing,FetchError
    from . import parsers
    source=config['source'];cursor=store.resume(config,since,until) or {}
    result=dict(source=source,status='partial',reason=None,coverage_complete=False,since=since,until=until,discovered=0,new=0,changed=0,duplicate=0,held=0,failed=0,out_of_range=0,unknown_date=0,pages=0,excluded_unapproved_host_count=0)
    try:
        if 'frozen_urls' not in cursor:
            page=listing_request_url(source,cursor.get('page') or config['listing'],since,until)
            rows,nxt=fetch_listing(source,client,page);result['pages']=1
            if not rows:
                if source=='ec':
                    if nxt:store.progress(config,since,until,dict(page=nxt,offset=0))
                    else:store.progress(config,since,until,None);store.checkpoint(config,until)
                    result.update(listing_scan_complete=not bool(nxt),reason='scoped_official_listing_empty')
                    return result
                raise ValueError('listing_empty_or_structure_changed')
            cursor=dict(page=page,offset=0,frozen_urls=[r['url'] for r in rows],frozen_next=nxt)
        _bounded_frozen_cursor(cursor,source)
        ordinal=cursor['offset'];urls=cursor['frozen_urls']
        if ordinal<len(urls):
            url=urls[ordinal];result['discovered']=1
            try:
                body,received,ctype=client.get(detail_request_url(source,url))
                verify_detail_response(source,url,received)
                item=parsers.extract_document(source,body,url,ctype)
                published=item['published_date']
                if published and not since<=published<=until:result['out_of_range']=1
                else:
                    item['metadata']['relevance_reason']='full_body_available_human_relevance_review_pending'
                    store.ingest(config,url,item)
                    if published is None:result['unknown_date']=1;result['held']=1
            except (FetchError,ValueError) as error:
                result.update(status='failed',reason='detail_failure:'+str(error),failed=1,failed_url=url)
                store.discovery_failure(config,url,'Official source document',str(error))
                store.progress(config,since,until,cursor)
                return result
            cursor={**cursor,'offset':ordinal+1}
        if cursor['offset']>=len(urls):
            if cursor['frozen_next']:
                store.progress(config,since,until,dict(page=cursor['frozen_next'],offset=0))
                result['reason']='frozen_listing_page_complete'
            else:
                store.progress(config,since,until,None);store.checkpoint(config,until)
                result.update(listing_scan_complete=True,reason='listing_exhaustiveness_unverified')
        else:
            store.progress(config,since,until,cursor);result['reason']='frozen_listing_item_processed'
        return result
    except (FetchError,ValueError) as error:
        # No body was committed. Keep the exact persisted position for retry.
        store.progress(config,since,until,cursor or None)
        result.update(status='failed',reason=str(error),failed=1)
        return result

def _canonical(raw,source,base):
    from .core import canonical_url
    c=ROUTES[source]
    url=canonical_url(urljoin(base,raw),[c['host']])
    if not re.fullmatch(c['article_path'],urlsplit(url).path):raise ValueError('unverified_article_path')
    return url

def date(value):
    from .parsers import normalize,parse_date
    value=normalize(value)
    chinese=re.fullmatch(r'(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+\d{2}:\d{2})?',value)
    if chinese:
        try:return dt.date(*map(int,chinese.groups())).isoformat()
        except ValueError:return None
    if re.fullmatch(r'(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+([+-]\d{4}|GMT)',value):
        try:return parsedate_to_datetime(value).astimezone(dt.timezone.utc).date().isoformat()
        except (ValueError,TypeError):return None
    return parse_date(value)

def listing_date(row):
    obs=row.get('date_observations',[])
    return date(obs[0]['value']) if len(obs)==1 and obs[0].get('meaning')=='expansion_listing_published' else None

def next_within_window(source,rows,nxt,since):
    if not nxt or source not in ('oaic','ca-opc'):return nxt
    dates=[listing_date(r) for r in rows]
    if dates and all(dates) and all(dates[i]<=dates[i-1] for i in range(1,len(dates))) and dates[-1]<since:return None
    return nxt

def detail_request_url(source,url):
    if source not in ROUTES:return url
    url=_canonical(url,source,url)
    if source!='ec':return url
    code=urlsplit(url).path.rsplit('/',1)[1].replace('_','/').upper()
    return 'https://ec.europa.eu/commission/presscorner/api/documents?'+urlencode({'language':'en','reference':code})

def discover(source,html,url):
    from .parsers import normalize
    from .core import canonical_url
    c=ROUTES[source];canonical_url(url,[c['host']]);rows={}
    def add(raw,title,value=None,locator='',meaning='expansion_listing_published'):
        target=_canonical(raw,source,url)
        if not normalize(title):raise ValueError('listing_title_missing')
        rows[target]={'url':target,'title':normalize(title)}
        if value:rows[target]['date_observations']=[{'meaning':meaning,'locator':source+' '+locator,'value':normalize(value)}]
    if c.get('json_api'):
        data=json.loads(html);params=parse_qs(urlsplit(url).query);page=int(params.get('pagenumber',['1'])[0]);size=int(params.get('pagesize',['100'])[0])
        if (type(data.get('totalNumber')) is not int or data['totalNumber']<0 or data.get('pageNumber')!=page or data.get('pageSize')!=size or not isinstance(data.get('docuLanguageListResources'),list) or len(data['docuLanguageListResources'])!=max(0,min(size,data['totalNumber']-(page-1)*size))):raise ValueError('ec_listing_schema_or_page_changed')
        for row in data['docuLanguageListResources']:
            if not isinstance(row.get('refCode'),str) or not isinstance(row.get('title'),str):raise ValueError('ec_listing_schema_changed')
            if not re.fullmatch(r'(IP|QANDA|STATEMENT|SPEECH|MEMO|MEX)/\d{2}/\d+',row['refCode'],re.I):raise ValueError('ec_listing_document_type_unverified')
            add('/commission/presscorner/detail/en/'+row['refCode'].lower().replace('/','_'),row['title'])
        params={k:v[0] for k,v in params.items()};params['pagenumber']=str(page+1)
        nxt=urlsplit(url)._replace(query=urlencode(params)).geturl() if page*size<data['totalNumber'] else None
    elif c.get('feed'):
        if re.search(r'<!DOCTYPE|<!ENTITY',html,re.I):raise ValueError('xml_entities_rejected')
        root=ET.fromstring(html)
        for item in root.findall('./channel/item'):add(item.findtext('link',''),item.findtext('title',''),item.findtext('pubDate'),'RSS pubDate','expansion_feed_publication')
        nxt=None
    else:
        soup=BeautifulSoup(html,'html.parser')
        for a in soup.select(c['links']):
            raw=a['href']
            if c.get('unwrap_query'):
                wrapper=canonical_url(urljoin(url,raw),[c['host']]);values=parse_qs(urlsplit(wrapper).query).get(c['unwrap_query'],[])
                if urlsplit(wrapper).path!='/s/redirect' or len(values)!=1:raise ValueError('unverified_redirect_wrapper')
                raw=values[0]
            target=urljoin(url,raw)
            if urlsplit(target).hostname==c['host'] and not re.fullmatch(c['article_path'],urlsplit(target).path):continue
            card=a.find_parent(class_=c['card'][1:]) if c.get('card','').startswith('.') else a.find_parent(c.get('card')) if c.get('card') else None
            node=card.select_one(c['card_date']) if card and c.get('card_date') else None
            add(raw,a.get_text(' ',strip=True),node.get_text(' ',strip=True) if node else None,c.get('card_date',''))
        node=soup.select_one(c['next']) if c.get('next') else None
        nxt=canonical_url(urljoin(url,node['href']),[c['host']]) if node else None
        if source=='oaic':
            current=int(parse_qs(urlsplit(url).query).get('start_rank',['1'])[0]);links=[]
            for a in soup.select('a[href*="start_rank="]'):
                target=urljoin(url,a['href']);rank=int(parse_qs(urlsplit(target).query).get('start_rank',['0'])[0])
                if rank>current:links.append((rank,target))
            nxt=canonical_url(min(links)[1],[c['host']]) if links else None
        if source=='cn-tc260':
            paging=re.search(r"createPageHTML\('page_div',\s*(\d+),\s*(\d+),'list','shtml',\s*(\d+)\)",html)
            current=re.search(r'list_(\d+)\.shtml$',urlsplit(url).path);current=int(current[1]) if current else 1
            if not paging or int(paging[2])!=current or int(paging[1])<current:raise ValueError('tc260_pagination_changed')
            nxt=urljoin(url,f'list_{current+1}.shtml') if current<int(paging[1]) else None
    if not rows and not c.get('json_api'):raise ValueError('listing_empty_or_structure_changed')
    return list(rows.values()),nxt

def extract(source,input,url,row=None):
    from .parsers import normalize
    c=ROUTES[source];_canonical(url,source,url);observations=[]
    if source=='ec':
        data=json.loads(input);body=data.get('docuLanguageResource',{});expected=urlsplit(url).path.rsplit('/',1)[1].replace('_','/').upper()
        if str(data.get('refCd','')).upper()!=expected or not isinstance(body.get('title'),str) or not isinstance(body.get('htmlContent'),str) or data.get('originalLanguage') is None:raise ValueError('ec_detail_schema_or_identity_changed')
        soup=BeautifulSoup('<main><h1></h1><article></article></main>','html.parser');soup.h1.string=body['title'];soup.article.append(BeautifulSoup(body['htmlContent'],'html.parser'))
        for quote in body.get('dolaQuoteResources',[]):
            if not isinstance(quote.get('extract'),str) or not isinstance(quote.get('author',{}).get('authorName'),str):raise ValueError('ec_quote_schema_changed')
            block=soup.new_tag('blockquote');text=soup.new_tag('p');text.string=quote['extract'];author=soup.new_tag('cite');author.string=quote['author']['authorName'];block.append(text);block.append(author);soup.article.append(block)
        if isinstance(data.get('publishDate'),str):observations.append({'meaning':'official_published_attribute','locator':'EC documents.publishDate','value':data['publishDate']})
    else:soup=BeautifulSoup(input,'html.parser')
    title=soup.select_one(c.get('title','main h1'));nodes=soup.select(c.get('body','main article'));nodes=[n for n in nodes if not any(p in nodes for p in n.parents)]
    if title is None or not nodes:raise ValueError('title_or_body_missing')
    related=[]
    for n in nodes:
        for a in n.select('a[href]'):
            target=urljoin(url,a['href'])
            if urlsplit(target).scheme=='https':related.append({'url':target,'title':normalize(a.get_text(' ',strip=True)),'read':False})
        for x in n.select('script,style,nav,footer,.related-content,.cookie-banner'):x.decompose()
    body=normalize(' '.join(n.get_text(' ',strip=True) for n in nodes))
    if len(body)<10:raise ValueError('empty_body')
    if len(body)>80000:raise ValueError('long_document_requires_chunked_reading')
    for n in soup.select(c['date']) if c.get('date') else []:
        value=n.get(c['date_attribute']) if c.get('date_attribute') else n.get_text(' ',strip=True)
        if value:observations.append({'meaning':'official_published_attribute','locator':c['date'],'value':normalize(value)})
    dates={date(x['value']) for x in observations}-{None};published=next(iter(dates)) if len(dates)==1 else None
    listed=listing_date(row) if row else None;conflict=len(dates)>1 or bool(published and listed and published!=listed)
    return {'title_original':normalize(title.get_text(' ',strip=True)),'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,'metadata':{'normalization_version':'main-body-nfc-v1','parser_version':'expansion-v1','read_scope':'official_press_or_news_body','date_observations':observations+(row or {}).get('date_observations',[]),'date_conflict':conflict,'requires_review':not published or conflict,'related_documents':related,'unread_attachments':[r['url'] for r in related],'factual_status':'original_statement_not_independent_legal_finding','ai_ready':bool(published) and not conflict}}
