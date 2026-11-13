import unittest

from scripts.collector import expansion, extraction
from tests.test_collector_publication_route_candidates import LISTINGS


class PublicationAdapterTests(unittest.TestCase):
    def test_each_observed_publication_listing_and_detail_uses_production_route(self):
        for source, (listing_url, listing_html) in LISTINGS.items():
            with self.subTest(source=source):
                rows, next_page = expansion.discover(source, listing_html, listing_url)
                self.assertEqual(len(rows), 1)
                self.assertIsNone(next_page)
                row = rows[0]
                self.assertTrue(expansion._canonical(row['url'], source, row['url']))
                body = ('The organization published a detailed privacy policy analysis. '
                        'The article explains the affected data, applicable legal rules, '
                        'regulatory response, and remaining questions for organizations.')
                detail = ('<html><head><meta property="article:published_time" '
                          'content="2026-11-06T10:00:00Z"></head><body><main><article>'
                          '<h1>Privacy policy analysis</h1><div class="article-body"><p>'
                          + body + '</p></div></article></main></body></html>')
                item = extraction.extract_document(source, detail.encode(), row['url'], 'text/html', row)
                self.assertGreater(len(item['content_text']), 100)
                self.assertFalse(item['metadata']['ai_ready'])
                self.assertTrue(item['metadata']['requires_review'])
                self.assertIn('published_attribute', {x['meaning'] for x in item['metadata']['date_observations']})

    def test_source_listing_date_parsing_is_explicit_and_yearless_date_stays_unknown(self):
        for source, expected in [('iapp', '2026-11-06'), ('fpf', '2026-10-29'), ('noyb', '2026-10-29')]:
            listing_url, html = LISTINGS[source]
            row = expansion.discover(source, html, listing_url)[0][0]
            self.assertEqual(expansion.listing_date(row), expected)
        listing_url, html = LISTINGS['overview-legal']
        row = expansion.discover('overview-legal', html, listing_url)[0][0]
        self.assertIsNone(expansion.listing_date(row))


if __name__ == '__main__':
    unittest.main()
