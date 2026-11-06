import unittest

from scripts.collector.core import FetchError
from scripts.collector_v2.transport import effective_http_client


class HttpClientSelectionTests(unittest.TestCase):
    def test_auto_uses_httpx_only_for_verified_compatible_host(self):
        self.assertEqual(effective_http_client('privacy.ca.gov', 'auto'), 'httpx')
        self.assertEqual(effective_http_client('www.ftc.gov', 'auto'), 'impit')

    def test_explicit_choice_overrides_host_default(self):
        self.assertEqual(effective_http_client('privacy.ca.gov', 'impit'), 'impit')
        self.assertEqual(effective_http_client('www.ftc.gov', 'httpx'), 'httpx')

    def test_unknown_choice_is_rejected(self):
        with self.assertRaisesRegex(FetchError, 'crawlee_http_client_not_supported'):
            effective_http_client('privacy.ca.gov', 'other')


if __name__ == '__main__':
    unittest.main()
