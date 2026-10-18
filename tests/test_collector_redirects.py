import io
import unittest
import urllib.request
from email.message import Message
from urllib.response import addinfourl
from unittest.mock import patch

from scripts.collector.core import HttpClient, SafeRedirect, FetchError


class FakeHTTPSHandler(urllib.request.HTTPSHandler):
    def __init__(self, disallow=False):
        super().__init__()
        self.disallow = disallow
        self.paths = []

    def https_open(self, request):
        path = request.selector
        self.paths.append(path)
        headers = Message()
        if path == '/robots.txt':
            body = b'User-agent: *\nDisallow: /blocked\n' if self.disallow else b'User-agent: *\nAllow: /\n'
            status = 200
        elif path == '/allowed':
            body = b''; status = 302; headers['Location'] = '/blocked'
        else:
            body = b'The redirected body'; status = 200
        headers['Content-Type'] = 'text/plain'
        response = addinfourl(io.BytesIO(body), headers, request.full_url, code=status)
        response.msg = 'Found' if status == 302 else 'OK'
        return response


class RedirectTests(unittest.TestCase):
    def client(self, disallow=False):
        client = HttpClient(['ico.org.uk'], interval=0)
        handler = FakeHTTPSHandler(disallow)
        client.opener = urllib.request.build_opener(SafeRedirect(client.hosts), handler)
        return client, handler

    def test_redirect_cannot_fetch_robots_disallowed_path(self):
        client, handler = self.client(disallow=True)
        with self.assertRaisesRegex(FetchError, 'robots_disallowed'):
            client.get('https://ico.org.uk/allowed')
        self.assertEqual(handler.paths, ['/robots.txt', '/allowed'])

    def test_redirect_counts_every_http_request(self):
        client, handler = self.client()
        body, final, _ = client.get('https://ico.org.uk/allowed')
        self.assertEqual(body, b'The redirected body')
        self.assertEqual(final, 'https://ico.org.uk/blocked')
        self.assertEqual(client.budget['requests'], len(handler.paths))
        self.assertEqual(client.requests, 3)

    def test_redirect_stops_before_exceeding_request_budget(self):
        client, handler = self.client()
        with patch('scripts.collector.core.MAX_REQUESTS', 2):
            with self.assertRaisesRegex(FetchError, 'request_or_runtime_limit'):
                client.get('https://ico.org.uk/allowed')
        self.assertEqual(handler.paths, ['/robots.txt', '/allowed'])


if __name__ == '__main__':
    unittest.main()
