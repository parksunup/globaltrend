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
# ANPD uses the public Plone REST API. Keep this Python-only route here until
# its adapter is available to the Edge runtime as well.
ROUTES['anpd-br']={
    'host':'www.gov.br',
    'listing':'https://www.gov.br/anpd/++api++/@search?portal_type=News%20Item&path=%2Fpt-br%2Fassuntos%2Fnoticias&sort_on=effective&sort_order=descending&b_size=10',
    'listing_path':r'^/anpd/\+\+api\+\+/@search$',
    'article_path':r'^/anpd/pt-br/assuntos/noticias/[a-z0-9][a-z0-9-]*$',
    'detail_api_path':r'^/anpd/\+\+api\+\+/pt-br/assuntos/noticias/[a-z0-9][a-z0-9-]*$',
}
ROUTES['nist']={
    'host':'www.nist.gov',
    'listing':'https://www.nist.gov/news-events/news-updates/org/258376',
    'links':'article.nist-teaser h3.nist-teaser__title a[href]',
    'article_path':r'^/news-events/news/\d{4}/\d{2}/[^/]+$',
    'card':'article.nist-teaser',
    'card_title':'h3.nist-teaser__title',
    'card_date':'time[datetime]',
    'card_date_attribute':'datetime',
    'title':'h1.nist-page__title',
    'body':'.nist-page__region--content',
    'date':'meta[property="article:published_time"]',
    'date_attribute':'content',
    'next':'a[rel="next"],li.pager__item--next a',
}
ROUTES['vn-gov']={
    'host':'en.baochinhphu.vn',
    'listing':'https://en.baochinhphu.vn/',
    'links':'div.box-category-item-sub h3.box-category-content a.box-category-link-title[data-linktype="newsdetail"][href]',
    'article_path':r'^/[a-z0-9-]+-\d{18}\.htm$',
    'title':'h1.detail-title[data-role="title"]',
    'body':'.detail-content',
    'date':'meta[property="article:published_time"]',
    'date_attribute':'content',
    # The public "See more" button increments this page index through the
    # site's own timeline endpoint. The endpoint and zone value were verified
    # from the page's script and consecutive public HTML-fragment responses.
    'timeline_zone':'11151',
}
ROUTES['ico']={
    'host':'www.wired-gov.net',
    'listing':'https://www.wired-gov.net/wg/home.nsf/nav/latest+news?open&id=BDEX-6ZFKSH',
    'article_path':r'^/wg/news[.]nsf/articles/[^/]+$',
    'title':'div.newsbox.article-inner-container h2[itemprop="name"]',
    'body':'div.wgstyle.article-whole-container',
    'date':'meta[name="DC.Date"]',
    'date_attribute':'content',
}
ROUTES['hk-pcpd']={
    'host':'www.info.gov.hk',
    'listing':'https://www.info.gov.hk/gia/general/today.htm',
    'article_path':r'^/gia/general/\d{6}/\d{2}/P\d+\.htm$',
}
ROUTES['nl-ap']={
    'host':'autoriteitpersoonsgegevens.nl',
    'listing':'https://autoriteitpersoonsgegevens.nl/feed/article/rss.xml',
    'article_path':r'^/actueel/[a-z0-9][a-z0-9-]*/?$',
}
ROUTES['ppc']={
    'host':'www.ppc.go.jp',
    'listing':'https://www.ppc.go.jp/news/press/',
    'links':'main .news-list .news-text a[href]',
    'card':'div.news-text',
    'card_date':'time[datetime]',
    'card_date_attribute':'datetime',
    'article_path':r'^/(?:news/press/[A-Za-z0-9_%/-]+|news/careful_information/[A-Za-z0-9_%/-]+)/?$',
}
ROUTES['eu-council']={
    'host':'www.consilium.europa.eu',
    'listing':'https://www.consilium.europa.eu/en/rss/pressreleases.ashx',
    'article_path':r'^/en/press/press-releases/\d{4}/\d{2}/\d{2}/[^?#]+/$',
    'feed':True,
}
ROUTES['g7-dpa']={
    'host':'www.priv.gc.ca',
    'listing':'https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-collaboration/international-events/g7-2025/membership/',
    'article_path':r'^/en/(?:opc-news/(?:news-and-announcements|speeches-and-statements)|opc-actions-and-decisions/advice-to-parliament)/\d{4}/[^/]+/?$',
    'title':'main h1#wb-cont, main h1',
    'body':'main section[aria-label="Main content"]',
    # This route's pages may contain dates for meetings/adoption in body text.
    # Use the government-issued publication metadata, not arbitrary <time> nodes.
    'date':None,
}
ROUTES['calprivacy']={
    'host':'privacy.ca.gov',
    'listing':'https://privacy.ca.gov/category/content-types/news/press-release/',
    'links':'article.post .thumbnail-link[href], article.post .title[href]',
    'article_path':r'^/\d{4}/\d{2}/[^/]+/?$',
    'card':'article.post',
    'card_title':'.cat-info h2',
    'card_date':'.post-meta .published',
    'title':'main .et_pb_text_1 h2',
    'body':'main .et_pb_text_1 .et_pb_text_inner',
    'date':'meta[property="article:published_time"]',
    'date_attribute':'content',
    'next':'a.next, a.next.page-numbers, a[rel="next"]',
}
ROUTES['cn-cac']={
    'host':'www.cac.gov.cn',
    'listing':'https://www.cac.gov.cn/wxzw/sjzl/A093708index_1.htm',
    'links':'#loadingInfoPage li h5 a[href]',
    'article_path':r'^/\d{4}-\d{2}/\d{2}/c_\d+\.htm$',
    'card':'li',
    'card_date':'.times',
    'title':'.main-title h1.title',
    'body':'#BodyLabel',
    'date':'#pubtime',
}
ROUTES['ftc']={
    'host':'search.ftc.gov',
    # www.ftc.gov remains accepted for already-persisted feed rows and their
    # historical detail URLs. The live source config stays held on search.ftc.gov.
    'hosts':['search.ftc.gov','www.ftc.gov'],
    'listing':'https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29',
    'links':'main a[href*="/news-events/news/press-releases/"]',
    'article_path':r'^/news-events/news/press-releases/[^?#]+$',
    'card':'article',
    'card_title':'h2, h3',
    'card_date':'time[datetime]',
    'card_date_attribute':'datetime',
    'title':'h1',
    'body':'main article .field--name-body, main article',
    'date':'time[datetime]',
    'date_attribute':'datetime',
    'next':'a[rel="next"], .pager__item--next a[href]',
}
ROUTES['ripd']={
    'host':'www.redipd.org',
    'listing':'https://www.redipd.org/noticias/rss.xml',
    'feed':True,
    'article_path':r'^/noticias/[^?#]+$',
    'title':'main h1',
    'body':'main article, main .field--name-body',
    'date':'meta[property="article:published_time"]',
    'date_attribute':'content',
}
ROUTES['jpdp-my']={
    'host':'www.pdp.gov.my',
    'listing':'https://www.pdp.gov.my/en/main-page/',
    'links':'article.elementor-post h3.elementor-post__title a[href]',
    'article_path':r'^/en/[a-z0-9][a-z0-9-]*/$',
    'card':'article.elementor-post',
    'card_date':'.elementor-post-date',
}
ROUTES['global-cbpr']={
    'host':'www.globalcbpr.org',
    'listing':'https://www.globalcbpr.org/news/',
    'links':'article.elementor-post h2.elementor-post__title a[href]',
    'article_path':r'^/[a-z0-9][a-z0-9-]*/$',
    'card':'article.elementor-post',
    'card_date':'.elementor-post-date',
    'next':'a.page-numbers.next[href],a[rel="next"]',
}
ROUTES['iso-iec-sc27']={
    'host':'committee.iso.org',
    'listing':'https://committee.iso.org/sites/jtc1sc27/home/news.html',
    'article_path':r'^/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023[.]pdf$',
}
PUBLICATION_SOURCE_IDS=('iapp','fpf','gpa','noyb','freevacy','overview-legal')
_PUBLICATION_ROUTES={
    'iapp':{'host':'iapp.org','listing':'https://iapp.org/news','article_path':r'^/news/a/[a-z0-9][a-z0-9-]*/?$'},
    'fpf':{'host':'fpf.org','listing':'https://fpf.org/blog/','article_path':r'^/blog/[a-z0-9][a-z0-9-]+/?$'},
    'gpa':{'host':'globalprivacyassembly.com','listing':'https://globalprivacyassembly.com/news-events/latest-news/','article_path':r'^/[a-z0-9][a-z0-9-]+/?$'},
    'noyb':{'host':'noyb.eu','listing':'https://noyb.eu/en/news','article_path':r'^/en/[a-z0-9][a-z0-9-]+/?$'},
    'freevacy':{'host':'www.freevacy.com','listing':'https://www.freevacy.com/news','article_path':r'^/news/[a-z0-9-]+/[a-z0-9-]+/\d+/?$'},
    'overview-legal':{'host':'overview.legal','listing':'https://overview.legal/this-week?ui=v1','article_path':r'^/posts/\d+/?$'},
}
for _source,_route in _PUBLICATION_ROUTES.items():
    ROUTES[_source]=dict(_route)
CLOUD_SOURCES=('ec','eu-parliament','anpd-br','nist','ico','g7-dpa','vn-gov','hk-pcpd')

def listing_request_url(source,url,since,until):
    from .core import canonical_url
    if source=='edpb':
        parsed=urlsplit(canonical_url(url,['www.edpb.europa.eu']))
        if parsed.path!='/news_en':raise ValueError('edpb_listing_path_unverified')
        start=dt.date.fromisoformat(since).year
        end=dt.date.fromisoformat(until).year
        if start>end:raise ValueError('invalid_expansion_range')
        params={key:values[0] for key,values in parse_qs(parsed.query).items()}
        params['date']=str(start) if start==end else f'{start}-{end}'
        return canonical_url(parsed._replace(query=urlencode(params)).geturl(),['www.edpb.europa.eu'])
    if source=='curia':
        parsed=urlsplit(canonical_url(url,['curia.europa.eu']))
        if parsed.path!='/site/jcms/d2_5158/en/press-releases':raise ValueError('curia_listing_path_unverified')
        start=dt.date.fromisoformat(since).year
        end=dt.date.fromisoformat(until).year
        # The official form accepts one year per query. A cross-year window
        # needs a multi-query sweep, so do not pretend one year is exhaustive.
        if start!=end:return url
        params={key:values[0] for key,values in parse_qs(parsed.query).items() if not key.startswith('PortalAction_d6_1000000371_')}
        params.update(year=str(start),PortalAction_d6_1000000371_start='0',PortalAction_d6_1000000371_pageSize='500',PortalAction_d6_1000000371_pagerAll='true',PortalAction_d6_1000000371_sort='year',PortalAction_d6_1000000371_reverse='true')
        return canonical_url(parsed._replace(query=urlencode(params)).geturl(),['curia.europa.eu'])
    if source=='vn-gov':
        parsed=urlsplit(url)
        if parsed.hostname!='en.baochinhphu.vn':raise ValueError('vn_listing_host_unverified')
        if parsed.path in ('/','/policies.htm'):return url
        match=re.fullmatch(r'/timelinelist/(11151)/(\d+)\.htm',parsed.path)
        if not match or int(match[2])<2:raise ValueError('vn_timeline_page_unverified')
        return url
    if source=='ppc':
        parsed=urlsplit(url)
        if parsed.hostname!='www.ppc.go.jp':raise ValueError('ppc_listing_host_unverified')
        if parsed.path=='/news/press/':
            year=dt.date.fromisoformat(until).year
            return f'https://www.ppc.go.jp/news/press/{year}/'
        if not re.fullmatch(r'/news/press/\d{4}/(?:|\d{6}_houdou/?)',parsed.path):
            raise ValueError('ppc_listing_path_unverified')
        return url
    if source=='hk-pcpd':
        if urlsplit(url).hostname!='www.info.gov.hk':raise ValueError('hk_pcpd_listing_host_unverified')
        if urlsplit(url).path=='/gia/general/today.htm':
            target=dt.date.fromisoformat(until);start=dt.date.fromisoformat(since)
            if target<start:raise ValueError('hk_pcpd_invalid_date_window')
            return f'https://www.info.gov.hk/gia/general/{target:%Y%m}/{target:%d}.htm'
        match=re.fullmatch(r'/gia/general/(\d{4})(\d{2})/(\d{2})\.htm',urlsplit(url).path)
        if not match:
            raise ValueError('hk_pcpd_date_archive_unverified')
        if dt.date(int(match[1]),int(match[2]),int(match[3]))<dt.date.fromisoformat(since):return None
        return url
    if source=='g7-dpa':
        parsed=urlsplit(url)
        if parsed.hostname!='www.priv.gc.ca' or parsed.path!='/en/about-the-opc/what-we-do/international-collaboration/international-events/g7-2025/membership/':
            raise ValueError('g7_membership_hub_unverified')
        return url
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
    if source=='anpd-br':
        actual=canonical_url(received,[ROUTES[source]['host']])
        if actual!=detail_request_url(source,requested):raise ValueError('anpd_detail_redirect_identity_mismatch')
        return
    expected=detail_request_url(source,requested)
    hosts=ROUTES[source].get('hosts',[ROUTES[source]['host']])
    actual=canonical_url(received,hosts)
    if source=='eu-parliament':
        original=re.search(r'/press-room/(\d{8}IPR\d+)(?:/|$)',urlsplit(requested).path)
        redirected=re.search(r'/press-room/(\d{8}IPR\d+)(?:/|$)',urlsplit(actual).path)
        _canonical(actual,source,requested)
        if original and redirected and original[1]==redirected[1]:return
    elif canonical_url(expected,hosts)==actual:return
    if source=='ppc':
        # PPC article links omit the final slash, while the official server
        # redirects the same article to its slash-terminated canonical URL.
        _canonical(actual,source,requested)
        expected_path=urlsplit(expected).path.rstrip('/')
        actual_path=urlsplit(actual).path.rstrip('/')
        if expected_path==actual_path:return
    raise ValueError('detail_redirect_identity_mismatch')

def _bounded_frozen_cursor(cursor,source):
    from .core import canonical_url
    urls=cursor.get('frozen_urls')
    if not isinstance(urls,list) or not urls or not all(isinstance(u,str) for u in urls) or len(set(urls))!=len(urls):raise ValueError('expansion_frozen_cursor_invalid')
    for url in urls:_canonical(url,source,url)
    rows=cursor.get('frozen_rows')
    if rows is not None and (not isinstance(rows,list) or len(rows)!=len(urls) or
            any(not isinstance(row,dict) or row.get('url')!=url for row,url in zip(rows,urls))):
        raise ValueError('expansion_frozen_cursor_invalid')
    if type(cursor.get('offset')) is not int or not 0<=cursor['offset']<=len(urls):raise ValueError('expansion_frozen_cursor_invalid')
    if cursor.get('frozen_next') is not None:canonical_url(cursor['frozen_next'],[ROUTES[source]['host']])

def collect_frozen(config,client,store,since,until):
    """Freeze URL identities in the existing atomic DB cursor, one body per commit.

    Titles are read from the actual detail, not cached. A changed feed cannot
    reset a committed ordinal. There is no hand-picked page or URL-count cap.
    """
    from .core import fetch_listing,FetchError
    from . import parsers, extraction
    source=config['source'];cursor=store.resume(config,since,until) or {}
    result=dict(source=source,status='partial',reason=None,coverage_complete=False,since=since,until=until,discovered=0,new=0,changed=0,duplicate=0,held=0,failed=0,out_of_range=0,unknown_date=0,pages=0,excluded_unapproved_host_count=0)
    try:
        if 'frozen_urls' not in cursor:
            if source=='hk-pcpd':
                # The official ISD RSS is only a rolling, generic 100-item
                # window. Walk each public date archive in the requested
                # interval so a quiet day cannot hide earlier PCPD releases.
                start=dt.date.fromisoformat(since);day=dt.date.fromisoformat(until)
                rows=[];seen=set()
                while day>=start:
                    archive=f'https://www.info.gov.hk/gia/general/{day:%Y%m}/{day:%d}.htm'
                    page=listing_request_url(source,archive,since,until)
                    if page is None:break
                    day_rows,_=fetch_listing(source,client,page);result['pages']+=1
                    for row in day_rows:
                        if row['url'] not in seen:
                            seen.add(row['url']);rows.append(row)
                    day-=dt.timedelta(days=1)
                nxt=None
                page='https://www.info.gov.hk/gia/general/'+dt.date.fromisoformat(until).strftime('%Y%m/%d')+'.htm'
            else:
                page=listing_request_url(source,cursor.get('page') or config['listing'],since,until)
                if page is None:
                    store.progress(config,since,until,None);store.checkpoint(config,until)
                    result.update(listing_scan_complete=True,reason='official_date_archive_window_exhausted')
                    return result
                rows,nxt=fetch_listing(source,client,page);result['pages']=1
            if not rows:
                if source in ('vn-gov','g7-dpa','hk-pcpd'):
                    if nxt:
                        store.progress(config,since,until,dict(page=nxt,offset=0))
                        result.update(reason='source_page_without_relevant_items_continued')
                    else:
                        store.progress(config,since,until,None);store.checkpoint(config,until)
                        result.update(listing_scan_complete=True,reason='source_listing_exhausted_without_relevant_item')
                    return result
                if source=='ec':
                    if nxt:store.progress(config,since,until,dict(page=nxt,offset=0))
                    else:store.progress(config,since,until,None);store.checkpoint(config,until)
                    result.update(listing_scan_complete=not bool(nxt),reason='scoped_official_listing_empty')
                    return result
                raise ValueError('listing_empty_or_structure_changed')
            cursor=dict(page=page,offset=0,frozen_urls=[r['url'] for r in rows],
                        frozen_rows=rows,frozen_next=nxt)
        _bounded_frozen_cursor(cursor,source)
        urls=cursor['frozen_urls']
        per_run_page_drain=source in ('anpd-br','nist')
        while cursor['offset']<len(urls):
            ordinal=cursor['offset'];url=urls[ordinal]
            result['discovered']+=1
            row=cursor.get('frozen_rows',[{} for _ in urls])[ordinal]
            try:
                body,received,ctype=client.get(detail_request_url(source,url))
                verify_detail_response(source,url,received)
                item=extraction.extract_document(source,body,url,ctype,row)
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
            # Each article is persisted independently. Finish the frozen page
            # in this scheduled invocation so a multi-item page does not take
            # one daily run per article. Persist every ordinal before fetching
            # the next detail so interruption resumes without skipping items.
            store.progress(config,since,until,cursor)
            if not per_run_page_drain:
                break
        if cursor['offset']>=len(urls):
            if cursor['frozen_next']:
                store.progress(config,since,until,dict(page=cursor['frozen_next'],offset=0))
                result['reason']='frozen_listing_page_complete'
            else:
                store.progress(config,since,until,None);store.checkpoint(config,until)
                result.update(listing_scan_complete=True,reason='listing_exhaustiveness_unverified')
        else:
            result['reason']='frozen_listing_page_items_processed'
        return result
    except (FetchError,ValueError) as error:
        # No body was committed. Keep the exact persisted position for retry.
        store.progress(config,since,until,cursor or None)
        result.update(status='failed',reason=str(error),failed=1)
        return result

def _canonical(raw,source,base):
    from .core import canonical_url
    c=ROUTES[source]
    url=canonical_url(urljoin(base,raw),c.get('hosts',[c['host']]))
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
    if len(obs)!=1:return None
    meaning=obs[0].get('meaning')
    if meaning in ('expansion_listing_published','expansion_feed_publication'):return date(obs[0]['value'])
    if meaning=='listing_published_display' and row.get('source_type') in ('professional_publication','research_organization','civil_society_organization'):
        value=obs[0]['value']
        if row.get('source_name')=='IAPP':
            value=re.sub(r'\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.(?=\s+\d{4})',r'\1',value,re.I)
        if row.get('source_name')=='noyb':
            match=re.fullmatch(r'(\d{2})\.(\d{2})\.(\d{4})',value)
            if match:
                try:return dt.date(int(match[3]),int(match[2]),int(match[1])).isoformat()
                except ValueError:return None
        return date(value)
    return None

def next_within_window(source,rows,nxt,since):
    if not nxt or source not in ('oaic','ca-opc','anpd-br','nist','cn-tc260'):return nxt
    dates=[listing_date(r) for r in rows]
    if dates and all(dates) and all(dates[i]<=dates[i-1] for i in range(1,len(dates))) and dates[-1]<since:return None
    return nxt

def listing_date_boundary(source,rows,since):
    """Return a verifiable per-page date boundary, without claiming source-wide coverage."""
    if source not in ('oaic','ca-opc','anpd-br','nist','cn-tc260') or not rows:return None
    dates=[listing_date(row) for row in rows]
    if (not all(dates) or any(dates[index]>dates[index-1] for index in range(1,len(dates)))
            or dates[-1]>=since):
        return None
    return {'kind':'official_listing_date_order_boundary','first_date':dates[0],
            'last_date':dates[-1],'since':since,'rows':len(dates)}

def detail_request_url(source,url):
    if source not in ROUTES:return url
    url=_canonical(url,source,url)
    if source in PUBLICATION_SOURCE_IDS:return url
    if source=='anpd-br':
        path=urlsplit(url).path
        return 'https://www.gov.br/anpd/++api++'+path[len('/anpd'):]
    if source!='ec':return url
    code=urlsplit(url).path.rsplit('/',1)[1].replace('_','/').upper()
    return 'https://ec.europa.eu/commission/presscorner/api/documents?'+urlencode({'language':'en','reference':code})

def discover(source,html,url):
    from .parsers import normalize
    from .core import canonical_url
    c=ROUTES[source];canonical_url(url,c.get('hosts',[c['host']]));rows={}
    if source=='ftc' and html.lstrip('\ufeff \t\r\n').lower().startswith(('<?xml','<rss','<feed')):
        from .parsers import discover_rss
        return discover_rss(html,url)
    if source=='nl-ap':
        if not html.lstrip('\ufeff \t\r\n').lower().startswith(('<?xml','<rss','<feed')):
            raise ValueError('nl_ap_official_rss_expected')
        from .parsers import discover_rss
        parsed,nxt=discover_rss(html,url,keep_feed_text=True)
        for row in parsed:
            # RSS is only the official discovery index. Constrain each item to
            # the verified AP article URL shape before the caller follows it;
            # the later detail request goes through HttpClient.get(), which
            # checks the official robots rules before requesting the article.
            row['url']=_canonical(row['url'],source,url)
            row['rss_source']='nl-ap'
        return parsed,nxt
    if source=='eu-council':
        from .parsers import discover_rss
        parsed,_=discover_rss(html,url,keep_feed_text=True)
        for row in parsed:
            if not re.search(r'privacy|personal data|data protection|data breach|artificial intelligence|AI Act',row.get('title','')+' '+row.get('feed_text',''),re.I):continue
            row['rss_source']='eu-council'
            for observation in row.get('date_observations',[]):
                observation['meaning']='official_rss_published_iso'
            rows[row['url']]=row
        return list(rows.values()),None
    if source=='ico':
        # WiredGov is a cross-agency index. Keep only cards attributed to the
        # Information Commissioner's Office and retain its visible date.
        soup=BeautifulSoup(html,'html.parser')
        for a in soup.select('a.link-past-week[href*="/wg/news.nsf/articles/"]'):
            channel=a.select_one('.newsArticleChannel')
            if not channel or normalize(channel.get_text(' ',strip=True))!="Information Commissioner's Office":continue
            href=a.get('href','')
            target=_canonical(href,source,url)
            title_node=a.select_one('.newsArticleTitle')
            title=normalize(title_node.get_text(' ',strip=True) if title_node else a.get('title',''))
            if not title:raise ValueError('wiredgov_ico_title_missing')
            date_node=a.select_one('.newsArticleDate')
            date_text=normalize(date_node.get_text(' ',strip=True)) if date_node else ''
            date_match=re.search(r'\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b',date_text)
            row={'url':target,'title':title,'source_attribution':"Information Commissioner's Office"}
            if date_match:
                row['date_observations']=[{'meaning':'expansion_listing_published','locator':'WiredGov ICO card visible publication date','value':' '.join(date_match.groups())}]
            rows[target]=row
        if not rows:raise ValueError('wiredgov_ico_listing_no_attributed_items')
        return list(rows.values()),None
    if source=='hk-pcpd':
        soup=BeautifulSoup(html,'html.parser')
        archive=re.fullmatch(r'/gia/general/(\d{6})/(\d{2})\.htm',urlsplit(url).path)
        if not archive:raise ValueError('hk_pcpd_archive_day_unverified')
        for a in soup.select('li > a[href*="/gia/general/"]'):
            title=normalize(a.get_text(' ',strip=True))
            if not re.search(r'PCPD|Privacy Commissioner|personal data|privacy',title,re.I):continue
            target=_canonical(a.get('href',''),source,url)
            rows[target]={'url':target,'title':title,
                'date_observations':[{'meaning':'listing_archive_day','locator':'ISD official date archive URL','value':archive[1]+'-'+archive[2]}]}
        day=dt.date(int(archive[1][:4]),int(archive[1][4:]),int(archive[2]))
        previous=day-dt.timedelta(days=1)
        return list(rows.values()),f'https://www.info.gov.hk/gia/general/{previous:%Y%m}/{previous:%d}.htm'
    if source=='vn-gov' and urlsplit(url).path=='/':
        soup=BeautifulSoup(html,'html.parser');
        for a in soup.select('a.box-focus-link-title[data-linktype="newsdetail"][href]'):
            # Homepage focus areas can contain unrelated/non-story links.
            # Ignore those; only accept observed article URL shape.
            candidate=urljoin(url,a['href'])
            if urlsplit(candidate).hostname not in ROUTES[source].get('hosts',[ROUTES[source]['host']]) or not re.fullmatch(ROUTES[source]['article_path'],urlsplit(candidate).path):
                continue
            target=_canonical(candidate,source,url);title=normalize(a.get('title') or a.get_text(' ',strip=True))
            rows[target]={'url':target,'title':title}
        return list(rows.values()),'https://en.baochinhphu.vn/policies.htm'
    if source=='vn-gov' and urlsplit(url).path.startswith('/timelinelist/'):
        match=re.fullmatch(r'/timelinelist/(11151)/(\d+)\.htm',urlsplit(url).path)
        if not match:raise ValueError('vn_timeline_page_unverified')
        if not html.strip():return [],None
        soup=BeautifulSoup(html,'html.parser')
        for a in soup.select('div.box-category-item-sub h3.box-category-content a.box-category-link-title[data-linktype="newsdetail"][href]'):
            card=a.find_parent('div',class_='box-category-item-sub')
            title=normalize(a.get_text(' ',strip=True))
            target=_canonical(a['href'],source,url)
            row={'url':target,'title':title}
            date_node=card.select_one('.time-ago') if card else None
            if date_node:
                raw=normalize(date_node.get_text(' ',strip=True))
                if raw:row['date_observations']=[{'meaning':'listing_published_display','locator':'Vietnam policies timeline card time-ago','value':raw}]
            rows[target]=row
        page=int(match[2])
        if rows:return list(rows.values()),f'https://en.baochinhphu.vn/timelinelist/11151/{page+1}.htm'
        return [],None
    if source=='vn-gov' and urlsplit(url).path=='/policies.htm':
        soup=BeautifulSoup(html,'html.parser')
        zone=soup.select_one('#hdZoneId')
        if zone is None or zone.get('value')!='11151' or 'timeline.url' not in html or '/timelinelist/{0}/{1}.htm' not in html:
            raise ValueError('vn_timeline_contract_unverified')
        for a in soup.select('div.box-category-item-sub h3.box-category-content a.box-category-link-title[data-linktype="newsdetail"][href]'):
            target=_canonical(a['href'],source,url);title=normalize(a.get_text(' ',strip=True))
            if not title:raise ValueError('vn_listing_title_missing')
            rows[target]={'url':target,'title':title}
        if not rows:raise ValueError('vn_listing_empty_or_structure_changed')
        return list(rows.values()),'https://en.baochinhphu.vn/timelinelist/11151/2.htm'
    if source=='hk-pcpd' and urlsplit(url).path.startswith('/gia/rss/'):
        rows,nxt=__import__('scripts.collector.parsers',fromlist=['discover_rss']).discover_rss(html,url)
        rows=[row for row in rows if re.search(r'PCPD|Privacy Commissioner|personal data',row.get('title','')+' '+row.get('feed_text',''),re.I)]
        return rows,nxt
    if source=='g7-dpa':
        soup=BeautifulSoup(html,'html.parser')
        for a in soup.select('a[href*="/opc-news/speeches-and-statements/2026/"]'):
            text=normalize(a.get_text(' ',strip=True))
            href=a.get('href','')
            if not re.search(r'\bG7\b|Group of Seven|communique-g7',text+' '+href,re.I):continue
            target=_canonical(a['href'],source,url);title=normalize(a.get_text(' ',strip=True))
            if title:rows[target]={'url':target,'title':title}
        if not rows:raise ValueError('opc_g7_hub_has_no_verified_2026_deliverable')
        return list(rows.values()),None
    if source in PUBLICATION_SOURCE_IDS:
        from .publication_route_candidates import discover_publication_route_candidates
        rows=discover_publication_route_candidates(source,html,url)
        return rows,None
    if source=='anpd-br':
        parsed=urlsplit(url);query=parse_qs(parsed.query,keep_blank_values=True)
        expected={'portal_type':['News Item'],'path':['/pt-br/assuntos/noticias'],
                  'sort_on':['effective'],'sort_order':['descending']}
        size_values=query.pop('b_size',[]);start_values=query.pop('b_start',['0'])
        if (parsed.path!='/anpd/++api++/@search' or query!=expected or
                len(size_values)!=1 or not size_values[0].isdigit() or
                len(start_values)!=1 or not start_values[0].isdigit()):
            raise ValueError('anpd_listing_query_unverified')
        size=int(size_values[0]);start=int(start_values[0])
        if not 1<=size<=100 or start<0 or start%size:
            raise ValueError('anpd_listing_page_unverified')
        try:data=json.loads(html)
        except (TypeError,json.JSONDecodeError) as error:raise ValueError('anpd_listing_json_invalid') from error
        if not isinstance(data,dict):raise ValueError('anpd_listing_schema_changed')
        total=data.get('items_total');items=data.get('items')
        if type(total) is not int or total<0 or not isinstance(items,list):
            raise ValueError('anpd_listing_schema_changed')
        expected_count=max(0,min(size,total-start))
        if len(items)!=expected_count:
            raise ValueError('anpd_listing_page_incomplete')
        for item in items:
            if (not isinstance(item,dict) or item.get('@type')!='News Item' or
                    item.get('review_state')!='published' or
                    not isinstance(item.get('title'),str) or
                    not isinstance(item.get('effective'),str)):
                raise ValueError('anpd_listing_item_schema_changed')
            target=_canonical(item.get('@id',''),source,url)
            observed=date(item['effective'])
            if not observed:
                raise ValueError('anpd_listing_effective_date_missing')
            rows[target]={'url':target,'title':normalize(item['title']),
                'date_observations':[{'meaning':'expansion_listing_published',
                    'locator':'ANPD public REST API item effective','value':item['effective']}],
                'source_description':normalize(item.get('description',''))}
        nxt=None
        if start+len(items)<total:
            params={'portal_type':'News Item','path':'/pt-br/assuntos/noticias',
                    'sort_on':'effective','sort_order':'descending',
                    'b_size':str(size),'b_start':str(start+len(items))}
            nxt='https://www.gov.br/anpd/++api++/@search?'+urlencode(params)
        return list(rows.values()),nxt
    if source=='iso-iec-sc27':
        from .pdf_source_routes import discover_pdf_links
        discovered=discover_pdf_links(source,html,url)
        return [{'url':row['url'],'title':row['title'],
                 'date_observations':row.get('date_observations',[]),
                 'discovered_from':row['discovered_from']} for row in discovered],None
    def add(raw,title,value=None,locator='',meaning='expansion_listing_published'):
        target=_canonical(raw,source,url)
        if not normalize(title):raise ValueError('listing_title_missing')
        rows[target]={'url':target,'title':normalize(title)}
        if value:
            observed_locator='FTC search result time[datetime]' if source=='ftc' else source+' '+locator
            rows[target]['date_observations']=[{'meaning':meaning,'locator':observed_locator,'value':normalize(value)}]
    if c.get('json_api'):
        data=json.loads(html);params=parse_qs(urlsplit(url).query);page=int(params.get('pagenumber',['1'])[0]);size=int(params.get('pagesize',['100'])[0])
        response_page=data.get('pageNumber')
        # Presscorner accepts one-based `pagenumber` requests but its JSON
        # response has been observed to report a zero-based `pageNumber`.
        # Accept only those two exact conventions; never ignore a mismatch.
        if (type(data.get('totalNumber')) is not int or data['totalNumber']<0 or type(response_page) is not int or response_page not in (page,page-1) or data.get('pageSize')!=size or not isinstance(data.get('docuLanguageListResources'),list) or len(data['docuLanguageListResources'])!=max(0,min(size,data['totalNumber']-(page-1)*size))):raise ValueError('ec_listing_schema_or_page_changed')
        for row in data['docuLanguageListResources']:
            if not isinstance(row.get('refCode'),str) or not isinstance(row.get('title'),str):raise ValueError('ec_listing_schema_changed')
            # Presscorner has used both slash-delimited publication references
            # and opaque numeric identifiers. Preserve the official article
            # URL only for known reference families, while allowing additional
            # two-letter document classes as the registry expands.
            if not re.fullmatch(r'(?:[A-Z]{2,12})/\d{2}/\d+',row['refCode'],re.I):raise ValueError('ec_listing_document_type_unverified')
            event_date=row.get('eventDate')
            add('/commission/presscorner/detail/en/'+row['refCode'].lower().replace('/','_'),row['title'],event_date if isinstance(event_date,str) else None,'EC API eventDate')
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
            if source=='ca-opc' and (urlsplit(target).hostname!=c['host'] or not re.fullmatch(c['article_path'],urlsplit(target).path)):continue
            if urlsplit(target).hostname==c['host'] and not re.fullmatch(c['article_path'],urlsplit(target).path):continue
            card_selector=c.get('card')
            if card_selector and re.fullmatch(r'[a-zA-Z][\w-]*(?:\.[\w-]+)+',card_selector):
                # Drupal cards commonly have a tag plus multiple classes, e.g.
                # ``article.node--view-mode-teaser``. Passing that string as
                # ``find_parent(tag_name)`` silently misses every card, while
                # treating the whole selector as one class also misses it.
                required_classes=card_selector.split('.')[1:]
                card=a.find_parent(lambda node: node.name==card_selector.split('.',1)[0] and
                                   all(name in (node.get('class') or []) for name in required_classes))
            elif card_selector and card_selector.startswith('.'):
                required_classes=[name for name in card_selector.split('.') if name]
                card=a.find_parent(lambda node: all(name in (node.get('class') or []) for name in required_classes))
            else:
                card=a.find_parent(card_selector) if card_selector else None
            title=a.get_text(' ',strip=True)
            if card and c.get('card_title'):
                title_node=card.select_one(c['card_title'])
                if title_node is not None:
                    title=title_node.get_text(' ',strip=True)
            node=card.select_one(c['card_date']) if card and c.get('card_date') else None
            if source=='ca-opc' and node is None:
                for parent in a.parents:
                    candidate=parent.select_one('time.item-date, time[datetime]')
                    if candidate is not None:
                        node=candidate;break
            card_value=None
            if node:
                attribute=c.get('card_date_attribute')
                card_value=node.get(attribute) if attribute else None
                if not card_value:card_value=node.get_text(' ',strip=True)
            add(raw,title,card_value,c.get('card_date',''))
        node=soup.select_one(c['next']) if c.get('next') else None
        nxt=canonical_url(urljoin(url,node['href']),c.get('hosts',[c['host']])) if node else None
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
    from . import parsers
    normalize=parsers.normalize
    c=ROUTES[source];_canonical(url,source,url);observations=[]
    if source in PUBLICATION_SOURCE_IDS:
        from .parsers import extract_publication_document
        return extract_publication_document(source,input.encode('utf-8'),url,'text/html',row)
    if source=='anpd-br':
        try:data=json.loads(input)
        except (TypeError,json.JSONDecodeError) as error:raise ValueError('anpd_detail_json_invalid') from error
        if (not isinstance(data,dict) or data.get('@type')!='News Item' or
                data.get('review_state')!='published' or
                not isinstance(data.get('title'),str) or not isinstance(data.get('effective'),str)):
            raise ValueError('anpd_detail_schema_changed')
        target=_canonical(data.get('@id',''),source,url)
        if target!=url:
            raise ValueError('anpd_detail_identity_mismatch')
        block_layout=data.get('blocks_layout')
        if not isinstance(block_layout,dict):raise ValueError('anpd_detail_blocks_missing')
        layout=block_layout.get('items')
        blocks=data.get('blocks')
        if not isinstance(layout,list) or not isinstance(blocks,dict) or not layout:
            raise ValueError('anpd_detail_blocks_missing')
        paragraphs=[]
        for block_id in layout:
            if not isinstance(block_id,str) or block_id not in blocks:
                raise ValueError('anpd_detail_block_reference_missing')
            block=blocks[block_id]
            if not isinstance(block,dict):raise ValueError('anpd_detail_block_schema_changed')
            text=block.get('plaintext')
            if block.get('@type')=='slate' and isinstance(text,str):
                value=normalize(text)
                # The Plone page stores its trailing related-link rail as a
                # slate block; keep the article prose and exclude that rail.
                if value.casefold().startswith('leia também'):
                    continue
                if value:paragraphs.append(value)
        body='\n'.join(paragraphs)
        if len(body)<10:raise ValueError('anpd_detail_body_empty')
        published=date(data['effective'])
        if not published:raise ValueError('anpd_detail_effective_date_invalid')
        observations.append({'meaning':'official_published_attribute',
            'locator':'ANPD public REST API News Item effective','value':data['effective']})
        if row:
            listed=listing_date(row)
            if listed and listed!=published:raise ValueError('anpd_detail_listing_date_mismatch')
        body=normalize(body)
        return {'title_original':normalize(data['title']),'content_text':body,
            'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,
            'metadata':{'normalization_version':'main-body-nfc-v1','parser_version':'anpd-plone-rest-v1',
                'read_scope':'official_news_item_body','date_observations':observations,
                'requires_review':True,'related_documents':[],'unread_attachments':[],
                'factual_status':'official_agency_news_not_independently_reviewed',
                'relevance_reason':'official_personal_data_protection_authority_news_human_relevance_review_pending',
                'ai_ready':False,'extraction_method':'official_plone_rest_api'}}
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
    for n in soup.select(c['date']) if c.get('date') else []:
        value=n.get(c['date_attribute']) if c.get('date_attribute') else n.get_text(' ',strip=True)
        if value:observations.append({'meaning':'official_published_attribute','locator':c['date'],'value':normalize(value)})
    if source=='jpdp-my' and row and row.get('date_observations'):
        # Elementor's visible listing date is the authoritative publication
        # date for this route. Preserve and reconcile it with any explicit
        # detail date rather than silently dropping it on HTML-only items.
        observations.extend(observation for observation in row['date_observations']
                            if observation not in observations)
    if source=='g7-dpa':
        issued=soup.select_one('meta[name="dcterms.issued"][content]')
        if issued and issued.get('content'):
            observations.append({'meaning':'official_published_attribute',
                'locator':'meta dcterms.issued','value':normalize(issued['content'])})
    if source=='ftc' and row and row.get('date_observations'):
        observations.extend(row['date_observations'])
    dates={date(x['value']) for x in observations}-{None}
    listed=(parsers.ftc_listing_date(row or {}) if source=='ftc' else listing_date(row) if row else None)
    if listed:dates.add(listed)
    published=next(iter(dates)) if len(dates)==1 else None
    conflict=len(dates)>1 or bool(published and listed and published!=listed)
    nist_review=source=='nist'
    vn_review=source=='vn-gov'
    requires_review=not published or conflict or nist_review or vn_review
    date_evidence=(observations if source=='jpdp-my' else
                   observations+(row or {}).get('date_observations',[]))
    return {'title_original':normalize(title.get_text(' ',strip=True)),'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),'published_date':published,'metadata':{'normalization_version':'main-body-nfc-v1','parser_version':'expansion-v1','read_scope':'official_press_or_news_body','date_observations':date_evidence,'date_conflict':conflict,'requires_review':requires_review,'related_documents':related,'unread_attachments':[r['url'] for r in related],'factual_status':'official_nist_news_not_independently_reviewed' if nist_review else 'official_government_news_not_independently_reviewed' if vn_review else 'original_statement_not_independent_legal_finding','relevance_reason':'NIST item relevance requires human confirmation' if nist_review else 'Vietnam policies feed body relevance requires human confirmation' if vn_review else None,'ai_ready':bool(published) and not requires_review}}
