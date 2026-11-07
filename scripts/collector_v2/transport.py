"""Bounded Crawlee HTTP/browser transport for the parallel collector v2."""
import asyncio
import os
import threading
import time
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlsplit

from crawlee.crawlers import HttpCrawler, PlaywrightCrawler
from crawlee import Request

from scripts.collector.core import FetchError, HttpClient, canonical_url

_LOOP = asyncio.new_event_loop()
_LOOP_THREAD = threading.Thread(target=_LOOP.run_forever, daemon=True)
_LOOP_THREAD.start()
_HOST_NEXT_ALLOWED = {}
_HOST_LOCKS = {}
HTTPX_HOSTS = {'privacy.ca.gov', 'ec.europa.eu'}


def effective_http_client(host, requested=None):
    requested = (requested if requested is not None else
                 os.getenv('CRAWLEE_HTTP_CLIENT', 'auto')).strip().lower()
    if requested == 'auto':
        return 'httpx' if host in HTTPX_HOSTS else 'impit'
    if requested not in ('impit', 'httpx'):
        raise FetchError('crawlee_http_client_not_supported')
    return requested


async def _pace(host, interval):
    """Keep sequential crawler instances from bypassing per-host pacing."""
    if interval <= 0:
        return
    lock = _HOST_LOCKS.setdefault(host, asyncio.Lock())
    async with lock:
        loop = asyncio.get_running_loop()
        delay = _HOST_NEXT_ALLOWED.get(host, 0) - loop.time()
        if delay > 0:
            await asyncio.sleep(delay)
        _HOST_NEXT_ALLOWED[host] = loop.time() + interval


@dataclass(frozen=True)
class Response:
    body: bytes
    url: str
    content_type: str
    status: int


class CrawleeClient:
    """Fetch only approved HTTPS hosts; optionally render with Playwright.

    This transport has no database client. Callers pass its response through
    existing source adapters and persistence contracts explicitly.
    """

    def __init__(self, hosts, *, browser_hosts=(), max_bytes=2_000_000, interval=2, budget=None):
        self.hosts = set(hosts)
        self.browser_hosts = set(browser_hosts)
        self.max_bytes = max_bytes
        self.interval = max(0, float(interval))
        self.requests = 0
        self.downloaded_bytes = 0
        self.budget = budget if budget is not None else {'requests': 0, 'bytes': 0, 'started': time.monotonic()}
        self.robots_client = HttpClient(self.hosts, interval=self.interval, budget=self.budget)
        self._loop = _LOOP

    def fetch(self, url, *, method='GET', payload=None, headers=None):
        canonical_url(url, self.hosts)
        if method not in ('GET', 'POST'):
            raise FetchError('collector_v2_method_not_supported')
        self.robots_client.check_robots(url)
        self.interval = max(self.interval, self.robots_client.interval)
        if self.budget['requests'] >= 1000 or time.monotonic() - self.budget['started'] > 600:
            raise FetchError('request_or_runtime_limit')
        self.budget['requests'] += 1
        request = Request.from_url(url, method=method, payload=payload, headers=headers or {},
                                   use_extended_unique_key=True, max_retries=0)
        result = self._submit(self._fetch(request))
        self.requests += 1
        self.downloaded_bytes += len(result.body)
        self.budget['bytes'] += len(result.body)
        if len(result.body) > self.max_bytes:
            raise FetchError('response_size_limit')
        canonical_url(result.url, self.hosts)
        return result.body, result.url, result.content_type

    def get(self, url):
        return self.fetch(url)

    def post(self, url, payload, headers):
        return self.fetch(url, method='POST', payload=payload, headers=headers)

    def _submit(self, coroutine):
        future = asyncio.run_coroutine_threadsafe(coroutine, self._loop)
        try:
            return future.result(timeout=45)
        except FutureTimeout:
            future.cancel()
            raise FetchError('crawlee_request_timeout') from None

    async def _fetch(self, request):
        url = request.url
        headers = request.headers
        parsed = urlsplit(url)
        browser = parsed.hostname in self.browser_hosts
        result = {}
        await _pace(parsed.hostname, self.interval)

        if browser:
            crawler = PlaywrightCrawler(
                max_requests_per_crawl=1,
                max_request_retries=0,
                max_session_rotations=0,
                navigation_timeout=timedelta(seconds=30),
                respect_robots_txt_file=True,
                configure_logging=False,
                headless=True,
                fingerprint_generator=None,
                browser_launch_options={'args': ['--no-sandbox', '--disable-dev-shm-usage']},
                browser_new_context_options={'extra_http_headers': headers} if headers else None,
            )

            @crawler.router.default_handler
            async def handle(context):
                response = context.response
                result.update(body=(await response.body()), url=response.url,
                              status=response.status or 0,
                              content_type=(response.headers.get('content-type', '').split(';')[0].lower()))

            @crawler.failed_request_handler
            async def failed(context, error):
                result['error'] = classify_crawler_error(error)

            await crawler.run([request])
        else:
            http_client = effective_http_client(parsed.hostname)
            http_client_options = {}
            if http_client == 'httpx':
                try:
                    from crawlee.http_clients import HttpxHttpClient
                except ImportError:
                    raise FetchError('crawlee_httpx_extra_not_installed') from None
                http_client_options['http_client'] = HttpxHttpClient()
            crawler = HttpCrawler(
                **http_client_options,
                max_requests_per_crawl=1,
                max_request_retries=0,
                max_session_rotations=0,
                respect_robots_txt_file=True,
                configure_logging=False,
            )

            @crawler.router.default_handler
            async def handle(context):
                response = context.http_response
                result.update(body=await response.read(),
                              url=context.request.loaded_url or context.request.url,
                              status=response.status_code,
                              content_type=response.headers.get('content-type', '').split(';')[0].lower())

            @crawler.failed_request_handler
            async def failed(context, error):
                result['error'] = classify_crawler_error(error)

            await crawler.run([request])

        if 'error' in result:
            raise FetchError(result['error'])
        if not result:
            raise FetchError('crawlee_request_skipped_or_failed')
        if result['status'] < 200 or result['status'] >= 400:
            raise FetchError('http_' + str(result['status']))
        return Response(**result)


def classify_crawler_error(error):
    """Keep useful status without leaking URLs, headers or credentials."""
    import re
    message = str(error)
    match = re.search(r'(?:status code|status|HTTP)\s*[:=]?\s*(\d{3})\b', message, re.I)
    if match:
        return 'http_' + match.group(1)
    return 'crawler_' + type(error).__name__
