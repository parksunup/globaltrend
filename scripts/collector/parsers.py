"""PR16 observed selectors; these are not a claim of live coverage."""
import datetime as dt
import hashlib
import io
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qs, urlencode
from bs4 import BeautifulSoup

NORMALIZATION_VERSION = 'main-body-nfc-v1'
MONTHS = {name: i for i, name in enumerate(['january','february','march','april','may','june','july','august','september','october','november','december'],1)}
MONTHS.update({name: i for i, name in enumerate(['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],1)})
MONTHS.update({name: i for i, name in enumerate(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],1)})

def normalize(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text)).strip()

def parse_date(text):
    """Only a displayed complete date; no current-year or URL inference."""
    text = normalize(text).translate(str.maketrans('０１２３４５６７８９','0123456789')).lower()
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

def pdpc_body_nodes(soup):
    """Decode only JSON and byte-delimited text in the observed Flight format.

    Never execute site JavaScript. Read content props directly under the
    standard article, excluding the shell, footer, menu and error templates.
    """
    chunks=[]; prefix='self.__next_f.push('
    try:
        for script in soup.select('script:not([src])'):
            text=script.get_text().strip()
            if not text.startswith(prefix): continue
            values,end=json.JSONDecoder().raw_decode(text[len(prefix):])
            if text[len(prefix)+end:].strip() not in (')',');'):
                raise ValueError('pdpc_embedded_data_changed')
            if isinstance(values,list) and len(values)==2 and values[0]==1 and isinstance(values[1],str):
                chunks.append(values[1])
        stream=''.join(chunks).encode('utf-8'); records={}; offset=0
        while offset<len(stream):
            if stream[offset:offset+1]==b'\n': offset+=1; continue
            header=re.match(rb'([0-9a-f]*):',stream[offset:])
            if not header: raise ValueError('pdpc_embedded_data_changed')
            identifier=header[1].decode(); offset+=header.end()
            length=re.match(rb'T([0-9a-f]+),',stream[offset:])
            if length:
                count=int(length[1],16); offset+=length.end()
                if offset+count>len(stream): raise ValueError('pdpc_embedded_text_truncated')
                value=stream[offset:offset+count].decode('utf-8'); offset+=count
            else:
                end=stream.find(b'\n',offset)
                if end<0: end=len(stream)
                payload=stream[offset:end].decode('utf-8'); offset=end
                if not payload or payload[0] not in '[{"' and payload not in ('null','true','false'): continue
                value=json.loads(payload)
            if identifier in records: raise ValueError('pdpc_embedded_records_ambiguous')
            records[identifier]=value
        nodes=[]
        for value in records.values():
            if not isinstance(value,list) or len(value)!=4 or value[:2]!=['$','main']: continue
            props=value[3]
            if not isinstance(props,dict) or props.get('className')!='layout layout--standard': continue
            for article in props.get('children',[]):
                if not isinstance(article,list) or len(article)!=4 or article[:2]!=['$','article'] or not isinstance(article[3],dict): continue
                for component in article[3].get('children',[]):
                    if not isinstance(component,list) or len(component)!=4 or not isinstance(component[3],dict): continue
                    data=component[3].get('data')
                    if not isinstance(data,dict) or 'content' not in data: continue
                    content=data['content']
                    if isinstance(content,str) and re.fullmatch(r'\$[0-9a-f]+',content): content=records.get(content[1:])
                    if not isinstance(content,str) or content.startswith('$'): raise ValueError('pdpc_embedded_content_unresolved')
                    node=BeautifulSoup(content,'html.parser')
                    if normalize(node.get_text()): nodes.append(node)
        if not nodes: raise ValueError('title_or_body_missing')
        return nodes
    except (json.JSONDecodeError,UnicodeError,TypeError,KeyError) as e:
        raise ValueError('pdpc_embedded_data_changed') from None

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
        'pdpc':('main h1','main .page-banner__date',[]),
    }
    if source not in selectors:
        raise ValueError('dynamic_or_unverified_template: no verified general parser')
    title_sel,date_sel,body_sel=selectors[source]
    oecd_release=source=='oecd' and urlsplit(url).path.startswith('/en/about/news/press-releases/')
    if oecd_release:
        # Verified official article template, scoped away from related cards.
        article='main [itemtype="https://schema.org/Article"]'
        title_sel=article+' h1.cmp-article-header__title'
        date_sel=article+' .cmp-article-header__date time[itemprop="datePublished"]'
        body_sel=[article+' [itemprop="articleBody"] .cmp-text']
    title=soup.select_one(title_sel)
    date_node=soup.select_one(date_sel) if date_sel else None
    if source=='ico':
        label=soup.find('span',string=lambda t:t and t.strip()=='Date')
        date_node=label.find_next_sibling('strong') if label else None
    nodes=[n for sel in body_sel for n in soup.select(sel)]
    scope='news_html'
    if source=='pdpc':
        nodes=pdpc_body_nodes(soup)
        scope='news_html_from_embedded_rsc'
    if oecd_release:
        scope='press_release_html_not_report'
    elif source=='oecd':
        scope='official_abstract'
        for h in soup.select('h2.cmp-title__text'):
            if normalize(h.get_text()).lower()=='abstract':
                container=h.find_parent(class_='cmp-two-column-container')
                if container: nodes=container.select('.cmp-text p')
                break
        if not nodes:
            # Some official publication landing pages have an Introduction,
            # not an Abstract. Read only that verified section, not the page's
            # navigation/related publications or the unseen report itself.
            for h in soup.select('h2.cmp-title__text'):
                if normalize(h.get_text()).lower()=='introduction':
                    container=h.find_parent(class_='cmp-two-column-container')
                    if container: nodes=container.select('.cmp-text p')
                    if nodes: scope='official_overview'
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
    ppc_title_date=None
    if date_node:
        observations.append({'meaning':'published_display','locator':date_sel or 'Date + strong','value':normalize(date_node.get_text())})
        if date_node.get('datetime'): observations.append({'meaning':'published_attribute','locator':'time@datetime','value':date_node['datetime']})
    if source=='ppc':
        # Do not select the first era date: notices can include enactment/update dates.
        observations=[{'meaning':'notice_date_candidate','locator':'main.l-main','value':m[0]} for m in re.finditer(r'(令和|平成)(元|[0-9０-９]+)年\s*[0-9０-９]+月\s*[0-9０-９]+日',body)]
        page_title=normalize(soup.title.get_text()) if soup.title else ''
        publication=re.search(r'公表[（(]((?:令和|平成)(?:元|[0-9０-９]+)年\s*[0-9０-９]+月\s*[0-9０-９]+日)[）)]',page_title)
        if publication:
            ppc_title_date=publication[1]
            observations.append({'meaning':'published_title','locator':'document_title','value':ppc_title_date})
        # This dedicated header is the notice dateline, unlike enactment,
        # revision and attachment-addition dates elsewhere in the article.
        for dateline in soup.select('main.l-main .l-article > .date-box'):
            observations.append({'meaning':'published_notice_dateline',
                'locator':'main.l-main .l-article > .date-box',
                'value':normalize(dateline.get_text(' ',strip=True))})
    publication_observations=[o for o in observations if o['meaning']!='notice_date_candidate']
    dates=[parse_date(o['value']) for o in publication_observations]
    distinct=set(d for d in dates if d)
    published=next(iter(distinct)) if len(distinct)==1 else None
    unread_ppc_pdf=source=='ppc' and any(urlsplit(doc['url']).path.lower().endswith('.pdf') for doc in related)
    requires_review=published is None or unread_ppc_pdf or scope in ('official_overview','press_release_html_not_report')
    metadata={'normalization_version':NORMALIZATION_VERSION,'parser_version':'pdpc-flight-rte-v1' if source=='pdpc' else 'oecd-press-release-v1' if oecd_release else 'pr16-selectors-v1','read_scope':scope,'date_observations':observations,
              'requires_review':requires_review,'related_documents':related,'unread_attachments':[r['url'] for r in related],
              'factual_status':'original_statement_not_independent_legal_finding','ai_ready':False}
    return {'title_original':normalize(title.get_text()),'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,'metadata':metadata}

def extract_pdf(data,url):
    """Preserve page boundaries. OCR and a judgment-specific parser are absent."""
    from pypdf import PdfReader
    try:
        reader=PdfReader(io.BytesIO(data),strict=True)
        if reader.is_encrypted or not 1<=len(reader.pages)<=50: raise ValueError('pdf_limit_or_encrypted')
        pages=[]; related=[]
        for i,page in enumerate(reader.pages,1):
            text=page.extract_text(extraction_mode='layout') or ''
            if len(normalize(text))<20: raise ValueError('pdf_text_missing_or_ocr_required')
            pages.append({'page':i,'text':text.strip()})
            for annotation in page.get('/Annots', []):
                action=annotation.get_object().get('/A')
                if action:
                    action=action.get_object()
                    link=str(action.get('/URI', ''))
                    if action.get('/S')=='/URI' and urlsplit(link).scheme=='https':
                        related.append({'url':link,'title':'PDF link','page':i,'read':False})
        return {'pages':pages,'related_documents':related,'read_scope':'pdf_text_only','url':url,'requires_review':True}
    except ValueError as e:
        if str(e) in ('pdf_text_missing_or_ocr_required','pdf_limit_or_encrypted'): raise
        raise ValueError('pdf_extraction_failed') from e
    except Exception as e: raise ValueError('pdf_extraction_failed') from e

def extract_pdpc_pdf(data,url,row):
    """Only the observed official asset route; text reading is not visual/OCR review."""
    target=urlsplit(url)
    if target.scheme!='https' or target.netloc!='www.pdpc.gov.sg' or not re.fullmatch(r'/assets/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',target.path):
        raise ValueError('unapproved_pdpc_pdf_asset')
    if not row or not normalize(row.get('title','')):
        raise ValueError('pdf_listing_evidence_missing')
    pdf=extract_pdf(data,url)
    body=normalize(' '.join(page['text'] for page in pdf['pages']))
    if len(body)>80000: raise ValueError('long_document_requires_chunked_reading')
    # PDPC cards can display event dates. No verified PDF publication dateline
    # exists yet, so neither listing dates nor arbitrary PDF prose decide range.
    observations=[dict(o,meaning='listing_date_candidate') for o in row.get('date_observations',[])]
    metadata={'normalization_version':NORMALIZATION_VERSION,'parser_version':'pdpc-asset-pdf-text-v1',
        'read_scope':'pdf_text_only','date_observations':observations,'pdf_pages':pdf['pages'],
        'requires_review':True,'related_documents':pdf['related_documents'],
        'unread_attachments':[link['url'] for link in pdf['related_documents']],
        'factual_status':'official_pdf_text_not_visual_or_independent_legal_finding','ai_ready':False}
    return {'title_original':normalize(row['title']),'content_text':body,
        'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':None,'metadata':metadata}

def extract_document(source,data,url,content_type,row=None):
    if content_type in ('text/html','application/xhtml+xml'):
        item=extract(source,data.decode('utf-8','replace'),url)
        if source in ('pdpc','cnil') and row and row.get('date_observations'):
            observations=item['metadata']['date_observations']+row['date_observations']
            item['metadata']['date_observations']=observations
            dates={parse_date(o['value']) for o in observations}- {None}
            if len(dates)>1:
                item['published_date']=None; item['metadata']['requires_review']=True
        return item
    if source=='pdpc' and content_type=='application/pdf':
        return extract_pdpc_pdf(data,url,row)
    if source!='curia' or content_type!='application/pdf':
        raise ValueError('unsupported_document_type')
    if not row or not normalize(row.get('title','')):
        raise ValueError('press_release_listing_evidence_missing')
    pdf=extract_pdf(data,url)
    body=normalize(' '.join(page['text'] for page in pdf['pages']))
    if len(body)>80000: raise ValueError('long_document_requires_chunked_reading')
    observations=list(row.get('date_observations',[]))
    # Only the release's dateline, never case history or PDF file metadata.
    for match in re.finditer(r'Luxembourg,\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})',pdf['pages'][0]['text']):
        observations.append({'meaning':'press_release_dateline','locator':'pdf page 1 Luxembourg dateline','value':match[1]})
    dates=[]
    for observation in observations:
        value=observation['value']
        if observation['meaning']=='published_attribute':
            try: date=dt.datetime.strptime(value.strip(),'%d/%m/%Y').date().isoformat()
            except ValueError: date=None
        else: date=parse_date(value)
        dates.append(date)
    distinct=set(date for date in dates if date)
    published=next(iter(distinct)) if len(distinct)==1 else None
    metadata={'normalization_version':NORMALIZATION_VERSION,'parser_version':'curia-press-release-v1',
        'read_scope':'press_release_pdf_not_judgment','date_observations':observations,
        'pdf_pages':pdf['pages'],'case_numbers':list(dict.fromkeys(re.findall(r'\b[CT]-\d+/\d+(?:\s+[A-Z]{1,2})?\b',row['title']))),
        'requires_review':True,'related_documents':pdf['related_documents'],
        'unread_attachments':[link['url'] for link in pdf['related_documents']],
        'factual_status':'nonbinding_press_release_not_judgment_or_independent_legal_finding','ai_ready':False}
    return {'title_original':normalize(row['title']),'content_text':body,
        'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,'metadata':metadata}

def listing_page_number(url):
    query=parse_qs(urlsplit(url).query,keep_blank_values=True)
    if set(query)-{'page'} or len(query.get('page',['1']))!=1:
        raise ValueError('unverified_listing_query')
    try: page=int(query.get('page',['1'])[0])
    except ValueError: raise ValueError('invalid_listing_page') from None
    if not 1<=page<=1000: raise ValueError('invalid_listing_page')
    return page

def listing_next_url(url,page):
    parts=urlsplit(url)
    return urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode({'page':page+1}),''))

def pdpc_api_page_number(url):
    query=parse_qs(urlsplit(url).query,keep_blank_values=True)
    expected={'itemsperpage':['10'],'listingtype':['media_events'],'pathname':['/media-events']}
    page=query.pop('page',['1'])
    if query!=expected or len(page)!=1:
        raise ValueError('pdpc_listing_query_changed')
    try: number=int(page[0])
    except ValueError: raise ValueError('invalid_listing_page') from None
    if not 1<=number<=1000: raise ValueError('invalid_listing_page')
    return number

def pdpc_api_next_url(url,page):
    parts=urlsplit(url); query=parse_qs(parts.query,keep_blank_values=True)
    query['page']=[str(page+1)]
    return urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode([(k,v) for k,values in query.items() for v in values]),''))

def ico_range_url(url,since,until):
    """Scope the official form to this collection period; restart legacy pages."""
    for value in (since,until):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value) or parse_date(value)!=value:
            raise ValueError('invalid_ico_listing_range')
    if since>until: raise ValueError('invalid_ico_listing_range')
    parts=urlsplit(url); query=parse_qs(parts.query,keep_blank_values=True)
    if query.get('from')!=[since] or query.get('to')!=[until]: query={'from':[since],'to':[until]}
    return urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode([(k,v) for k,values in query.items() for v in values]),''))

def ico_search_request(html,url):
    """Observed site-internal protocol; not a documented/supported public API."""
    soup=BeautifulSoup(html,'html.parser')
    container=soup.select_one('#filter-page-container[data-node-id]')
    selected=soup.select_one('#filter-page-order option[selected]')
    if not container or not selected or selected.get('value')!='newest':
        raise ValueError('ico_listing_template_changed')
    node_id=container['data-node-id']
    if not node_id.isdigit() or int(node_id)<=0: raise ValueError('ico_listing_template_changed')
    parts=urlsplit(url); query=parse_qs(parts.query,keep_blank_values=True)
    if set(query)-{'from','to','page'}: raise ValueError('unverified_listing_query')
    filters=[]
    if 'from' in query or 'to' in query:
        if any(len(query.get(k,[]))!=1 for k in ('from','to')): raise ValueError('invalid_ico_listing_range')
        ico_range_url(url,query['from'][0],query['to'][0])
        filters=[{'key':k,'values':query[k]} for k in ('from','to')]
    if len(query.get('page',['1']))!=1: raise ValueError('invalid_listing_page')
    page_url=urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode({'page':query.get('page',['1'])[0]}),''))
    return {'rootPageId':int(node_id),'filters':filters,'pageNumber':listing_page_number(page_url),'order':'newest'}

def discover_ico_search(data,url,page):
    response=json.loads(data)
    if not isinstance(response,dict) or not isinstance(response.get('results'),list) or not isinstance(response.get('pagination'),dict):
        raise ValueError('ico_search_schema_changed')
    pagination=response['pagination']
    current=pagination.get('showingPageNumber'); total=pagination.get('totalPages'); more=pagination.get('hasMore')
    if type(current) is not int or current!=page or type(total) is not int or total<current or type(more) is not bool or more!=(current<total):
        raise ValueError('ico_pagination_changed_or_stale')
    count=pagination.get('totalResults'); per_page=pagination.get('perPage')
    if type(count) is not int or count<0 or type(per_page) is not int or per_page<=0 or total!=max(1,(count+per_page-1)//per_page):
        raise ValueError('ico_pagination_changed_or_stale')
    if len(response['results'])!=max(0,min(per_page,count-(page-1)*per_page)):
        raise ValueError('ico_listing_page_incomplete')
    rows=[]
    for result in response['results']:
        if not isinstance(result,dict) or not isinstance(result.get('url'),str) or not isinstance(result.get('title'),str):
            raise ValueError('ico_search_schema_changed')
        rows.append({'url':urljoin(url,result['url']),'title':normalize(result['title'])})
    parts=urlsplit(url); query=parse_qs(parts.query,keep_blank_values=True); query['page']=[str(page+1)]
    next_url=urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode([(k,v) for k,values in query.items() for v in values]),''))
    return rows,next_url if more else None

def pdpc_listing_request(html,url):
    soup=BeautifulSoup(html,'html.parser')
    if not soup.select_one('section[data-listing-type="media_events"]'):
        raise ValueError('pdpc_listing_template_changed')
    page=listing_page_number(url)
    query={'listingtype':'media_events','itemsperpage':10,'pathname':urlsplit(url).path}
    if page>1: query['page']=page
    return urljoin(url,'/api/listing-api')+'?'+urlencode(query)

def discover_pdpc_listing(data,url,page):
    response=json.loads(data)
    if not isinstance(response,dict) or not isinstance(response.get('data'),list) or type(response.get('totalItems')) is not int:
        raise ValueError('pdpc_listing_schema_changed')
    total=response['totalItems']; results=response['data']
    if total<0 or len(results)!=max(0,min(10,total-(page-1)*10)):
        raise ValueError('pdpc_listing_page_incomplete')
    rows=[]
    for result in results:
        if not isinstance(result,dict) or any(not isinstance(result.get(k),str) for k in ('href','title','date')):
            raise ValueError('pdpc_listing_schema_changed')
        origin=f'{urlsplit(url).scheme}://{urlsplit(url).netloc}'
        rows.append({'url':urljoin(origin,result['href']),'title':normalize(result['title']),
            'date_observations':[{'meaning':'listing_published_display','locator':'listing card datePublished','value':result['date']}]})
    next_url=pdpc_api_next_url(url,page) if urlsplit(url).path=='/api/listing-api' else listing_next_url(url,page)
    return rows,next_url if page*10<total else None

def discover_listing(source,html,url,fetch):
    if source=='ico':
        payload=ico_search_request(html,url)
        endpoint=urljoin(url,'/api/search')
        data,_,ctype=fetch(endpoint,'POST',json.dumps(payload).encode())
        if ctype!='application/json': raise ValueError('ico_search_response_type_changed')
        return discover_ico_search(data,url,payload['pageNumber'])
    if source=='pdpc':
        if urlsplit(url).path=='/api/listing-api':
            return discover_pdpc_listing(html.encode('utf-8'),url,pdpc_api_page_number(url))
        endpoint=pdpc_listing_request(html,url)
        data,_,ctype=fetch(endpoint)
        if ctype not in ('application/json','text/plain'): raise ValueError('pdpc_listing_response_type_changed')
        return discover_pdpc_listing(data,url,listing_page_number(url))
    return discover(source,html,url)

def discover(source,html,url):
    if source=='ftc' and '<rss' in html[:1000].lower():
        if '<!DOCTYPE' in html.upper() or '<!ENTITY' in html.upper(): raise ValueError('xml_entities_rejected')
        root=ET.fromstring(html)
        return [{'url':x.findtext('link'),'title':x.findtext('title') or ''} for x in root.findall('.//item') if x.findtext('link')],None
    if source in ('pdpc','ico'): raise ValueError('listing_adapter_pending_live_verification')
    soup=BeautifulSoup(html,'html.parser')
    if source=='curia':
        base_node=soup.select_one('base[href]')
        base=urljoin(url,base_node['href']) if base_node else url
        if urlsplit(base).scheme!='https' or urlsplit(base).hostname!=urlsplit(url).hostname:
            raise ValueError('listing_base_outside_official_host')
        found={}
        for card in soup.select('main .curia-itemlist-item'):
            a=card.select_one('.curia-itemlist-item-title a[href]')
            if not a or not urlsplit(a['href']).path.endswith('en.pdf'): continue
            target=urljoin(base,a['href']); observations=[]
            time_node=card.select_one('time')
            if time_node:
                observations.append({'meaning':'published_display','locator':'listing .curia-itemlist-item time','value':normalize(time_node.get_text())})
                if time_node.get('datetime'):
                    observations.append({'meaning':'published_attribute','locator':'listing time@datetime','value':time_node['datetime']})
            found[target]={'url':target,'title':normalize(a.get_text()),'date_observations':observations}
        next_link=soup.select_one('a[rel~="next"],.pagination li.next:not(.disabled) a[href]')
        return list(found.values()),urljoin(base,next_link['href']) if next_link else None
    selectors={'edpb':'main a[href*="/news/"]','cnil':'main .ctn-gen-liste-titre a[href]',
               'dpc':'main article.node--view-mode-teaser h2 a[href]','ppc':'main .news-list .news-text a[href]',
               'ftc':'main a[href*="/news-events/news/press-releases/"]','oecd':'main a[href*="/publications/"],main a[href*="/about/news/press-releases/"]'}
    links=soup.select(selectors[source]); found={}
    for a in links:
        target=urljoin(url,a['href'])
        title=normalize(a.get_text())
        if source=='edpb' and not title:
            card=a.find_parent(class_='node-article-card')
            heading=card.select_one('.node-article-card__title') if card else None
            if heading: title=normalize(heading.get_text())
        row={'url':target,'title':title}
        if source=='cnil':
            card=a.find_parent(class_='list-inner')
            row['date_observations']=[{'meaning':'listing_published_display',
                'locator':'listing .list-inner .attributes p.date','value':normalize(n.get_text())}
                for n in card.select('.attributes p.date')] if card else []
        found[target]=row
    next_link=soup.select_one('a[rel~="next"],.pager__item--next a,.pager-next a')
    return list(found.values()),urljoin(url,next_link['href']) if next_link else None


def cnil_listing_date(row):
    """An individual card date, never proof of the archive's sort order."""
    observations=row.get('date_observations',[])
    if len(observations)!=1: return None
    observation=observations[0]
    if observation.get('meaning')!='listing_published_display' or observation.get('locator')!='listing .list-inner .attributes p.date': return None
    return parse_date(observation.get('value',''))
