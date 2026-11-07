import unittest

from scripts.collector.core import FetchError
from scripts.collector_v2.transport import effective_http_client, CrawleeClient, Response
from unittest.mock import patch
import time


class HttpClientSelectionTests(unittest.TestCase):
    def test_shared_budget_tracks_requests_and_response_bytes(self):
        budget = {'requests': 0, 'bytes': 0, 'started': time.monotonic()}
        client = CrawleeClient({'example.com'}, budget=budget)
        response = Response(body=b'hello', url='https://example.com/', content_type='text/html', status=200)
        with patch.object(client.robots_client, 'check_robots'), patch.object(client, '_submit', side_effect=lambda coroutine: (coroutine.close(), response)[1]):
            client.get('https://example.com/')
        self.assertEqual((budget['requests'], budget['bytes']), (1, 5))

    def test_shared_budget_limit_blocks_request(self):
        client = CrawleeClient({'example.com'}, budget={'requests': 1000, 'bytes': 0, 'started': time.monotonic()})
        with patch.object(client.robots_client, 'check_robots'):
            with self.assertRaisesRegex(FetchError, 'request_or_runtime_limit'):
                client.get('https://example.com/')

    def test_robots_failure_prevents_request(self):
        client = CrawleeClient({'example.com'})
        with patch.object(client.robots_client, 'check_robots', side_effect=FetchError('robots_disallowed')), patch.object(client, '_submit') as submit:
            with self.assertRaisesRegex(FetchError, 'robots_disallowed'):
                client.get('https://example.com/')
            submit.assert_not_called()
    def test_auto_uses_httpx_for_compatible_hosts(self):
        self.assertEqual(effective_http_client('privacy.ca.gov', 'auto'), 'httpx')
        self.assertEqual(effective_http_client('ec.europa.eu', 'auto'), 'httpx')
        self.assertEqual(effective_http_client('www.ftc.gov', 'auto'), 'impit')

    def test_explicit_choice_overrides_host_default(self):
        self.assertEqual(effective_http_client('privacy.ca.gov', 'impit'), 'impit')
        self.assertEqual(effective_http_client('www.ftc.gov', 'httpx'), 'httpx')

    def test_unknown_choice_is_rejected(self):
        with self.assertRaisesRegex(FetchError, 'crawlee_http_client_not_supported'):
            effective_http_client('privacy.ca.gov', 'other')


if __name__ == '__main__':
    unittest.main()
