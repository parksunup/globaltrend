import unittest
from unittest.mock import patch

from scripts import catalog_probe


class FakeClient:
    def __init__(self, hosts):
        self.last_http_status = 200
        self.last_url = ''
        self.requests = 1
        self.downloaded_bytes = 1000
        self.detail_requests = []

    def get(self, url):
        self.detail_requests.append(url)
        if 'autoriteitpersoonsgegevens.nl/actueel/' in url:
            body=b'''<html><head><meta property="article:published_time" content="2026-10-30"></head>
            <main><h1>Handhavingsbeleid AP gepubliceerd</h1><article><p>De Autoriteit Persoonsgegevens heeft het handhavingsbeleid gepubliceerd. Dit artikel beschrijft de handhaving van regels voor persoonsgegevens en toezicht op organisaties.</p></article></main></html>'''
            self.requests+=1;self.downloaded_bytes+=len(body)
            return body,url,'text/html'
        raise AssertionError('Only the Netherlands AP official article detail may be requested')

    def close(self):
        pass


class CatalogProbeRssTests(unittest.TestCase):
    def _probe(self, source_id, row):
        source = next(item for item in catalog_probe.load_catalog()['sources'] if item['id'] == source_id)
        configured = {'sources': [{'source': source_id}]}
        client = FakeClient(source['hosts'])
        with patch.object(catalog_probe, 'CrawleeClient', return_value=client), \
             patch.object(catalog_probe, 'fetch_listing', return_value=([row], None)):
            result = catalog_probe.probe(source, configured)
        return result, client

    def test_npc_uses_full_content_encoded_body_without_detail_fetch(self):
        result, client = self._probe('npc-ph', {
            'url': 'https://privacy.gov.ph/sample/',
            'title': 'NPC privacy statement',
            'feed_text': 'The National Privacy Commission issued a privacy statement. ' * 30,
            'feed_body_source': 'rss_content_encoded',
            'rss_source': 'npc-ph',
            'date_observations': [{
                'meaning': 'listing_published_rfc822',
                'locator': 'rss item pubDate',
                'value': 'Fri, 06 Nov 2026 04:25:05 +0000',
                'raw': 'Fri, 06 Nov 2026 04:25:05 +0000',
            }],
        })
        self.assertEqual(result['status'], 'listing_and_body_extracted')
        self.assertEqual(result['sample']['body_scope'], 'full_article_from_official_rss_content_encoded')
        self.assertEqual(result['sample']['publication_date_candidate'], '2026-11-06')
        self.assertFalse(result['sample']['ai_ready'])
        self.assertTrue(result['sample']['requires_human_review'])
        self.assertFalse(result['detail_request_made'])
        self.assertEqual(client.detail_requests, [])

    def test_netherlands_ap_uses_protego_allowed_detail_and_trafilatura_body(self):
        result, client = self._probe('nl-ap', {
            'url': 'https://autoriteitpersoonsgegevens.nl/actueel/sample',
            'title': 'Privacy handhavingsbeleid gepubliceerd',
            'feed_text': 'De Autoriteit Persoonsgegevens heeft het privacybeleid openbaar gemaakt.',
            'feed_body_source': 'rss_content_or_description',
            'rss_source': 'nl-ap',
            'date_observations': [{
                'meaning': 'listing_published_rfc822',
                'locator': 'rss item pubDate',
                'value': 'Fri, 30 Oct 2026 00:07:29 +0100',
                'raw': 'Fri, 30 Oct 2026 00:07:29 +0100',
            }],
        })
        self.assertEqual(result['status'], 'listing_and_body_extracted')
        self.assertEqual(result['sample']['body_scope'], 'official_rss_discovery_plus_robots_allowed_detail')
        self.assertEqual(result['sample']['read_scope'], 'trafilatura_main_text')
        self.assertEqual(result['sample']['publication_date_candidate'], '2026-10-30')
        self.assertEqual(result['qualification']['full_article_available'], True)
        self.assertEqual(result['qualification']['detail_fetch_status'], 'fetched_robots_allowed_protego_0_6_2')
        self.assertFalse(result['sample']['ai_ready'])
        self.assertTrue(result['sample']['requires_human_review'])
        self.assertEqual(client.detail_requests, ['https://autoriteitpersoonsgegevens.nl/actueel/sample'])


if __name__ == '__main__':
    unittest.main()
