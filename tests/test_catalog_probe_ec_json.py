import json
import unittest
from unittest.mock import patch

from scripts import catalog_probe
from scripts.collector import expansion


class FakeEcClient:
    def __init__(self, hosts, payload):
        self.payload = payload
        self.last_http_status = 200
        self.last_url = ''
        self.requests = 0
        self.downloaded_bytes = 0
        self.detail_requests = []

    def get(self, url):
        expected = expansion.detail_request_url('ec', EC_ROW['url'])
        if url != expected:
            raise AssertionError(f'unexpected detail request: {url}')
        self.detail_requests.append(url)
        self.requests += 1
        self.downloaded_bytes += len(self.payload)
        self.last_url = url
        return self.payload, url, 'application/json'

    def close(self):
        pass


EC_ROW = {
    'url': 'https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2274',
    'title': 'Commission announces new privacy safeguards',
    'date_observations': [{'meaning': 'expansion_listing_published',
                           'locator': 'EC API eventDate', 'value': '2026-11-07'}],
}


def ec_payload(ref='IP/26/2274'):
    return json.dumps({
        'refCd': ref,
        'originalLanguage': 'en',
        'publishDate': '2026-11-07',
        'docuLanguageResource': {
            'title': 'Commission announces new privacy safeguards',
            'htmlContent': '''<p>The European Commission announced new privacy safeguards for people using digital services.</p>
            <p>The measures clarify how personal data must be protected and explain when organizations should notify individuals about risks.</p>
            <p>Implementation will begin after the publication of the related guidance.</p>''',
            'dolaQuoteResources': [{
                'extract': 'The safeguards reinforce the protection of personal data.',
                'author': {'authorName': 'European Commission'},
            }],
        },
    }).encode()


class CatalogProbeEcJsonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = next(row for row in catalog_probe.load_catalog()['sources'] if row['id'] == 'ec')

    def probe(self, payload, extract_main=None):
        client = FakeEcClient(self.source['hosts'], payload)
        configured = {'sources': [{'source': 'ec'}]}
        patches = [
            patch.object(catalog_probe, 'CrawleeClient', return_value=client),
            patch.object(catalog_probe, 'fetch_listing', return_value=([EC_ROW], None)),
        ]
        if extract_main is not None:
            patches.append(patch.object(catalog_probe, 'extract_main_text', side_effect=extract_main))
        with patches[0], patches[1]:
            if len(patches) == 3:
                with patches[2]:
                    result = catalog_probe.probe(self.source, configured)
            else:
                result = catalog_probe.probe(self.source, configured)
        return result, client

    def test_ec_json_api_unwraps_official_html_and_uses_trafilatura_first(self):
        with patch.object(expansion, 'extract', side_effect=AssertionError('EC parser is fallback-only')):
            result, client = self.probe(ec_payload())
        self.assertEqual(result['status'], 'listing_and_body_extracted')
        self.assertEqual(result['sample']['body_extractor'], 'trafilatura')
        self.assertEqual(result['sample']['read_scope'], 'trafilatura_main_text')
        self.assertEqual(result['sample']['title'], 'Commission announces new privacy safeguards')
        self.assertEqual(result['sample']['official_title'], result['sample']['title'])
        self.assertGreater(result['sample']['body_characters'], 100)
        self.assertEqual(result['sample']['publication_date_candidate'], '2026-11-07')
        self.assertEqual(result['sample']['date_evidence_source'], 'official EC API publishDate')
        self.assertEqual(result['sample']['date_observations'][0]['locator'], 'EC documents.publishDate')
        self.assertEqual(len(client.detail_requests), 1)

    def test_ec_parser_is_used_only_after_trafilatura_returns_no_main_text(self):
        calls = []
        original = expansion.extract

        def no_main_text(markup, url):
            calls.append('trafilatura')
            self.assertIn('Commission announces new privacy safeguards', markup.decode())
            return None, None

        def source_parser(source, payload, url, row):
            calls.append('ec_source_parser')
            return original(source, payload, url, row)

        with patch.object(expansion, 'extract', side_effect=source_parser):
            result, _ = self.probe(ec_payload(), extract_main=no_main_text)
        self.assertEqual(calls, ['trafilatura', 'ec_source_parser'])
        self.assertEqual(result['status'], 'listing_and_body_extracted')
        self.assertEqual(result['sample']['body_extractor'], 'source_specific_adapter_fallback')
        self.assertEqual(result['sample']['publication_date_candidate'], '2026-11-07')

    def test_ec_json_identity_mismatch_is_rejected_before_extraction(self):
        with self.assertRaisesRegex(ValueError, 'ec_detail_schema_or_identity_changed'):
            catalog_probe.ec_api_article_markup(ec_payload('IP/26/9999'), EC_ROW['url'])


if __name__ == '__main__':
    unittest.main()
