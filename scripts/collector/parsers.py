"""PR16 observed selectors; these are not a claim of live coverage."""
import datetime as dt
from email.utils import parsedate_to_datetime
import hashlib
import io
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qs, urlencode
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from . import expansion

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

def oecd_certainly_outside_window(item, since, until):
    """Exclude a dated OECD detail only if every official time observation agrees on scope.

    A disagreement still leaves published_date unresolved; this check does not
    select a date or make the item eligible for a draft.
    """
    observations=item.get('metadata',{}).get('date_observations',[])
    dates=[]
    for observation in observations:
        if observation.get('meaning') not in ('published_display','published_attribute'):
            continue
        if observation.get('locator') not in ('time','time@datetime',
                'main [itemtype="https://schema.org/Article"] .cmp-article-header__date time[itemprop="datePublished"]'):
            continue
        date=parse_date(observation.get('value',''))
        if date is None:
            return False
        dates.append(date)
    return bool(dates) and all(date < since or date > until for date in dates)

def pdpc_detail_published_date(value):
    """Only accept the exact PDPC detail-page publication label."""
    value=normalize(value)
    match=re.fullmatch(r'Published on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})',value,re.I)
    return parse_date(match[1]) if match else None

def cnil_detail_published_date(observation):
    """CNIL article-page author/date line, distinct from an archive card date."""
    if observation.get('meaning')!='published_display' or observation.get('locator')!='main .ctn-gen-auteur':
        return None
    value=normalize(observation.get('value','')).lower()
    if not re.fullmatch(r'\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}',value):
        return None
    return parse_date(value)

def dpc_detail_published_date(observation):
    """DPC detail-page publication label, separate from the teaser card."""
    if observation.get('meaning')!='published_display' or observation.get('locator')!='main p.date':
        return None
    value=normalize(observation.get('value',''))
    if not re.fullmatch(r'\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}',value,re.I):
        return None
    return parse_date(value)

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
    if source in expansion.ROUTES and source!='ppc':return expansion.extract(source,html,url)
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
    observations=[]
    ppc_title_date=None
    if date_node:
        observations.append({'meaning':'published_display','locator':date_sel or 'Date + strong','value':normalize(date_node.get_text())})
        if date_node.get('datetime'): observations.append({'meaning':'published_attribute','locator':'time@datetime','value':date_node['datetime']})
    if source=='ico':
        meta=soup.find('meta',attrs={'name':re.compile(r'^DC\.Date$',re.I)})
        value=normalize(meta.get('content','')) if meta else ''
        if value and parse_date(value):
            observations.append({'meaning':'official_published_attribute','locator':'meta[name="DC.Date"]@content','value':value})
    if source=='ppc':
        # Do not select the first era date: notices can include enactment/update dates.
        observations=[{'meaning':'notice_date_candidate','locator':'main.l-main','value':m[0]} for m in re.finditer(r'(令和|平成)(元|[0-9０-９]+)年\s*[0-9０-９]+月\s*[0-9０-９]+日',body)]
        # Some PPC press releases put the publication dateline at the very
        # start of main.l-main followed by the Commission name, instead of in
        # the newer .date-box header. Only accept that strict opening pattern;
        # later era dates may be enactment, revision or campaign dates.
        main=soup.select_one('main.l-main')
        opening=normalize(main.get_text(' ',strip=True)) if main else ''
        opening_date=re.match(
            r'^((?:令和|平成)(?:元|[0-9０-９]+)年\s*[0-9０-９]+月\s*[0-9０-９]+日)\s*個人情報保護委員会(?:\s|$)',
            opening,
        )
        if opening_date:
            observations.append({'meaning':'published_opening_dateline',
                'locator':'main.l-main opening date','value':opening_date[1]})
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
    # The opening-dateline template is new to the collector. Resolve the
    # publication date, but keep these announcements behind human review until
    # the editorial/read-scope gate is independently satisfied.
    requires_review=published is None or unread_ppc_pdf or scope in ('official_overview','press_release_html_not_report') or (source=='ppc' and opening_date is not None)
    metadata={'normalization_version':NORMALIZATION_VERSION,'parser_version':'pdpc-flight-rte-v1' if source=='pdpc' else 'oecd-press-release-v1' if oecd_release else 'pr16-selectors-v1','read_scope':scope,'date_observations':observations,
              'requires_review':requires_review,'related_documents':related,'unread_attachments':[r['url'] for r in related],
              'factual_status':'original_statement_not_independent_legal_finding','ai_ready':False}
    return {'title_original':normalize(title.get_text()),'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,'metadata':metadata}

def extract_pdf(data,url):
    """Preserve page boundaries. OCR and a judgment-specific parser are absent."""
    from pypdf import PdfReader
    try:
        reader=PdfReader(io.BytesIO(data),strict=True)
        # Some official notice PDFs are owner-permission encrypted but permit
        # extraction with the empty user password. Only that non-secret,
        # owner-configured case is accepted; password-protected files remain
        # rejected.
        if reader.is_encrypted and not reader.decrypt(''):
            raise ValueError('pdf_limit_or_encrypted')
        if len(reader.pages)<1: raise ValueError('pdf_limit_or_encrypted')
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

def extract_verified_source_pdf(source,data,url,row=None,source_page_url=None):
    """Extract a PDF only after its source-specific discovery has approved its URL.

    Listing/article date observations remain separate from the date printed in
    the standard/report itself. A partial month (for example ISO's 2025-05
    news-row date) is retained as evidence but never promoted to a full date.
    """
    if source not in ('jpdp-my','global-cbpr','iso-iec-sc27','cn-tc260'):
        raise ValueError('unapproved_source_pdf')
    from .pdf_source_routes import discover_pdf_links
    parsed=urlsplit(url)
    approved_assets={
        'jpdp-my':('www.pdp.gov.my',{
            '/wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework.pdf'}),
        'global-cbpr':('www.globalcbpr.org',{
            '/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf',
            '/wp-content/uploads/Global-CBPR-Forum-Work-Program-2026-2027.pdf'}),
        'iso-iec-sc27':('committee.iso.org',{
            '/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf'}),
        'cn-tc260':('www.tc260.org.cn', set()),
    }
    expected_host,expected_paths=approved_assets[source]
    if (parsed.scheme!='https' or parsed.hostname!=expected_host or
            parsed.username is not None or parsed.password is not None or
            parsed.port not in (None,443) or parsed.query or parsed.fragment or
            (parsed.path not in expected_paths and not (source=='cn-tc260' and re.fullmatch(
                r'/tc260/tzgg/\d{6}/[a-f0-9]{32}/files/[^/]+\.pdf(?:\.pdf)?',parsed.path)))):
        raise ValueError('source_pdf_url_not_pdf')
    # The helper's exact host/path policy is authoritative. For ISO, the PDF
    # is linked directly from the news listing; for JPDP/CBPR it is linked
    # from the corresponding article page and must be proven by the caller.
    if source_page_url:
        page_host=urlsplit(source_page_url).hostname
        approved_pages={
            'jpdp-my':('www.pdp.gov.my','/en/public-consultation-paper-no-1-2026-artificial-intelligence-ai-and-personal-data-protection-framework/'),
            'global-cbpr':('www.globalcbpr.org','/the-forum-releases-its-annual-report-2025-2026-and-annual-work-program-for-2026-2027/'),
            'iso-iec-sc27':('committee.iso.org','/sites/jtc1sc27/home/news.html'),
            'cn-tc260':('www.tc260.org.cn',None),
        }
        approved_page_host,approved_page_path=approved_pages[source]
        page_path=urlsplit(source_page_url).path
        tc_article=re.fullmatch(r'/tc260/tzgg/(\d{6})/([a-f0-9]{32})\.shtml',page_path) if source=='cn-tc260' else None
        pdf_article=re.fullmatch(r'/tc260/tzgg/(\d{6})/([a-f0-9]{32})/files/[^/]+\.pdf(?:\.pdf)?',parsed.path) if source=='cn-tc260' else None
        tc_identity_ok=bool(tc_article and pdf_article and tc_article.groups()==pdf_article.groups())
        if page_host!=approved_page_host or (page_path!=approved_page_path and not (source=='cn-tc260' and tc_identity_ok)):
            raise ValueError('pdf_page_not_evidence_backed')
    pdf=extract_pdf(data,url)
    body=normalize(' '.join(page['text'] for page in pdf['pages']))
    observations=list((row or {}).get('date_observations',[]))
    published=expansion.listing_date(row or {})
    title=normalize((row or {}).get('title',''))
    if not title: raise ValueError('pdf_listing_evidence_missing')
    return {'title_original':title,'content_text':body,
        'content_hash':hashlib.sha256(body.encode()).hexdigest(),
        'published_date':published,
        'metadata':{'normalization_version':NORMALIZATION_VERSION,
            'parser_version':'verified-source-pdf-v1','read_scope':'official_source_pdf_text',
            'date_observations':observations,'pdf_pages':pdf['pages'],
            'requires_review':True,'related_documents':[{'url':url,'title':title,'read':True}],
            'unread_attachments':[link['url'] for link in pdf['related_documents']],
            'source_page_url':source_page_url,'factual_status':'official_source_pdf_text_not_human_reviewed',
            'ai_ready':False,'extraction_method':'pypdf'} }

def extract_pdpc_pdf(data,url,row):
    """Only the observed official asset route; text reading is not visual/OCR review."""
    target=urlsplit(url)
    if target.scheme!='https' or target.netloc!='www.pdpc.gov.sg' or not re.fullmatch(r'/assets/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',target.path):
        raise ValueError('unapproved_pdpc_pdf_asset')
    if not row or not normalize(row.get('title','')):
        raise ValueError('pdf_listing_evidence_missing')
    pdf=extract_pdf(data,url)
    body=normalize(' '.join(page['text'] for page in pdf['pages']))
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

def extract_publication_document(source,data,url,content_type,row=None):
    """Fallback body/date adapter for the six observed public publications.

    Production extraction attempts Trafilatura before reaching this parser.
    It only accepts the six exact listing/article route families registered in
    ``publication_route_candidates`` and never promotes unqualified dates.
    """
    if source not in expansion.PUBLICATION_SOURCE_IDS or content_type not in ('text/html','application/xhtml+xml'):
        raise ValueError('publication_document_type_or_source_unverified')
    expansion._canonical(url,source,url)
    html=data.decode('utf-8','replace') if isinstance(data,(bytes,bytearray)) else str(data)
    soup=BeautifulSoup(html,'html.parser')
    title_node=soup.select_one('main h1, article h1, h1')
    title=normalize(title_node.get_text(' ',strip=True)) if title_node else ''
    if not title:title=normalize((row or {}).get('title',''))
    if not title:raise ValueError('publication_article_title_missing')
    selector={
        'iapp':'main article, main [class*=article-body], main',
        'fpf':'main .entry-content, main article, main',
        'gpa':'main .wpb_text_column, main article, main',
        'noyb':'main .field--name-body, main article, main',
        'freevacy':'main .article-body, main article, main',
        'overview-legal':'main article, main .post-content, main',
    }[source]
    body_node=next((soup.select_one(s) for s in selector.split(', ') if soup.select_one(s)),None)
    if body_node is None:raise ValueError('publication_main_body_missing')
    for node in body_node.select('script,style,nav,header,footer,form,button,[aria-hidden="true"]'):
        node.decompose()
    body=normalize(body_node.get_text('\n',strip=True))
    if not body:raise ValueError('publication_main_body_empty')

    observations=[]
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            structured=json.loads(script.get_text(strip=True))
        except (TypeError,json.JSONDecodeError):
            continue
        candidates=structured if isinstance(structured,list) else [structured]
        for candidate in candidates:
            if not isinstance(candidate,dict):
                continue
            if isinstance(candidate.get('@graph'),list):
                candidates.extend(candidate['@graph'])
            kind=candidate.get('@type')
            kinds=kind if isinstance(kind,list) else [kind]
            if not any(value in ('Article','NewsArticle','BlogPosting') for value in kinds):
                continue
            value=candidate.get('datePublished')
            if isinstance(value,str) and value.strip():
                observations.append({'meaning':'published_attribute',
                    'locator':'application/ld+json datePublished','value':normalize(value)})
    for node in soup.select('meta[property="article:published_time"], meta[itemprop="datePublished"], meta[name="datePublished"], time[itemprop="datePublished"], time[datetime][data-published], time.entry-date.published[datetime]'):
        value=node.get('content') or node.get('datetime') or node.get_text(' ',strip=True)
        value=normalize(value)
        if value:
            observations.append({'meaning':'published_attribute' if node.name=='meta' else 'published_display',
                'locator':('meta '+(node.get('property') or node.get('itemprop') or node.get('name') or 'datePublished')) if node.name=='meta' else 'time[itemprop=datePublished]',
                'value':value})
    listing_observations=list((row or {}).get('date_observations',[]))
    observations.extend(listing_observations)
    explicit_dates={parse_date(o.get('value','')) for o in observations
                    if o.get('meaning') in ('published_attribute','published_display','listing_published_display')}
    if source in ('iapp','noyb') and row:
        from .expansion import listing_date
        verified_listing_date=listing_date(row)
        if verified_listing_date:
            explicit_dates.add(verified_listing_date)
    explicit_dates.discard(None)
    published=next(iter(explicit_dates)) if len(explicit_dates)==1 else None
    origin=(row or {}).get('content_origin_kind')
    return {'title_original':title,'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),
        'published_date':published,
        'metadata':{'normalization_version':NORMALIZATION_VERSION,
            'parser_version':'publication-source-fallback-v1','read_scope':'source_article_main_body',
            'date_observations':observations,'requires_review':True,'related_documents':[],
            'unread_attachments':[],'factual_status':'public_publication_text_not_independently_reviewed',
            'source_type':(row or {}).get('source_type'),'source_name':(row or {}).get('source_name'),
            'content_origin_kind':origin,
            'publisher_label':(row or {}).get('publisher_label'),
            'primary_source_verified_by_this_listing':(row or {}).get('primary_source_verified_by_this_listing'),
            'ai_ready':False,'extraction_method':'source_parser_fallback'}}


def extract_document(source,data,url,content_type,row=None):
    if source in expansion.PUBLICATION_SOURCE_IDS:
        return extract_publication_document(source,data,url,content_type,row)
    if source in ('jpdp-my','global-cbpr','iso-iec-sc27','cn-tc260') and content_type in ('application/pdf','application/octet-stream'):
        return extract_verified_source_pdf(source,data,url,row,(row or {}).get('discovered_from'))
    if source in expansion.ROUTES and source!='ppc':
        if content_type not in ('text/html','application/xhtml+xml') and not (source in ('ec','anpd-br') and content_type=='application/json'):raise ValueError('unsupported_document_type')
        return expansion.extract(source,data.decode('utf-8','replace'),url,row)
    if content_type in ('text/html','application/xhtml+xml'):
        item=extract(source,data.decode('utf-8','replace'),url)
        if source in ('pdpc','cnil') and row and row.get('date_observations'):
            observations=item['metadata']['date_observations']+row['date_observations']
            item['metadata']['date_observations']=observations
            dates={parse_date(o['value']) for o in observations}- {None}
            if source=='pdpc':
                explicit={pdpc_detail_published_date(o['value']) for o in observations
                          if o.get('meaning')=='published_display' and o.get('locator')=='main .page-banner__date'}-{None}
            else:
                explicit={cnil_detail_published_date(o) for o in observations}-{None}
            if len(explicit)==1:
                selected=next(iter(explicit))
                conflicts=sorted(d for d in dates if d!=selected)
                item['published_date']=selected
                item['metadata']['date_conflict']=bool(conflicts)
                item['metadata']['date_resolution']={
                    'selected':'explicit_detail_page_published_display',
                    'published_date':selected,
                    'conflicting_dates':conflicts,
                }
                if conflicts:
                    item['metadata']['requires_review']=True
                    item['metadata']['ai_ready']=False
            elif len(dates)>1:
                item['published_date']=None; item['metadata']['date_conflict']=True; item['metadata']['requires_review']=True; item['metadata']['ai_ready']=False
        if source=='dpc' and row:
            listing_observations=row.get('date_observations',[])
            if listing_observations:
                body_observations=item['metadata']['date_observations']
                item['metadata']['date_observations']=body_observations+listing_observations
                dates={parse_date(o['value']) for o in body_observations+listing_observations}- {None}
                listing_date=dpc_listing_date(row)
                if listing_date: dates.add(listing_date)
                explicit={dpc_detail_published_date(o) for o in body_observations}-{None}
                if len(explicit)==1:
                    selected=next(iter(explicit))
                    conflicts=sorted(d for d in dates if d!=selected)
                    item['published_date']=selected
                    item['metadata']['date_conflict']=bool(conflicts)
                    item['metadata']['date_resolution']={
                        'selected':'explicit_detail_page_published_display',
                        'published_date':selected,
                        'conflicting_dates':conflicts,
                    }
                    if conflicts:
                        item['metadata']['requires_review']=True
                        item['metadata']['ai_ready']=False
                elif len(dates)==1:
                    item['published_date']=next(iter(dates))
                    item['metadata']['requires_review']=False
                else:
                    item['published_date']=None
                    item['metadata']['requires_review']=True
        if source=='ftc' and row and row.get('date_observations'):
            listing_observations=row['date_observations']
            body_observations=item['metadata']['date_observations']
            item['metadata']['date_observations']=body_observations+listing_observations
            dates={parse_date(o['value']) for o in body_observations}- {None}
            dates.update(ftc_listing_date({'date_observations':[observation]})
                         for observation in listing_observations)
            dates.discard(None)
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
    if page<1: raise ValueError('invalid_listing_page')
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
    if number<1: raise ValueError('invalid_listing_page')
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
    # The official listing route is also the bootstrap for its JSON endpoint.
    # Do not make that endpoint depend on a particular HTML marker: the same
    # listing can be returned without the marker (for example, alternate
    # server-rendered pages), while the API response itself is schema-checked.
    parts=urlsplit(url)
    if parts.scheme!='https' or parts.hostname!='www.pdpc.gov.sg' or parts.path!='/media-events':
        raise ValueError('pdpc_listing_route_unverified')
    page=listing_page_number(url)
    query={'listingtype':'media_events','itemsperpage':10,'pathname':parts.path}
    if page>1: query['page']=page
    return urljoin(url,'/api/listing-api')+'?'+urlencode(query)

def discover_pdpc_listing(data,url,page):
    try:
        response=json.loads(data)
    except (json.JSONDecodeError,UnicodeDecodeError,TypeError):
        raw=data.encode('utf-8') if isinstance(data,str) else bytes(data) if isinstance(data,(bytes,bytearray)) else b''
        size=len(raw)
        detail='empty_body' if not raw.strip() else 'not_json'
        raise ValueError(f'pdpc_listing_json_invalid:{detail}:bytes_{size}') from None
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

def discover_pdpc_sitemap(data,url):
    """Use PDPC's official sitemap as a bounded discovery fallback.

    Sitemap lastmod values are intentionally ignored: article pages supply the
    publication date, while lastmod may describe a later site update.
    """
    parts=urlsplit(url)
    if parts.scheme!='https' or parts.hostname!='www.pdpc.gov.sg' or parts.path!='/sitemap.xml':
        raise ValueError('pdpc_sitemap_route_unverified')
    raw=data.decode('utf-8','replace') if isinstance(data,(bytes,bytearray)) else str(data)
    if '<!DOCTYPE' in raw.upper() or '<!ENTITY' in raw.upper():
        raise ValueError('xml_entities_rejected')
    try:
        root=ET.fromstring(raw)
    except ET.ParseError:
        raise ValueError('pdpc_sitemap_xml_invalid') from None
    if root.tag.rsplit('}',1)[-1].lower()!='urlset':
        raise ValueError('pdpc_sitemap_schema_changed')
    rows=[]; seen=set()
    for node in root.iter():
        if node.tag.rsplit('}',1)[-1].lower()!='loc' or not node.text:
            continue
        target=urljoin(url,node.text.strip())
        parsed=urlsplit(target)
        if parsed.hostname!='www.pdpc.gov.sg' or not parsed.path.startswith('/media-events/'):
            continue
        canonical=urlunsplit((parsed.scheme,parsed.netloc,parsed.path,'',''))
        # A few official sitemap builds repeat an identical loc entry. Keep
        # one canonical candidate so the collector's repeated-item guard can
        # still catch genuine pagination loops in other listing routes.
        if canonical in seen:
            continue
        seen.add(canonical)
        rows.append({'url':canonical,'title':'','topic':'Unclassified',
            'listing_route':'official_sitemap'})
    if not rows:
        raise ValueError('pdpc_sitemap_empty')
    return rows,None

def discover_listing(source,html,url,fetch):
    if source in expansion.ROUTES:return expansion.discover(source,html,url)
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
        try:
            data,_,_=fetch(endpoint,'GET',None,{
                'Accept':'application/json, text/plain, */*',
                'Referer':url,
            })
            # Validate the body against the strict API schema instead of depending
            # on a stable Content-Type header from the upstream service.
            return discover_pdpc_listing(data,url,listing_page_number(url))
        except Exception as exc:
            reason=str(exc)
            # A robots denial remains a hard stop. The public sitemap is a
            # fallback for an unavailable/empty listing endpoint, not a way to
            # bypass an explicit robots policy.
            if reason=='robots_disallowed' or not (
                reason in ('http_403','http_404','http_410','empty_response') or
                'pdpc_listing_json_invalid:' in reason
            ):
                raise
            fallback='https://www.pdpc.gov.sg/sitemap.xml'
            data,final,_=fetch(fallback)
            rows,next_url=discover_pdpc_sitemap(data,final)
            return rows,next_url
    return discover(source,html,url)

def discover_rss(html,url,keep_feed_text=False,prefer_content_encoded=False):
    if '<!DOCTYPE' in html.upper() or '<!ENTITY' in html.upper(): raise ValueError('xml_entities_rejected')
    root=ET.fromstring(html)
    rows=[]
    for entry in root.iter():
        if entry.tag.rsplit('}',1)[-1].lower() not in ('item','entry'): continue
        values={}
        for node in entry:
            key=node.tag.rsplit('}',1)[-1].lower()
            if key in ('title','link','description','summary','content','encoded','pubdate','published','updated'):
                values.setdefault(key,[]).append(node)
        link_node=next(iter(values.get('link',[])),None)
        target=(link_node.attrib.get('href') if link_node is not None else None) or ((link_node.text or '').strip() if link_node is not None else '')
        if not target: continue
        description_fields=(values.get('encoded',[]) or values.get('content',[]) or values.get('description',[]) or values.get('summary',[])) if prefer_content_encoded else (values.get('description',[]) or values.get('summary',[]) or values.get('encoded',[]) or values.get('content',[]))
        description_node=next(iter(description_fields),None)
        feed_html=''.join(description_node.itertext()).strip() if description_node is not None else ''
        feed_text=normalize(BeautifulSoup(feed_html,'html.parser').get_text('\n',strip=True))
        title_node=next(iter(values.get('title',[])),None)
        title=normalize(''.join(title_node.itertext())) if title_node is not None else ''
        if not title and feed_text:
            heading=BeautifulSoup(feed_html,'html.parser').find('p')
            title=normalize(heading.get_text(' ',strip=True)) if heading else normalize(feed_text.split('. ',1)[0])
            title=re.sub(r'^[\s*#]+|[\s*#]+$','',title).strip()
        if not title: continue
        row={'url':urljoin(url,target),'title':title}
        if keep_feed_text and feed_text:
            row['feed_text']=feed_text
            row['feed_body_source'] = ('rss_content_encoded' if prefer_content_encoded and
                                       description_node is not None and
                                       description_node.tag.rsplit('}',1)[-1].lower()=='encoded'
                                       else 'rss_content_or_description')
        date_node=next(iter(values.get('pubdate',[]) or values.get('published',[]) or values.get('updated',[])),None)
        date_value=normalize(date_node.text or '') if date_node is not None else ''
        if date_value:
            row['date_observations']=[{'meaning':'listing_published_rfc822','locator':'rss item pubDate','value':date_value,
                'raw':date_node.text or ''}]
        rows.append(row)
    return rows,None


def discover(source,html,url):
    if source=='edps' and '<rss' in html[:1000].lower():
        rows,next_page=discover_rss(html,url,keep_feed_text=True)
        for row in rows: row['rss_source']='edps'
        return rows,next_page
    if source=='npc-ph' and html.lstrip('\ufeff \t\r\n').lower().startswith(('<?xml','<rss','<feed')):
        rows,next_page=discover_rss(html,url,keep_feed_text=True,prefer_content_encoded=True)
        for row in rows: row['rss_source']='npc-ph'
        return rows,next_page
    if source=='nl-ap' and html.lstrip('\ufeff \t\r\n').lower().startswith(('<?xml','<rss','<feed')):
        rows,next_page=discover_rss(html,url,keep_feed_text=True)
        for row in rows: row['rss_source']='nl-ap'
        return rows,next_page
    if source in ('eu-council','eu-parliament','npc-ph','nl-ap') and html.lstrip('\ufeff \t\r\n').lower().startswith(('<?xml','<rss','<feed')):
        return discover_rss(html,url)
    if source=='ftc' and '<rss' in html[:1000].lower():
        if '<!DOCTYPE' in html.upper() or '<!ENTITY' in html.upper(): raise ValueError('xml_entities_rejected')
        root=ET.fromstring(html)
        rows=[]
        for item in root.findall('.//item'):
            target=item.findtext('link')
            if not target: continue
            row={'url':target,'title':item.findtext('title') or ''}
            pubdates=[normalize(node.text or '') for node in item.findall('pubDate')]
            if pubdates:
                row['date_observations']=[{'meaning':'listing_published_rfc822','locator':'rss item pubDate','value':value} for value in pubdates]
            rows.append(row)
        return rows,None
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
        if source=='dpc':
            card=a.find_parent('article',class_='node--view-mode-teaser')
            row['date_observations']=[{'meaning':'listing_published_display',
                'locator':'listing article.node--view-mode-teaser p.date',
                'value':normalize(n.get_text())} for n in card.select('p.date')] if card else []
        if source=='ppc':
            card=a.find_parent(lambda node: node.name in ('li','div') and node.select_one('time[datetime]'))
            date_node=card.select_one('time[datetime]') if card else None
            if date_node:
                row['date_observations']=[{'meaning':'expansion_listing_published',
                    'locator':'PPC press archive row time@datetime','value':date_node.get('datetime','')}]
        found[target]=row
    next_link=soup.select_one('a[rel~="next"],.pager__item--next a,.pager-next a')
    return list(found.values()),urljoin(url,next_link['href']) if next_link else None


def cnil_listing_date(row):
    """An individual card date, never proof of the archive's sort order."""
    observations=row.get('date_observations',[])
    if len(observations)!=1: return None
    observation=observations[0]
    if observation.get('meaning')!='listing_published_display' or observation.get('locator')!='listing .list-inner .attributes p.date': return None
    value=observation.get('value')
    if not isinstance(value,str): return None
    value=normalize(value).lower()
    # This field is allowed to exclude a card without reading its detail page,
    # so accept only the exact French date display observed on CNIL cards.
    # Generic parse_date intentionally finds dates inside prose for other
    # sources; using it directly here could mistake an update date or label for
    # the publication date and silently skip an in-range item.
    if not re.fullmatch(r'\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}',value):
        return None
    return parse_date(value)


def dpc_listing_date(row):
    """Return only a single complete date displayed on the DPC news teaser."""
    observations=row.get('date_observations',[]) if isinstance(row,dict) else []
    if len(observations)!=1: return None
    observation=observations[0]
    if (observation.get('meaning')!='listing_published_display' or
            observation.get('locator')!='listing article.node--view-mode-teaser p.date'):
        return None
    value=normalize(observation.get('value',''))
    match=re.fullmatch(r'(\d{1,2})(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})',value,re.I)
    if not match: return None
    day=int(match[1]); suffix=(match[2] or '').lower()
    expected=('th' if 11 <= day % 100 <= 13 else
              'st' if day % 10 == 1 else 'nd' if day % 10 == 2 else
              'rd' if day % 10 == 3 else 'th')
    if suffix and suffix!=expected: return None
    return parse_date(value)

def ftc_listing_date(row):
    """Read a verified FTC listing date or timezone-qualified RSS pubDate."""
    observations=row.get('date_observations',[])
    if len(observations)!=1: return None
    observation=observations[0]
    if (observation.get('meaning')=='expansion_listing_published' and
            observation.get('locator')=='FTC search result time[datetime]'):
        return expansion.date(observation.get('value',''))
    if observation.get('meaning')!='listing_published_rfc822' or observation.get('locator')!='rss item pubDate': return None
    try:
        value=parsedate_to_datetime(observation.get('raw') or observation.get('value',''))
        if value is None or value.utcoffset() is None: return None
        return value.astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
    except (TypeError,ValueError,OverflowError):
        return None
