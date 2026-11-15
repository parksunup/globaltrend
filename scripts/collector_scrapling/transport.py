"""Policy-checked transport using the unmodified upstream Scrapling Fetcher."""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlsplit

from protego import Protego
from scrapling.fetchers import Fetcher


USER_AGENT = "GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)"
MIN_HOST_INTERVAL_SECONDS = 5.0
MAX_REDIRECTS = 5
MAX_RESPONSE_BYTES = 5_000_000


class _NoRobotsRedirect(urllib.request.HTTPRedirectHandler):
    """Avoid urllib silently following a robots.txt redirect across hosts."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class FetchFailure(RuntimeError):
    """A fetch was refused by policy or failed before a document was read."""


class SafeScraplingClient:
    """Small get()-compatible client for the separate Scrapling collectors.

    Scrapling's public Fetcher is used directly. Redirects are handled here so
    every hop gets its own host, HTTPS, robots, and pacing checks. The class
    does not use a proxy, CAPTCHA workflow, browser session, or stealth mode.
    """

    def __init__(self, hosts, interval=MIN_HOST_INTERVAL_SECONDS, *,
                 fetcher=Fetcher, opener=None,
                 sleep=time.sleep, monotonic=time.monotonic):
        self.hosts = set(hosts)
        self.interval = max(MIN_HOST_INTERVAL_SECONDS, float(interval))
        self.fetcher = fetcher
        self.opener = opener or urllib.request.build_opener(_NoRobotsRedirect()).open
        self.sleep = sleep
        self.monotonic = monotonic
        self._robots = {}
        self._last_request_by_host = {}
        self.requests = 0
        self.robots_requests = 0
        self.bytes_received = 0

    def _validate(self, url):
        try:
            parsed = urlsplit(url)
        except ValueError:
            raise FetchFailure("invalid_url") from None
        if (parsed.scheme != "https" or parsed.hostname not in self.hosts
                or parsed.username or parsed.password or parsed.port not in (None, 443)):
            raise FetchFailure("url_outside_https_host_allowlist")
        return parsed

    def _policy(self, host):
        if host in self._robots:
            return self._robots[host]
        url = f"https://{host}/robots.txt"
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        self.robots_requests += 1
        try:
            with self.opener(request, timeout=20) as response:
                status = int(getattr(response, "status", response.getcode()))
                body = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as error:
            status = error.code
            body = b""
            error.close()
        except (urllib.error.URLError, TimeoutError, OSError):
            raise FetchFailure("robots_fetch_failed") from None
        if status == 429:
            raise FetchFailure("robots_http_429")
        if 300 <= status < 400:
            raise FetchFailure("robots_redirect_not_followed")
        if status >= 500:
            raise FetchFailure(f"robots_http_{status}")
        if len(body) > MAX_RESPONSE_BYTES:
            raise FetchFailure("robots_response_too_large")
        # The minimum interval also separates the robots request from the first
        # page request to that host.
        self._last_request_by_host[host] = self.monotonic()
        # RFC 9309 treats 4xx robots responses as unavailable (allow), while
        # 5xx/network failures above fail closed.
        policy = Protego.parse(body.decode("utf-8", "replace") if status < 400 else "")
        crawl_delay = policy.crawl_delay("GlobalTrendResearch") or policy.crawl_delay("*") or 0
        self._robots[host] = (policy, max(self.interval, float(crawl_delay)))
        return self._robots[host]

    def _pace(self, host, interval):
        previous = self._last_request_by_host.get(host)
        if previous is not None:
            remaining = interval - (self.monotonic() - previous)
            if remaining > 0:
                self.sleep(remaining)
        self._last_request_by_host[host] = self.monotonic()

    def get(self, url, *, _redirects=0):
        parsed = self._validate(url)
        policy, interval = self._policy(parsed.hostname)
        if not policy.can_fetch(url, USER_AGENT):
            raise FetchFailure("robots_disallowed")
        self._pace(parsed.hostname, interval)
        try:
            response = self.fetcher.get(
                url,
                timeout=30,
                headers={"User-Agent": USER_AGENT},
                stealthy_headers=False,
                impersonate=None,
                follow_redirects=False,
                max_redirects=0,
                retries=1,
            )
        except Exception as error:
            raise FetchFailure("scrapling_request_failed:" + type(error).__name__) from None
        self.requests += 1
        status = int(response.status)
        response_url = str(response.url)
        response_headers = response.headers
        if 300 <= status < 400:
            if _redirects >= MAX_REDIRECTS:
                raise FetchFailure("redirect_limit")
            location = response_headers.get("location")
            if not location:
                raise FetchFailure("redirect_location_missing")
            target = urljoin(response_url, location)
            self._validate(target)
            return self.get(target, _redirects=_redirects + 1)
        if status in (401, 403, 429):
            raise FetchFailure(f"http_{status}")
        if status >= 400:
            raise FetchFailure(f"http_{status}")
        final = self._validate(response_url)
        if final.hostname != parsed.hostname and final.hostname not in self.hosts:
            raise FetchFailure("redirect_host_not_allowlisted")
        body = response.body
        if not isinstance(body, bytes):
            body = str(body).encode("utf-8")
        if len(body) > MAX_RESPONSE_BYTES:
            raise FetchFailure("response_too_large")
        self.bytes_received += len(body)
        content_type = response_headers.get("content-type", "text/html").split(";", 1)[0].strip().lower()
        return body, response_url, content_type
