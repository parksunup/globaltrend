import unittest
from types import SimpleNamespace
from urllib.error import HTTPError

from scripts.collector_scrapling.transport import FetchFailure, SafeScraplingClient


class _RobotsResponse:
    status = 200

    def __init__(self, body):
        self._body = body

    def read(self, limit):
        return self._body[:limit]

    def getcode(self):
        return self.status

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class _Clock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.now

    def sleep(self, value):
        self.sleeps.append(value)
        self.now += value


class ScraplingTransportTests(unittest.TestCase):
    def make_client(self, fetcher, robots=b"User-agent: *\nAllow: /\n"):
        clock = _Clock()
        calls = []

        def opener(request, timeout=0):
            calls.append(request.full_url)
            return _RobotsResponse(robots)

        client = SafeScraplingClient(
            {"official.example"}, fetcher=fetcher, opener=opener,
            sleep=clock.sleep, monotonic=clock.monotonic,
        )
        return client, clock, calls

    def test_fetcher_called_without_proxy_stealth_browser_or_hidden_redirects(self):
        requests = []

        class FakeFetcher:
            @staticmethod
            def get(url, **kwargs):
                requests.append((url, kwargs))
                return SimpleNamespace(
                    status=200, url=url,
                    headers={"content-type": "text/html; charset=utf-8"},
                    body=b"<html>ok</html>",
                )

        client, _, robots_calls = self.make_client(FakeFetcher)
        body, url, content_type = client.get("https://official.example/news")
        self.assertEqual((body, url, content_type), (
            b"<html>ok</html>", "https://official.example/news", "text/html"))
        self.assertEqual(robots_calls, ["https://official.example/robots.txt"])
        _, args = requests[0]
        self.assertFalse(args["stealthy_headers"])
        self.assertIsNone(args["impersonate"])
        self.assertFalse(args["follow_redirects"])
        self.assertEqual(args["max_redirects"], 0)
        self.assertEqual(args["retries"], 1)

    def test_disallowed_path_is_not_sent_to_scrapling(self):
        requests = []

        class FakeFetcher:
            @staticmethod
            def get(url, **kwargs):
                requests.append(url)
                return SimpleNamespace(status=200, url=url, headers={}, body=b"ok")

        client, _, _ = self.make_client(FakeFetcher, b"User-agent: *\nDisallow: /private\n")
        with self.assertRaisesRegex(FetchFailure, "robots_disallowed"):
            client.get("https://official.example/private/article")
        self.assertEqual(requests, [])

    def test_every_redirect_target_is_checked_before_following(self):
        requests = []

        class FakeFetcher:
            @staticmethod
            def get(url, **kwargs):
                requests.append(url)
                return SimpleNamespace(
                    status=302, url=url, headers={"location": "https://evil.example/"}, body=b"",
                )

        client, _, _ = self.make_client(FakeFetcher)
        with self.assertRaisesRegex(FetchFailure, "url_outside_https_host_allowlist"):
            client.get("https://official.example/redirect")
        self.assertEqual(requests, ["https://official.example/redirect"])

    def test_per_host_interval_is_at_least_five_seconds(self):
        requests = []

        class FakeFetcher:
            @staticmethod
            def get(url, **kwargs):
                requests.append(url)
                return SimpleNamespace(status=200, url=url, headers={"content-type": "text/html"}, body=b"ok")

        client, clock, _ = self.make_client(FakeFetcher)
        client.get("https://official.example/a")
        client.get("https://official.example/b")
        self.assertEqual(clock.sleeps, [5.0, 5.0])
        self.assertEqual(len(requests), 2)


if __name__ == "__main__":
    unittest.main()
