import unittest
from unittest.mock import patch

from scripts import scrapling_probe


class ScraplingProbeTests(unittest.TestCase):
    def test_only_the_eight_requested_sources_are_selectable(self):
        self.assertEqual(8, len(scrapling_probe.TARGETS))
        self.assertEqual({'oecd', 'ftc', 'calprivacy', 'hk-pcpd', 'eu-parliament', 'cn-cac', 'ripd', 'vn-gov'},
                         scrapling_probe.TARGETS)

    def test_robots_delay_has_five_second_floor(self):
        with patch.object(scrapling_probe.urllib.request, 'urlopen') as open_url:
            open_url.return_value.__enter__.return_value.read.return_value = b'User-agent: *\nDisallow:\nCrawl-delay: 3\n'
            _, delay = scrapling_probe.robots_policy('www.ftc.gov')
        self.assertEqual(5, delay)

    def test_access_denial_stops_before_any_detail_request(self):
        source = {'id': 'oecd', 'listing': 'https://www.oecd.org/en/topics/privacy-and-data-protection.html',
                  'hosts': ['www.oecd.org']}
        with patch.object(scrapling_probe, 'robots_policy', return_value=(type('Policy', (), {'can_fetch': lambda *_: True})(), 0)), \
             patch.object(scrapling_probe.time, 'sleep'), \
             patch.object(scrapling_probe.Fetcher, 'get', return_value=type('Response', (), {
                 'status': 403, 'url': source['listing']})()) as fetch:
            result = scrapling_probe.probe_source(source)
        self.assertEqual('access_denied', result['status'])
        self.assertEqual(1, fetch.call_count)
        self.assertEqual(1, result['requests'])

    def test_robots_disallowed_listing_is_never_requested(self):
        source = {'id': 'oecd', 'listing': 'https://www.oecd.org/en/topics/privacy-and-data-protection.html',
                  'hosts': ['www.oecd.org']}
        with patch.object(scrapling_probe, 'robots_policy', return_value=(type('Policy', (), {'can_fetch': lambda *_: False})(), 5)), \
             patch.object(scrapling_probe.Fetcher, 'get') as fetch:
            result = scrapling_probe.probe_source(source)
        self.assertEqual('robots_disallowed', result['status'])
        fetch.assert_not_called()

    def test_privacy_candidate_filter_rejects_unrelated_vietnam_story(self):
        rows = [
            {'title': 'To Lam starts four-day official visit to Japan', 'url': 'https://en.baochinhphu.vn/a'},
            {'title': 'Government issues Decree 363 on personal data protection', 'url': 'https://en.baochinhphu.vn/b'},
        ]
        self.assertEqual([rows[1]], scrapling_probe.relevant_rows('vn-gov', rows))

    def test_ftc_candidate_filter_keeps_privacy_actions(self):
        rows = [
            {'title': 'Competition Matters', 'url': 'https://search.ftc.gov/a'},
            {'title': 'FTC Act against deceptive unlawful privacy practices', 'url': 'https://search.ftc.gov/b'},
        ]
        self.assertEqual([rows[1]], scrapling_probe.relevant_rows('ftc', rows))


if __name__ == '__main__':
    unittest.main()
