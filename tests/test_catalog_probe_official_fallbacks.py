import datetime as dt
from urllib.parse import urlsplit
import unittest
from unittest.mock import patch

from scripts import catalog_probe


class FrozenDate(dt.date):
    @classmethod
    def today(cls):
        return cls(2026, 11, 9)


class RouteProbeClient:
    def __init__(self, hosts, details=None, homepage=None):
        self.details = details or {}
        self.homepage = homepage
        self.last_http_status = None
        self.last_url = None
        self.requests = 0
        self.downloaded_bytes = 0
        self.detail_requests = []
        self.get_requests = []

    def get(self, url):
        self.get_requests.append(url)
        self.requests += 1
        self.last_http_status = 200
        self.last_url = url
        if url == 'https://en.baochinhphu.vn/':
            body = self.homepage
            content_type = 'text/html'
        else:
            self.detail_requests.append(url)
            body = self.details[url]
            content_type = 'text/html'
        self.downloaded_bytes += len(body)
        return body, url, content_type

    def close(self):
        pass


class CatalogProbeOfficialFallbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = {row['id']: row for row in catalog_probe.load_catalog()['sources']}

    def test_hk_pcpd_walks_full_inclusive_window_deduplicates_and_samples_one_detail(self):
        source = self.sources['hk-pcpd']
        url_a = 'https://www.info.gov.hk/gia/general/202611/09/P202611090001.htm'
        url_b = 'https://www.info.gov.hk/gia/general/202611/08/P202611080002.htm'
        url_c = 'https://www.info.gov.hk/gia/general/202611/07/P202611070003.htm'
        by_day = {
            '202611/09.htm': [{'url': url_a, 'title': 'PCPD privacy safeguards announced'},
                              {'url': url_b, 'title': 'Privacy Commissioner issues guidance'}],
            '202611/08.htm': [{'url': url_a, 'title': 'PCPD privacy safeguards announced'}],
            '202611/07.htm': [{'url': url_c, 'title': 'PCPD personal data protection update'}],
        }
        calls = []

        def fetch_listing(source_id, client, url):
            self.assertEqual(source_id, 'hk-pcpd')
            calls.append(url)
            client.last_http_status = 200
            client.last_url = url
            path = urlsplit(url).path.split('/gia/general/', 1)[1]
            return by_day[path], 'ignored-next-day'

        detail_html = b'''<html><main><h1>PCPD privacy safeguards announced</h1><article>
        <p>The Privacy Commissioner for Personal Data announced new privacy safeguards and explained how the guidance applies to organizations.</p>
        </article></main></html>'''
        client = RouteProbeClient(source['hosts'], details={url_a: detail_html})
        configured = {'sources': [{'source': 'hk-pcpd', 'lookback_days': 3}]}
        with patch.object(catalog_probe, 'date', FrozenDate), \
             patch.object(catalog_probe, 'CrawleeClient', return_value=client), \
             patch.object(catalog_probe, 'fetch_listing', side_effect=fetch_listing), \
             patch.object(catalog_probe, 'extract_main_text', return_value=('Extracted official privacy article text. ' * 8, None)):
            result = catalog_probe.probe(source, configured)

        self.assertEqual(calls, [
            'https://www.info.gov.hk/gia/general/202611/09.htm',
            'https://www.info.gov.hk/gia/general/202611/08.htm',
            'https://www.info.gov.hk/gia/general/202611/07.htm',
        ])
        self.assertEqual(result['listing']['archive_dates_visited'], ['2026-11-09', '2026-11-08', '2026-11-07'])
        self.assertEqual([row['candidate_count'] for row in result['listing']['archive_results']], [2, 1, 1])
        self.assertEqual(result['listing']['candidate_count'], 3)
        self.assertEqual(result['listing']['relevant_candidate_count'], 3)
        self.assertEqual(len(client.detail_requests), 1)
        self.assertEqual(client.detail_requests, [url_a])
        self.assertEqual(result['status'], 'listing_and_body_extracted')

    def test_hk_pcpd_reports_every_visited_date_when_no_candidate_is_found(self):
        source = self.sources['hk-pcpd']
        calls = []

        def fetch_listing(source_id, client, url):
            calls.append(url)
            client.last_http_status = 200
            client.last_url = url
            return [], 'ignored-next-day'

        client = RouteProbeClient(source['hosts'])
        with patch.object(catalog_probe, 'date', FrozenDate), \
             patch.object(catalog_probe, 'CrawleeClient', return_value=client), \
             patch.object(catalog_probe, 'fetch_listing', side_effect=fetch_listing):
            result = catalog_probe.probe(source, {'sources': [{'source': 'hk-pcpd', 'lookback_days': 3}]})

        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['listing']['archive_dates_visited'], ['2026-11-09', '2026-11-08', '2026-11-07'])
        self.assertEqual([row['candidate_count'] for row in result['listing']['archive_results']], [0, 0, 0])
        self.assertEqual(len(calls), 3)
        self.assertEqual(client.detail_requests, [])

    def test_vietnam_falls_back_from_empty_policy_matches_to_official_home_focus(self):
        source = self.sources['vn-gov']
        article_url = ('https://en.baochinhphu.vn/decree-on-personal-data-protection-'
                       '111261102100407268.htm')
        policy_rows = [
            {'url': f'https://en.baochinhphu.vn/transport-project-update-1112611021004{i:05d}.htm',
             'title': f'Vietnam transport project update {i}'}
            for i in range(28)
        ]
        homepage = f'''<html><a class="box-focus-link-title" data-linktype="newsdetail"
            href="{urlsplit(article_url).path}" title="Decree on personal data protection adopted">
            Decree on personal data protection adopted</a></html>'''.encode()
        detail = b'''<html><main><h1 class="detail-title" data-role="title">Decree on personal data protection adopted</h1>
        <div class="detail-content"><p>The government adopted a decree introducing obligations to protect personal data.</p>
        <p>The new requirements apply to organizations that process personal information.</p></div></main></html>'''
        client = RouteProbeClient(source['hosts'], details={article_url: detail}, homepage=homepage)
        listing_calls = []

        def fetch_listing(source_id, client_arg, url):
            listing_calls.append(url)
            client_arg.last_http_status = 200
            client_arg.last_url = url
            return policy_rows, None

        with patch.object(catalog_probe, 'CrawleeClient', return_value=client), \
             patch.object(catalog_probe, 'fetch_listing', side_effect=fetch_listing), \
             patch.object(catalog_probe, 'extract_main_text', return_value=('Extracted official decree body. ' * 10, None)):
            result = catalog_probe.probe(source, {'sources': [{'source': 'vn-gov'}]})

        self.assertEqual(listing_calls, ['https://en.baochinhphu.vn/policies.htm'])
        self.assertEqual(client.get_requests[0], 'https://en.baochinhphu.vn/')
        self.assertIn(article_url, client.detail_requests)
        self.assertEqual(result['status'], 'listing_and_body_extracted')
        listing = result['listing']
        self.assertEqual(listing['fallback_reason'], 'policy_listing_had_no_privacy_relevant_candidates')
        self.assertEqual(listing['attempts'][0]['route'], 'https://en.baochinhphu.vn/policies.htm')
        self.assertEqual(listing['attempts'][0]['candidate_count'], 28)
        self.assertEqual(listing['attempts'][0]['relevant_candidate_count'], 0)
        self.assertEqual(listing['attempts'][0]['http_status'], 200)
        self.assertEqual(listing['attempts'][1]['route'], 'https://en.baochinhphu.vn/')
        self.assertEqual(listing['attempts'][1]['reason'], 'official_homepage_focus_fallback_after_empty_policy_match')
        self.assertEqual(listing['attempts'][1]['relevant_candidate_count'], 1)
        self.assertEqual(listing['candidates'][0]['url'], article_url)


if __name__ == '__main__':
    unittest.main()
