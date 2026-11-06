"""Bounded Crawlee HTTP/browser transport for the parallel collector v2."""
import asyncio
import threading
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlsplit

from crawlee.crawlers import HttpCrawler, PlaywrightCrawler
from crawlee import Request

from scripts.collector.core import FetchError, canonical_url

_LOOP = asyncio.new_event_loop()
_LOOP_THREAD = threading.Thread(target=_LOOP.run_forever, daemon=True)
_LOOP_THREAD.start()


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

    def __init__(self, hosts, *, browser_hosts=(), max_bytes=2_000_000):
        self.hosts = set(hosts)
        self.browser_hosts = set(browser_hosts)
        self.max_bytes = max_bytes
        self.requests = 0
        self.downloaded_bytes = 0
        self._loop = _LOOP

    def fetch(self, url, *, method='GET', payload=None, headers=None):
        canonical_url(url, self.hosts)
        if method not in ('GET', 'POST'):
            raise FetchError('collector_v2_method_not_supported')
        request = Request.from_url(url, method=method, payload=payload, headers=headers or {},
                                   use_extended_unique_key=True, max_retries=0)
        result = self._submit(self._fetch(request))
        self.requests += 1
        self.downloaded_bytes += len(result.body)
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

            await crawler.run([request])
        else:
            crawler = HttpCrawler(
                max_requests_per_crawl=1,
                max_request_retries=0,
                max_session_rotations=0,
                respect_robots_txt_file=True,
                configure_logging=False,
            )

            @crawler.router.default_handler
            async def handle(context):
                response = context.http_response
                result.update(body=await response.read(), url=context.request.url,
                              status=response.status_code,
                              content_type=response.headers.get('content-type', '').split(';')[0].lower())

            await crawler.run([request])

        if not result:
            raise FetchError('crawlee_request_skipped_or_failed')
        if result['status'] < 200 or result['status'] >= 400:
            raise FetchError('http_' + str(result['status']))
        return Response(**result)
