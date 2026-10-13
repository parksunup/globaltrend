import datetime as dt
import email.utils
import json
import hashlib
import time
import urllib.error
import urllib.request
import urllib.robotparser
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode
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
        return super().redirect_request(req,fp,code,msg,headers,newurl)

class HttpClient:
    def __init__(self,hosts,interval=2,budget=None):
        self.hosts=set(hosts); self.interval=interval; self.requests=0; self.last=0; self.robots={}
        self.opener=urllib.request.build_opener(SafeRedirect(self.hosts))
        self.started=time.monotonic()
        self.budget=budget if budget is not None else {'requests':0,'bytes':0,'started':self.started}
    def request(self,url,method='GET',payload=None,headers=None):
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
                if e.code in (429,500,502,503,504) and attempt<2:
                    time.sleep(retry_delay(e.headers.get('Retry-After'))); continue
                raise FetchError('http_'+str(e.code)) from None
            except (urllib.error.URLError,TimeoutError,OSError,ValueError) as e:
                # Do not include credentials or proxy URLs in logs.
                if isinstance(e,urllib.error.URLError) and 'Tunnel connection failed: 403' in str(e.reason):
                    raise FetchError('network_policy_denied_403') from None
                raise FetchError('network_or_redirect_failure:'+type(e).__name__) from None
    def get(self,url):
        url=canonical_url(url,self.hosts); origin='https://'+urlsplit(url).hostname
        if origin not in self.robots:
            data,_,_=self.request(origin+'/robots.txt')
            robot=urllib.robotparser.RobotFileParser(); robot.parse(data.decode('utf-8','replace').splitlines())
            self.robots[origin]=robot
            self.interval=max(self.interval,robot.crawl_delay('GlobalTrendResearch') or robot.crawl_delay('*') or 0)
        if not self.robots[origin].can_fetch('GlobalTrendResearch',url): raise FetchError('robots_disallowed')
        return self.request(url)

def collect(config,client,store,since,until,max_pages=10,max_items=30):
    result={'source':config['source'],'status':'held','reason':None,'coverage_complete':False,'since':since,'until':until,
            'discovered':0,'new':0,'changed':0,'duplicate':0,'held':0,'failed':0,'out_of_range':0,'unknown_date':0,'pages':0}
    if not config.get('enabled') or not all(config.get('permissions',{}).get(k) for k in ('collect','store','ai')):
        result['reason']='source_permissions_or_operation_unapproved'; return result
    if config['source'] in ('pdpc','ico','curia'):
        result['reason']='adapter_pending_live_verification'; return result
    cursor=store.resume(config,since,until) if hasattr(store,'resume') else None
    seen_pages=set(); seen_items=set(); page=(cursor or {}).get('page') or config['listing']; next_page=None
    had_pagination=(cursor or {}).get('had_pagination',False); prior_failures=(cursor or {}).get('failures',0)
    result['status']='partial'
    try:
        while page:
            page=canonical_url(page,set(config['hosts']))
            if page in seen_pages or result['pages']>=max_pages: raise FetchError('pagination_cycle_or_page_limit')
            seen_pages.add(page); data,final,_=client.get(page); result['pages']+=1
            rows,next_page=parsers.discover(config['source'],data.decode('utf-8','replace'),final)
            if not rows: raise FetchError('listing_empty_or_structure_changed')
            had_pagination=had_pagination or bool(next_page)
            fingerprint=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
            start=(cursor or {}).get('offset',0) if (cursor or {}).get('fingerprint')==fingerprint else 0
            for index,row in enumerate(rows):
                if index<start: continue
                url=canonical_url(row['url'],set(config['hosts']))
                if url in seen_items: continue
                if len(seen_items)>=max_items: raise FetchError('document_limit')
                seen_items.add(url); result['discovered']+=1
                try:
                    body,detail,ctype=client.get(url)
                    if ctype not in ('text/html','application/xhtml+xml'): raise ValueError('unsupported_document_type')
                    item=parsers.extract(config['source'],body.decode('utf-8','replace'),detail)
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
                    if str(e).startswith('database_'): raise
                    result['failed']+=1
                    store.discovery_failure(config,url,row.get('title'),str(e))
                if hasattr(store,'progress'):
                    store.progress(config,since,until,{'page':page,'offset':index+1,'fingerprint':fingerprint,
                        'had_pagination':had_pagination,'failures':prior_failures+result['failed']})
            page=next_page
            cursor=None
            if hasattr(store,'progress'):
                store.progress(config,since,until,{'page':page,'offset':0,'had_pagination':had_pagination,'failures':prior_failures+result['failed']} if page else None)
        result['coverage_complete']=had_pagination and result['failed']==0 and prior_failures==0
        result['status']='success' if result['coverage_complete'] else 'partial'
        result['reason']=None if result['coverage_complete'] else 'listing_exhaustiveness_unverified_or_detail_failure'
        if result['coverage_complete']: store.checkpoint(config,until)
    except (FetchError,ValueError) as e:
        result['status']='failed'; result['reason']=str(e); result['coverage_complete']=False
    return result
