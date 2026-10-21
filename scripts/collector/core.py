import datetime as dt
import email.utils
import json
import hashlib
import time
import urllib.error
import urllib.request
import urllib.robotparser
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode,urljoin
from . import parsers

MAX_BYTES=2_000_000
MAX_REQUESTS=100
class FetchError(Exception): pass

def canonical_url(url,hosts):
    p=urlsplit(url)
    if p.scheme!='https' or p.hostname not in hosts or p.username or p.password or p.port not in (None,443):
        raise ValueError('URL outside approved official hosts')
    query=[(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid','gclid')]
    return urlunsplit(('https',p.hostname,p.path or '/',urlencode(sorted(query)),''))

def is_unapproved_https_host(url,hosts):
    try: parsed=urlsplit(url)
    except ValueError: return False
    return parsed.scheme=='https' and parsed.hostname not in hosts and not parsed.username and not parsed.password and parsed.port in (None,443)

def read_limited(stream,limit=MAX_BYTES):
    result=bytearray()
    while True:
        block=stream.read(min(65536,limit+1-len(result)))
        if not block: return bytes(result)
        result.extend(block)
        if len(result)>limit: raise FetchError('response_size_limit')

def retry_delay(value):
    try: delay=float(value)
    except (TypeError,ValueError):
        try: delay=(email.utils.parsedate_to_datetime(value)-dt.datetime.now(dt.timezone.utc)).total_seconds()
        except Exception: delay=2
    return max(0,min(60,delay))

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self,hosts): self.hosts=set(hosts)
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        canonical_url(newurl,self.hosts)
        # Return the redirect to HttpClient so robots, rate and request limits
        # apply to each hop instead of urllib following it inside one open().
        return None

class HttpClient:
    def __init__(self,hosts,interval=2,budget=None):
        self.hosts=set(hosts); self.interval=interval; self.requests=0; self.last=0; self.robots={}
        self.opener=urllib.request.build_opener(SafeRedirect(self.hosts))
        self.started=time.monotonic()
        self.budget=budget if budget is not None else {'requests':0,'bytes':0,'started':self.started}
    def request(self,url,method='GET',payload=None,headers=None,enforce_robots=False,_redirects=0):
        url=canonical_url(url,self.hosts)
        for attempt in range(3):
            if self.budget['requests']>=MAX_REQUESTS or time.monotonic()-self.budget['started']>600: raise FetchError('request_or_runtime_limit')
            time.sleep(max(0,self.last+self.interval-time.monotonic()))
            self.last=time.monotonic(); self.requests+=1
            self.budget['requests']+=1
            request=urllib.request.Request(url,data=payload,method=method,headers={'User-Agent':'GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)',**(headers or {})})
            try:
                with self.opener.open(request,timeout=20) as response:
                    if int(response.headers.get('Content-Length','0'))>MAX_BYTES: raise FetchError('response_size_limit')
                    data=read_limited(response);self.budget['bytes']+=len(data)
                    return data,response.url,response.headers.get_content_type()
            except urllib.error.HTTPError as e:
                if e.code in (301,302,303,307,308):
                    if _redirects>=5 or not e.headers.get('Location'):
                        e.close(); raise FetchError('redirect_limit_or_location_missing') from None
                    try: target=canonical_url(urljoin(url,e.headers['Location']),self.hosts)
                    except ValueError:
                        e.close(); raise FetchError('network_or_redirect_failure:ValueError') from None
                    status=e.code; e.close()
                    if enforce_robots: self.check_robots(target)
                    if status==303 and method!='HEAD' or status in (301,302) and method=='POST':
                        method='GET'; payload=None
                    return self.request(target,method,payload,headers,enforce_robots,_redirects+1)
                if e.code in (429,500,502,503,504) and attempt<2:
                    time.sleep(retry_delay(e.headers.get('Retry-After'))); continue
                raise FetchError('http_'+str(e.code)) from None
            except (urllib.error.URLError,TimeoutError,OSError,ValueError) as e:
                # Do not include credentials or proxy URLs in logs.
                if isinstance(e,urllib.error.URLError) and 'Tunnel connection failed: 403' in str(e.reason):
                    raise FetchError('network_policy_denied_403') from None
                raise FetchError('network_or_redirect_failure:'+type(e).__name__) from None
    def check_robots(self,url):
        url=canonical_url(url,self.hosts); origin='https://'+urlsplit(url).hostname
        if origin not in self.robots:
            try: data,_,_=self.request(origin+'/robots.txt')
            except FetchError as e: raise FetchError('robots_fetch_failed:'+str(e)) from None
            robot=urllib.robotparser.RobotFileParser(); robot.parse(data.decode('utf-8','replace').splitlines())
            self.robots[origin]=robot
            self.interval=max(self.interval,robot.crawl_delay('GlobalTrendResearch') or robot.crawl_delay('*') or 0)
        if not self.robots[origin].can_fetch('GlobalTrendResearch',url): raise FetchError('robots_disallowed')
        return url
    def get(self,url):
        url=self.check_robots(url)
        return self.request(url,enforce_robots=True)
    def post(self,url,payload,headers):
        url=self.check_robots(url)
        return self.request(url,'POST',payload,headers,enforce_robots=True)

def fetch_listing(source,client,page):
    def fetch(url,method='GET',payload=None):
        return client.post(url,payload,{'Content-Type':'application/json'}) if method=='POST' else client.get(url)
    data,final,ctype=fetch(page)
    is_pdpc_api=source=='pdpc' and urlsplit(final).path=='/api/listing-api' and ctype in ('application/json','text/plain')
    if is_pdpc_api:
        return parsers.discover_pdpc_listing(data,final,parsers.pdpc_api_page_number(final))
    if ctype not in ('text/html','application/xhtml+xml','application/rss+xml','text/xml','application/xml'):
        raise ValueError('unsupported_listing_type')
    return parsers.discover_listing(source,data.decode('utf-8','replace'),final,fetch)

def collect(config,client,store,since,until,max_pages=10,max_items=30):
    result={'source':config['source'],'status':'held','reason':None,'coverage_complete':False,'since':since,'until':until,
            'discovered':0,'new':0,'changed':0,'duplicate':0,'held':0,'failed':0,'out_of_range':0,'unknown_date':0,
            'excluded_unapproved_host_count':0,'pages':0}
    if not config.get('enabled') or not all(config.get('permissions',{}).get(k) for k in ('collect','store','ai')):
        result['reason']='source_permissions_or_operation_unapproved'; return result
    cursor=store.resume(config,since,until) if hasattr(store,'resume') else None
    seen_pages=set(); seen_items=set(); seen_listing_urls=set(); seen_fingerprints=set()
    page=(cursor or {}).get('page') or config['listing']; next_page=None
    had_pagination=(cursor or {}).get('had_pagination',False); prior_failures=(cursor or {}).get('failures',0); prior_unknown_dates=(cursor or {}).get('unknown_dates',0)
    prior_excluded_hosts=(cursor or {}).get('excluded_unapproved_host_count',0)
    result['status']='partial'
    try:
        while page:
            page=canonical_url(page,set(config['hosts']))
            if page in seen_pages: raise FetchError('pagination_cycle')
            if result['pages']>=max_pages: raise FetchError('page_limit')
            seen_pages.add(page); rows,next_page=fetch_listing(config['source'],client,page); result['pages']+=1
            if not rows: raise FetchError('listing_empty_or_structure_changed')
            had_pagination=had_pagination or bool(next_page)
            fingerprint=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
            listing_urls=[]
            for row in rows:
                try: listing_urls.append(canonical_url(row['url'],set(config['hosts'])))
                except ValueError:
                    if config['source']!='pdpc' or not is_unapproved_https_host(row['url'],set(config['hosts'])): raise
            if fingerprint in seen_fingerprints or config['source'] in ('ico','pdpc') and (
                len(set(listing_urls))!=len(listing_urls) or seen_listing_urls.intersection(listing_urls)):
                raise FetchError('listing_repeated_or_duplicate_items')
            seen_fingerprints.add(fingerprint); seen_listing_urls.update(listing_urls)
            start=(cursor or {}).get('offset',0) if (cursor or {}).get('fingerprint')==fingerprint else 0
            for index,row in enumerate(rows):
                if index<start: continue
                try: url=canonical_url(row['url'],set(config['hosts']))
                except ValueError:
                    if config['source']!='pdpc' or not is_unapproved_https_host(row['url'],set(config['hosts'])): raise
                    result['excluded_unapproved_host_count']+=1
                    if hasattr(store,'progress'):
                        store.progress(config,since,until,{'page':page,'offset':index+1,'fingerprint':fingerprint,
                            'had_pagination':had_pagination,'failures':prior_failures,
                            'unknown_dates':prior_unknown_dates+result['unknown_date'],
                            'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count']})
                    continue
                if url in seen_items: continue
                if len(seen_items)>=max_items: raise FetchError('document_limit')
                seen_items.add(url); result['discovered']+=1
                try:
                    body,detail,ctype=client.get(url)
                    item=parsers.extract_document(config['source'],body,detail,ctype,row)
                    date=item['published_date']
                    if date and not since<=date<=until:
                        result['out_of_range']+=1
                    else:
                        if date is None: result['unknown_date']+=1
                        # Eligibility is not a positive relevance decision or human approval.
                        item['metadata'].update({'relevance_reason':'full_body_available_human_relevance_review_pending','ai_ready':date is not None,
                            'pr16_commit':'547a83611cad948439598e2974e7ce8afd10781d'})
                        saved=store.ingest(config,url,item)
                        key='new' if saved.get('item_created') else 'changed' if saved.get('content_changed') else 'duplicate'
                        result[key]+=1
                        if date is None: result['held']+=1
                except (FetchError,ValueError) as e:
                    result['failed_url']=url
                    if str(e).startswith('database_'): raise
                    result['failed']+=1
                    store.discovery_failure(config,url,row.get('title'),str(e))
                    # Persist the failing item's position, then stop. A future run
                    # retries it; advancing the offset would silently skip it.
                    if hasattr(store,'progress'):
                        store.progress(config,since,until,{'page':page,'offset':index,'fingerprint':fingerprint,
                            'had_pagination':had_pagination,'failures':prior_failures,
                            'unknown_dates':prior_unknown_dates+result['unknown_date'],
                            'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count']})
                    raise FetchError('detail_failure:'+str(e)) from None
                if hasattr(store,'progress'):
                    store.progress(config,since,until,{'page':page,'offset':index+1,'fingerprint':fingerprint,
                        'had_pagination':had_pagination,'failures':prior_failures+result['failed'],'unknown_dates':prior_unknown_dates+result['unknown_date'],
                        'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count']})
            page=next_page
            cursor=None
            if hasattr(store,'progress'):
                store.progress(config,since,until,{'page':page,'offset':0,'had_pagination':had_pagination,'failures':prior_failures+result['failed'],'unknown_dates':prior_unknown_dates+result['unknown_date'],
                    'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count']} if page else None)
        result['coverage_complete']=had_pagination and result['failed']==0 and prior_failures==0 and result['unknown_date']==0 and prior_unknown_dates==0 and prior_excluded_hosts==0 and result['excluded_unapproved_host_count']==0
        result['status']='success' if result['coverage_complete'] else 'partial'
        result['reason']=None if result['coverage_complete'] else ('unapproved_external_listing_links' if prior_excluded_hosts or result['excluded_unapproved_host_count'] else 'listing_exhaustiveness_unverified_or_unknown_date_or_detail_failure')
        if result['coverage_complete']: store.checkpoint(config,until)
    except (FetchError,ValueError) as e:
        # Ordinary batch boundaries preserve the cursor for the next run. They
        # do not establish complete coverage, but are not collection failures.
        result['status']='partial' if str(e) in ('document_limit','page_limit') else 'failed'
        result['reason']=str(e); result['coverage_complete']=False
    return result
