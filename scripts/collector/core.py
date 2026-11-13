import datetime as dt
import asyncio
import atexit
import email.utils
from email.message import Message
import json
import hashlib
import threading
import time
from datetime import timedelta
from urllib.parse import urlsplit,urlunsplit,parse_qsl,parse_qs,urlencode,urljoin
from . import parsers
from . import expansion
from . import extraction

OECD_NEWSROOM_LISTING='https://www.oecd.org/en/about/newsroom.html'
class FetchError(Exception): pass

def canonical_url(url,hosts):
    p=urlsplit(url)
    if p.scheme!='https' or p.hostname not in hosts or p.username or p.password or p.port not in (None,443):
        raise ValueError('URL outside approved official hosts')
    query=[(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid','gclid')]
    return urlunsplit(('https',p.hostname,p.path or '/',urlencode(sorted(query)),''))

def canonical_redirect_url(url,hosts):
    """Accept an HTTP-to-HTTPS upgrade only on the same approved host."""
    p=urlsplit(url)
    if p.scheme=='http' and p.hostname in hosts and not p.username and not p.password and p.port in (None,80):
        url=urlunsplit(('https',p.hostname,p.path or '/',p.query,''))
    return canonical_url(url,hosts)

def is_unapproved_https_host(url,hosts):
    try: parsed=urlsplit(url)
    except ValueError: return False
    return parsed.scheme=='https' and parsed.hostname not in hosts and not parsed.username and not parsed.password and parsed.port in (None,443)

def read_limited(stream,limit=None):
    result=bytearray()
    while True:
        block=stream.read(65536 if limit is None else min(65536,limit+1-len(result)))
        if not block: return bytes(result)
        result.extend(block)
        if limit is not None and len(result)>limit: raise FetchError('response_size_limit')

def retry_delay(value):
    try: delay=float(value)
    except (TypeError,ValueError):
        try: delay=(email.utils.parsedate_to_datetime(value)-dt.datetime.now(dt.timezone.utc)).total_seconds()
        except Exception: delay=2
    return max(0,delay)

_HTTP_CLIENTS=set()

def _close_http_clients():
    for client in tuple(_HTTP_CLIENTS):
        try: client.close()
        except Exception: pass

atexit.register(_close_http_clients)

class HttpClient:
    def __init__(self,hosts,interval=2,budget=None,request_timeout_seconds=None):
        self.hosts=set(hosts); self.interval=interval; self.requests=0; self.last=0; self.robots={}
        self.robots_unavailable=[]
        self._transport=None; self._loop=None; self._thread=None; self._ready=None; self._transport_lock=threading.Lock()
        if request_timeout_seconds is not None and request_timeout_seconds<=0:
            raise ValueError('request_timeout_seconds_must_be_positive')
        self.request_timeout_seconds=request_timeout_seconds
        self.started=time.monotonic()
        self.budget=budget if budget is not None else {'requests':0,'bytes':0,'started':self.started}
        _HTTP_CLIENTS.add(self)

    def _start_transport(self):
        """Lazily host Crawlee's async HTTPX client on one persistent event loop.

        The collector's public API is synchronous. Keeping Crawlee on a private
        loop lets existing callers use it without creating a new connection pool
        for every request or reusing an async client across different loops.
        """
        if self._loop is not None:
            return
        with self._transport_lock:
            if self._loop is not None:
                return
            self._ready=threading.Event()
            def serve():
                loop=asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                self._loop=loop
                self._ready.set()
                loop.run_forever()
                pending=asyncio.all_tasks(loop)
                for task in pending: task.cancel()
                if pending: loop.run_until_complete(asyncio.gather(*pending,return_exceptions=True))
                loop.close()
            self._thread=threading.Thread(target=serve,name='globaltrend-crawlee-http',daemon=True)
            self._thread.start()
            self._ready.wait()
            self._run_async(self._initialize_transport())

    async def _initialize_transport(self):
        from crawlee.http_clients import HttpxHttpClient
        # Redirects are disabled in Crawlee because this collector must validate
        # and apply robots/rate/request checks before every redirect hop.
        self._transport=HttpxHttpClient(
            follow_redirects=False,
            header_generator=None,
            timeout=self.request_timeout_seconds,
        )

    def _run_async(self,coroutine):
        self._start_transport()
        return asyncio.run_coroutine_threadsafe(coroutine,self._loop).result()

    async def _stream_once(self,url,method,payload,headers):
        operation=self._stream_once_body(url,method,payload,headers)
        if self.request_timeout_seconds is None:
            return await operation
        return await asyncio.wait_for(operation,timeout=self.request_timeout_seconds)

    async def _stream_once_body(self,url,method,payload,headers):
        async with self._transport.stream(
            url,method=method,headers=headers,payload=payload,
            timeout=timedelta(seconds=self.request_timeout_seconds) if self.request_timeout_seconds is not None else None
        ) as response:
            response_headers=dict(response.headers)
            if response.status_code in (301,302,303,307,308) or response.status_code>=300:
                return response.status_code,response_headers,b''
            body=bytearray()
            async for block in response.read_stream():
                body.extend(block)
            return response.status_code,response_headers,bytes(body)

    @staticmethod
    def _header(headers,name):
        return next((value for key,value in headers.items() if key.lower()==name.lower()),None)

    def request(self,url,method='GET',payload=None,headers=None,enforce_robots=False,_redirects=0,include_response_headers=False):
        url=canonical_url(url,self.hosts)
        for attempt in range(3):
            time.sleep(max(0,self.last+self.interval-time.monotonic()))
            self.last=time.monotonic(); self.requests+=1
            self.budget['requests']+=1
            request_headers={'User-Agent':'GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)',**(headers or {})}
            try:
                status,response_headers,data=self._run_async(self._stream_once(url,method,payload,request_headers))
                if status in (301,302,303,307,308):
                    location=self._header(response_headers,'Location')
                    if _redirects>=5 or not location:
                        raise FetchError('redirect_limit_or_location_missing')
                    try: target=canonical_redirect_url(urljoin(url,location),self.hosts)
                    except ValueError:
                        raise FetchError('network_or_redirect_failure:ValueError') from None
                    if enforce_robots: self.check_robots(target)
                    if status==303 and method!='HEAD' or status in (301,302) and method=='POST':
                        method='GET'; payload=None
                    return self.request(target,method,payload,headers,enforce_robots,_redirects+1,include_response_headers)
                if status in (429,500,502,503,504) and attempt<2:
                    time.sleep(retry_delay(self._header(response_headers,'Retry-After'))); continue
                if status>=300:
                    raise FetchError('http_'+str(status))
                self.budget['bytes']+=len(data)
                message=Message()
                content_type=self._header(response_headers,'Content-Type')
                if content_type: message['Content-Type']=content_type
                result=(data,url,message.get_content_type())
                return (*result,response_headers) if include_response_headers else result
            except FetchError:
                raise
            except Exception as e:
                # Keep transport errors useful without exposing proxy URLs,
                # response bodies, cookies, or credentials in logs.
                error_type=type(e).__name__
                if error_type in ('ConnectError','ProxyError') and '403' in str(e):
                    raise FetchError('network_policy_denied_403') from None
                if attempt<2 and error_type in ('TimeoutError','TimeoutException','ConnectTimeout','ReadTimeout',
                                                'WriteTimeout','PoolTimeout','ConnectError','ReadError',
                                                'WriteError','NetworkError','RemoteProtocolError','OSError'):
                    time.sleep(1+attempt)
                    continue
                raise FetchError('network_or_redirect_failure:'+error_type) from None
    def check_robots(self,url):
        url=canonical_url(url,self.hosts); origin='https://'+urlsplit(url).hostname
        if origin not in self.robots:
            try: data,_,_=self.request(origin+'/robots.txt')
            except FetchError as e:
                # A 403 response to robots.txt is not a parsed robots policy.
                # Treat the policy file as unavailable, then continue with the
                # ordinary source request under the configured polite delay.
                # A 403 on the actual listing/detail request remains a hard
                # access failure; 429, 5xx and network errors remain fail-closed.
                if str(e) not in ('http_403','http_404','http_410'):
                    raise FetchError('robots_fetch_failed:'+str(e)) from None
                self.robots_unavailable.append({'url':origin+'/robots.txt','reason':str(e)})
                data=b''
            from protego import Protego
            robot=Protego.parse(data.decode('utf-8','replace'))
            self.robots[origin]=robot
            self.interval=max(self.interval,robot.crawl_delay('GlobalTrendResearch') or robot.crawl_delay('*') or 0)
        if not self.robots[origin].can_fetch(url,'GlobalTrendResearch'): raise FetchError('robots_disallowed')
        return url
    def get(self,url,headers=None):
        url=self.check_robots(url)
        return self.request(url,headers=headers,enforce_robots=True)
    def get_with_headers(self,url,headers=None):
        url=self.check_robots(url)
        return self.request(url,headers=headers,enforce_robots=True,include_response_headers=True)
    def post(self,url,payload,headers):
        url=self.check_robots(url)
        return self.request(url,'POST',payload,headers,enforce_robots=True)

    def close(self):
        """Release Crawlee's HTTP pool and its dedicated event-loop thread."""
        if self._loop is None:
            _HTTP_CLIENTS.discard(self)
            return
        try:
            if self._transport is not None:
                future=asyncio.run_coroutine_threadsafe(self._transport.cleanup(),self._loop)
                future.result(timeout=10)
                self._transport=None
        finally:
            self._loop.call_soon_threadsafe(self._loop.stop)
            if self._thread is not None:
                self._thread.join(timeout=10)
            self._loop=None; self._thread=None
            _HTTP_CLIENTS.discard(self)

    def __enter__(self): return self
    def __exit__(self,exc_type,exc_value,traceback): self.close()

def fetch_listing(source,client,page):
    def fetch(url,method='GET',payload=None,headers=None):
        if method=='POST': return client.post(url,payload,headers or {'Content-Type':'application/json'})
        return client.get(url,headers=headers) if headers is not None else client.get(url)
    if source=='fpf':
        if not getattr(client,'fpf_blog_category_verified',False):
            category_url='https://fpf.org/wp-json/wp/v2/categories?slug=blog&_fields=id,name,slug,count'
            category_data,category_final,category_type=fetch(category_url,headers={'Accept':'application/json'})
            try: categories=json.loads(category_data.decode('utf-8'))
            except (UnicodeDecodeError,json.JSONDecodeError): raise ValueError('fpf_blog_category_json_invalid') from None
            if (category_type!='application/json' or urlsplit(category_final).path!='/wp-json/wp/v2/categories' or
                    not isinstance(categories,list) or len(categories)!=1 or
                    not isinstance(categories[0],dict) or categories[0].get('id')!=15 or
                    categories[0].get('name')!='Blog' or categories[0].get('slug')!='blog' or
                    type(categories[0].get('count')) is not int or categories[0]['count']<0):
                raise ValueError('fpf_blog_category_identity_unverified')
            client.fpf_blog_category_verified=True
        if not hasattr(client,'get_with_headers'):raise ValueError('fpf_listing_response_headers_unavailable')
        data,final,ctype,response_headers=client.get_with_headers(page,headers={'Accept':'application/json'})
        if ctype!='application/json':raise ValueError('fpf_listing_response_type_changed')
        rows,nxt=parsers.discover_listing(source,data.decode('utf-8','replace'),final,None,response_headers)
        client.fpf_listing_response_headers=response_headers
        return rows,nxt
    data,final,ctype=fetch(page)
    is_pdpc_api=source=='pdpc' and urlsplit(final).path=='/api/listing-api'
    if is_pdpc_api:
        try:
            return parsers.discover_pdpc_listing(data,final,parsers.pdpc_api_page_number(final))
        except ValueError as exc:
            reason=str(exc)
            if reason=='robots_disallowed' or not (
                reason in ('pdpc_listing_page_incomplete','pdpc_listing_schema_changed') or
                reason.startswith('pdpc_listing_json_invalid:')
            ):
                raise
            sitemap='https://www.pdpc.gov.sg/sitemap.xml'
            sitemap_data,sitemap_final,_=fetch(sitemap)
            return parsers.discover_pdpc_sitemap(sitemap_data,sitemap_final)
    if ctype not in ('text/html','application/xhtml+xml','application/rss+xml','text/xml','application/xml') and not (source in ('ec','anpd-br') and ctype=='application/json'):
        raise ValueError('unsupported_listing_type')
    return parsers.discover_listing(source,data.decode('utf-8','replace'),final,fetch)

def collect(config,client,store,since,until,max_pages=None,max_items=None):
    result={'source':config['source'],'status':'held','reason':None,'coverage_complete':False,'since':since,'until':until,
            'discovered':0,'new':0,'changed':0,'duplicate':0,'held':0,'failed':0,'out_of_range':0,'unknown_date':0,
            'excluded_unapproved_host_count':0,'pages':0}
    if not config.get('enabled') or not all(config.get('permissions',{}).get(k) for k in ('collect','store','ai')):
        result['reason']='source_permissions_or_operation_unapproved'; return result
    if config['source'] in expansion.CLOUD_SOURCES:
        return expansion.collect_frozen(config,client,store,since,until)
    cursor=store.resume(config,since,until) if hasattr(store,'resume') else None
    seen_pages=set(); seen_items=set(); seen_listing_urls=set(); seen_fingerprints=set()
    # Keep all previously processed identities for mutable, non-paginated feeds.
    # This state is deliberately unbounded: dropping a tail sample would make
    # an older feed entry appear new again after the cursor grows.
    processed_hashes=list((cursor or {}).get('processed_url_hashes',[]))
    processed_urls=set(processed_hashes)
    tc260_date_order_valid=((cursor or {}).get('tc260_date_order_valid') is True if cursor else True)
    tc260_previous_page_last_date=(cursor or {}).get('tc260_previous_page_last_date')
    fpf_completed_pages=list((cursor or {}).get('fpf_completed_pages',[]))
    fpf_expected_total=(cursor or {}).get('fpf_expected_total')
    fpf_expected_pages=(cursor or {}).get('fpf_expected_pages')
    oecd_cycle_complete=False
    page=(cursor or {}).get('page') or config['listing']; next_page=None
    had_pagination=(cursor or {}).get('had_pagination',False); prior_failures=(cursor or {}).get('failures',0); prior_unknown_dates=(cursor or {}).get('unknown_dates',0)
    prior_excluded_hosts=(cursor or {}).get('excluded_unapproved_host_count',0)
    if config['source']=='fpf':
        if (not isinstance(fpf_completed_pages,list) or
                any(type(value) is not int or value<1 for value in fpf_completed_pages) or
                len(set(fpf_completed_pages))!=len(fpf_completed_pages) or
                fpf_expected_total is not None and (type(fpf_expected_total) is not int or fpf_expected_total<0) or
                fpf_expected_pages is not None and (type(fpf_expected_pages) is not int or fpf_expected_pages<0) or
                (fpf_expected_total is None)!=(fpf_expected_pages is None) or
                fpf_expected_total is not None and fpf_expected_pages!=(fpf_expected_total+99)//100 or
                fpf_expected_pages is not None and any(value>fpf_expected_pages for value in fpf_completed_pages)):
            result.update(status='failed',reason='fpf_cursor_invalid')
            return result
    def save_progress(state):
        if config['source']=='fpf':
            state.update(fpf_completed_pages=fpf_completed_pages,fpf_expected_total=fpf_expected_total,
                         fpf_expected_pages=fpf_expected_pages)
        if config['source']=='cn-tc260':
            state.update(tc260_date_order_valid=tc260_date_order_valid,
                         tc260_previous_page_last_date=tc260_previous_page_last_date)
        store.progress(config,since,until,state)
    if config['source']=='ico' and urlsplit(page).hostname=='www.wired-gov.net':
        # WiredGov's supported cross-agency latest index has no date query.
        # Keep it intact rather than transforming it into an old search URL.
        pass
    elif config['source']=='ico':
        scoped=parsers.ico_range_url(page,since,until)
        if scoped!=page: cursor=None
        page=scoped
    elif config['source']=='edpb':
        scoped=expansion.listing_request_url('edpb',page,since,until)
        if scoped!=page: cursor=None
        page=scoped
    elif config['source']=='curia':
        scoped=expansion.listing_request_url('curia',page,since,until)
        if scoped!=page: cursor=None
        page=scoped
    result['status']='partial'
    try:
        while page:
            if config['source']=='edpb':
                # The site's next link can omit the active year filter. Carry
                # the requested date scope onto every continuation URL.
                page=expansion.listing_request_url('edpb',page,since,until)
            if config['source'] in ('ppc','fpf'):
                page=expansion.listing_request_url(config['source'],page,since,until)
                if page is None: break
            page=canonical_url(page,set(config['hosts']))
            if page in seen_pages: raise FetchError('pagination_cycle')
            if max_pages is not None and result['pages']>=max_pages: raise FetchError('page_limit')
            seen_pages.add(page); rows,next_page=fetch_listing(config['source'],client,page); result['pages']+=1
            if config['source']=='fpf':
                headers=getattr(client,'fpf_listing_response_headers',{})
                query=parse_qs(urlsplit(page).query)
                try:
                    total=int(next(value for key,value in headers.items() if key.lower()=='x-wp-total'))
                    total_pages=int(next(value for key,value in headers.items() if key.lower()=='x-wp-totalpages'))
                    api_page=int(query['page'][0])
                except (ValueError,KeyError,StopIteration):raise FetchError('fpf_pagination_headers_missing')
                if total<0 or total_pages!=(total+99)//100 or api_page<1 or api_page>max(1,total_pages):
                    raise FetchError('fpf_pagination_headers_invalid')
                if ((fpf_expected_pages is not None and fpf_expected_pages!=total_pages) or
                        (fpf_expected_total is not None and fpf_expected_total!=total)):
                    raise FetchError('fpf_pagination_totals_changed')
                fpf_expected_total=total;fpf_expected_pages=total_pages
                result['fpf_api_total']=total;result['fpf_api_total_pages']=total_pages
                result.setdefault('fpf_listing_pages',[]).append({'page':api_page,'total':total,
                    'total_pages':total_pages,'category_id':15})
                result['listing_range_query']={'route':'official_wordpress_posts_api','category':'Blog',
                    'category_id':15,'requested_since':since,'requested_until':until,
                    'after':query.get('after',[''])[0],'before':query.get('before',[''])[0],
                    'date_semantics':'padded_api_bounds_then_exact_listing_date_filter'}
            if config['source']=='pdpc' and any(row.get('listing_route')=='official_sitemap' for row in rows):
                result['listing_route']='official_sitemap_fallback'
                result['listing_route_note']='Sitemap has no publication category; article-level human review is required.'
            if config['source'] in expansion.ROUTES:
                if config['source']=='cn-tc260':
                    tc260_dates=[expansion.listing_date(row) for row in rows]
                    page_order_valid=(bool(tc260_dates) and all(tc260_dates) and
                        all(tc260_dates[index]<=tc260_dates[index-1] for index in range(1,len(tc260_dates))) and
                        (tc260_previous_page_last_date is None or tc260_dates[0]<=tc260_previous_page_last_date))
                    tc260_date_order_valid=tc260_date_order_valid and page_order_valid
                    if all(tc260_dates):tc260_previous_page_last_date=tc260_dates[-1]
                    result['listing_date_order_verified']=tc260_date_order_valid
                boundary=expansion.listing_date_boundary(config['source'],rows,since)
                if config['source']=='cn-tc260' and not tc260_date_order_valid:
                    boundary=None
                if boundary:
                    result['listing_date_boundary']={'url':page,**boundary}
                if config['source']!='cn-tc260' or tc260_date_order_valid:
                    next_page=expansion.next_within_window(config['source'],rows,next_page,since)
            if config['source']=='edpb' and next_page:
                next_page=expansion.listing_request_url('edpb',next_page,since,until)
            if not rows:
                if (config['source']=='fpf' and result.get('fpf_api_total')==0 and
                        result.get('fpf_api_total_pages')==0 and prior_failures==0 and prior_unknown_dates==0):
                    store.progress(config,since,until,None);store.checkpoint(config,until)
                    result.update(status='complete',coverage_complete=True,reason='official_fpf_blog_date_query_empty',listing_scan_complete=True)
                    return result
                if config['source']=='eu-council':
                    store.progress(config,since,until,None);store.checkpoint(config,until)
                    result.update(status='complete',reason='no_privacy_relevant_items_in_current_official_rss_window',listing_scan_complete=True)
                    return result
                raise FetchError('listing_empty_or_structure_changed')
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
                        save_progress({'page':page,'offset':index+1,'fingerprint':fingerprint,
                            'had_pagination':had_pagination,'failures':prior_failures,
                            'unknown_dates':prior_unknown_dates+result['unknown_date'],
                            'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                            })
                    continue
                if url in seen_items: continue
                row_hash=hashlib.sha256(url.encode()).hexdigest()
                if config['source'] in ('ftc','oecd') and row_hash in processed_urls:
                    if hasattr(store,'progress'):
                        save_progress({'page':page,'offset':index+1,'fingerprint':fingerprint,
                            'had_pagination':had_pagination,'failures':prior_failures,
                            'unknown_dates':prior_unknown_dates+result['unknown_date'],
                            'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                            'processed_url_hashes':processed_hashes})
                    continue
                if max_items is not None and result['discovered']-result.get('listing_date_excluded',0)>=max_items:
                    raise FetchError('document_limit')
                seen_items.add(url); result['discovered']+=1
                try:
                    listing_date=(parsers.cnil_listing_date(row) if config['source']=='cnil' else
                                  parsers.ftc_listing_date(row) if config['source'] in ('ftc','edps','nl-ap') else
                                  expansion.listing_date(row) if config['source'] in expansion.ROUTES else None)
                    if listing_date and not since<=listing_date<=until:
                        # An individually dated CNIL/FTC row can be excluded
                        # without reading its body. This says nothing about
                        # archive ordering or complete period coverage.
                        result['out_of_range']+=1
                        result['listing_date_excluded']=result.get('listing_date_excluded',0)+1
                        result['range_filter_read_scope']='listing_date_only'
                        result['listing_date_evidence']={'url':url,'date':listing_date,'observations':row['date_observations']}
                    else:
                        if config['source'] in ('edps','npc-ph','nl-ap','eu-council') and row.get('feed_text'):
                            if config['source']=='nl-ap':
                                # The RSS is only a discovery index. Protego
                                # checks the official /actueel/* Allow rule
                                # before fetching each linked article.
                                body,detail,ctype=client.get(expansion.detail_request_url('nl-ap',url))
                                item=extraction.extract_document('nl-ap',body,detail,ctype,row)
                                item['published_date']=parsers.ftc_listing_date(row)
                                item['metadata']['date_observations']=list(row.get('date_observations',[]))
                                item['metadata']['source_body_completeness']='full_article_body'
                                item['metadata']['factual_status']='official_article_machine_extracted_not_human_reviewed'
                                item['metadata']['requires_review']=True
                            else:
                                item=extraction.extract_official_rss_post(row)
                        else:
                            body,detail,ctype=client.get(expansion.detail_request_url(config['source'],url))
                            from .pdf_source_routes import supports_pdf_source_page
                            if config['source'] in ('jpdp-my','global-cbpr','ppc','cn-tc260') and supports_pdf_source_page(config['source'],detail):
                                item=extraction.extract_verified_pdf_attachments(
                                    config['source'],body,detail,ctype,row,client)
                            else:
                                item=extraction.extract_document(config['source'],body,url if config['source']=='ec' else detail,ctype,row)
                        if config['source']=='pdpc' and row.get('listing_route')=='official_sitemap':
                            item['metadata']['requires_review']=True
                            item['metadata']['ai_ready']=False
                            item['metadata']['listing_route']='official_sitemap_fallback'
                            item['metadata']['review_reason']='pdpc_sitemap_has_no_topic_classification'
                        date=item['published_date']
                        if (config['source']=='oecd' and
                                parsers.oecd_certainly_outside_window(item,since,until)):
                            result['out_of_range']+=1
                            result['range_filter_read_scope']='official_detail_time_observations'
                            result['date_observations']=item['metadata']['date_observations']
                        elif date and not since<=date<=until:
                            result['out_of_range']+=1
                        else:
                            if date is None: result['unknown_date']+=1
                            # Eligibility is not a positive relevance decision or human approval.
                            item['metadata'].update({'relevance_reason':'full_body_available_human_relevance_review_pending',
                                'ai_ready':date is not None and not item['metadata']['requires_review'],
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
                        save_progress({'page':page,'offset':index,'fingerprint':fingerprint,
                            'had_pagination':had_pagination,'failures':prior_failures,
                            'unknown_dates':prior_unknown_dates+result['unknown_date'],
                            'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                            })
                    raise FetchError('detail_failure:'+str(e)) from None
                if hasattr(store,'progress'):
                    if config['source'] in ('ftc','oecd') and row_hash not in processed_urls:
                        processed_urls.add(row_hash); processed_hashes.append(row_hash)
                    save_progress({'page':page,'offset':index+1,'fingerprint':fingerprint,
                        'had_pagination':had_pagination,'failures':prior_failures+result['failed'],'unknown_dates':prior_unknown_dates+result['unknown_date'],
                        'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                        'processed_url_hashes':processed_hashes})
            if config['source']=='fpf':
                api_page=int(parse_qs(urlsplit(page).query)['page'][0])
                if api_page not in fpf_completed_pages:fpf_completed_pages.append(api_page)
            completed_page=page
            page=next_page
            cursor=None
            if config['source']=='ftc' and page is None:
                completed_cursor={'page':completed_page,'offset':0,'fingerprint':fingerprint,
                    'had_pagination':had_pagination,'failures':prior_failures+result['failed'],
                    'unknown_dates':prior_unknown_dates+result['unknown_date'],
                    'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                    'processed_url_hashes':processed_hashes}
            elif config['source']=='oecd' and page is None and urlsplit(canonical_url(completed_page,set(config['hosts']))).path!=urlsplit(OECD_NEWSROOM_LISTING).path:
                # The official topic landing page exposes publications and may
                # link related releases, but it is not the newsroom release list.
                # Continue the same durable source cursor through the official
                # newsroom's six latest release cards. The newsroom page itself
                # is not a paginated archive, so this adds discovery only and
                # never establishes period completeness.
                page=OECD_NEWSROOM_LISTING
                completed_cursor={'page':page,'offset':0,'had_pagination':had_pagination,
                    'failures':prior_failures+result['failed'],'unknown_dates':prior_unknown_dates+result['unknown_date'],
                    'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                    'processed_url_hashes':processed_hashes}
                result['listing_transition']='topic_to_official_newsroom'
            elif config['source']=='oecd' and page is None and urlsplit(canonical_url(completed_page,set(config['hosts']))).path==urlsplit(OECD_NEWSROOM_LISTING).path:
                # Restart the next scheduled scan at the topic listing. The
                # database upsert keeps repeated items idempotent.
                page=config['listing']
                completed_cursor={'page':page,'offset':0,'had_pagination':False,
                    'failures':prior_failures+result['failed'],'unknown_dates':prior_unknown_dates+result['unknown_date'],
                    'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                    'processed_url_hashes':processed_hashes}
                result['listing_transition']='newsroom_to_topic_restart'
                oecd_cycle_complete=True
            else:
                completed_cursor={'page':page,'offset':0,'had_pagination':had_pagination,
                    'failures':prior_failures+result['failed'],'unknown_dates':prior_unknown_dates+result['unknown_date'],
                    'excluded_unapproved_host_count':prior_excluded_hosts+result['excluded_unapproved_host_count'],
                    'processed_url_hashes':processed_hashes} if page else None
            if config['source']=='fpf' and completed_cursor is not None:
                completed_cursor.update(fpf_completed_pages=fpf_completed_pages,
                    fpf_expected_total=fpf_expected_total,fpf_expected_pages=fpf_expected_pages)
            if config['source']=='cn-tc260' and completed_cursor is not None:
                completed_cursor.update(tc260_date_order_valid=tc260_date_order_valid,
                    tc260_previous_page_last_date=tc260_previous_page_last_date)
            if hasattr(store,'progress'):
                store.progress(config,since,until,completed_cursor)
            if oecd_cycle_complete:
                break
        # Reaching a last page establishes only this listing scan. Pagination
        # alone does not prove that the source covers every item in the period,
        # including related releases, hidden pages and unread attachments.
        fpf_complete=(config['source']=='fpf' and fpf_expected_pages is not None and
                      sorted(set(fpf_completed_pages))==list(range(1,fpf_expected_pages+1)) and
                      result['failed']==0 and result['unknown_date']==0 and result['held']==0 and
                      prior_failures==0 and prior_unknown_dates==0)
        result['coverage_complete']=bool(fpf_complete)
        result['status']='complete' if fpf_complete else 'partial'
        if config['source']!='oecd' or oecd_cycle_complete:
            result['listing_scan_complete']=True
        result['reason']=('official_fpf_blog_date_window_exhausted' if fpf_complete else
                          'unapproved_external_listing_links' if prior_excluded_hosts or result['excluded_unapproved_host_count'] else
                          'listing_exhaustiveness_unverified_or_unknown_date_or_detail_failure')
        if config['source']=='edpb':
            first_year=dt.date.fromisoformat(since).year
            last_year=dt.date.fromisoformat(until).year
            result['coverage_evidence']={
                'strategy':'official_year_filtered_news_archive',
                'date_filter':str(first_year) if first_year==last_year else f'{first_year}-{last_year}',
                'listing_scan_complete':result['listing_scan_complete'],
                'unknown_date':result['unknown_date'],
                'failed':result['failed'],
                'excluded_unapproved_host_count':result['excluded_unapproved_host_count'],
            }
            if (result['listing_scan_complete'] and 'date' in dict(parse_qsl(urlsplit(page).query)) and result['unknown_date']==0 and
                    result['failed']==0 and result['excluded_unapproved_host_count']==0):
                result.update(status='complete',coverage_complete=True,reason='official_year_filtered_listing_exhausted')
        if config['source']=='curia':
            year=dt.date.fromisoformat(since).year
            filtered=(dt.date.fromisoformat(until).year==year and 'year' in dict(parse_qsl(urlsplit(page).query)) and
                      dict(parse_qsl(urlsplit(page).query)).get('year')==str(year) and
                      dict(parse_qsl(urlsplit(page).query)).get('PortalAction_d6_1000000371_pagerAll')=='true')
            result['coverage_evidence']={'strategy':'official_year_filtered_press_release_archive','year':year,'all_results_mode':filtered,'cross_year_window_supported':False}
            if (filtered and result['listing_scan_complete'] and result['unknown_date']==0 and result['failed']==0 and result['excluded_unapproved_host_count']==0):
                result.update(status='complete',coverage_complete=True,reason='official_year_filtered_listing_exhausted')
        if config['source']=='cn-tc260':
            result['coverage_evidence']={'strategy':'official_newest_first_notice_archive','date_order_verified':tc260_date_order_valid,
                'listing_scan_complete':result['listing_scan_complete'],'boundary':result.get('listing_date_boundary')}
            tc260_complete=(result['listing_scan_complete'] and tc260_date_order_valid and
                result['unknown_date']==0 and result['failed']==0 and result['held']==0 and
                prior_failures==0 and prior_unknown_dates==0 and
                prior_excluded_hosts==0 and result['excluded_unapproved_host_count']==0)
            if tc260_complete:
                store.checkpoint(config,until)
                result.update(status='complete',coverage_complete=True,reason='official_tc260_archive_boundary_verified')
        if fpf_complete:store.checkpoint(config,until)
        if config['source']=='cnil':
            result['coverage_blockers']=['listing_date_order_and_exhaustiveness_unverified']
    except (FetchError,ValueError) as e:
        # Ordinary batch boundaries preserve the cursor for the next run. They
        # do not establish complete coverage, but are not collection failures.
        result['status']='partial' if str(e) in ('document_limit','page_limit') else 'failed'
        result['reason']=str(e); result['coverage_complete']=False
    return result
