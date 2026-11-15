import json
import unittest

from scripts.collector import expansion
from scripts.collector import parsers


LISTING = (
    'https://www.gov.br/anpd/++api++/@search?portal_type=News%20Item'
    '&path=%2Fpt-br%2Fassuntos%2Fnoticias&sort_on=effective'
    '&sort_order=descending&b_size=2'
)
ARTICLE = 'https://www.gov.br/anpd/pt-br/assuntos/noticias/noticia-um'


def listing_item(slug, title, effective, description='Proteção de dados pessoais'):
    return {
        '@id': 'https://www.gov.br/anpd/pt-br/assuntos/noticias/' + slug,
        '@type': 'News Item',
        'review_state': 'published',
        'title': title,
        'description': description,
        'effective': effective,
    }


class AnpdPloneApiTests(unittest.TestCase):
    def test_listing_validates_published_items_and_builds_verified_next_page(self):
        payload = {
            '@id': 'https://www.gov.br/anpd/@search?portal_type=News+Item',
            'items_total': 3,
            'items': [
                listing_item('noticia-um', 'ANPD publica orientação sobre dados pessoais', '2026-11-06T12:50:06+00:00'),
                listing_item('noticia-dois', 'ANPD abre consulta sobre proteção de dados', '2026-11-05T10:00:00+00:00'),
            ],
            'batching': {'next': 'https://www.gov.br/anpd/@search?b_start=2'},
        }
        rows, next_url = expansion.discover('anpd-br', json.dumps(payload), LISTING)
        self.assertEqual(2, len(rows))
        self.assertEqual('2026-11-06', expansion.listing_date(rows[0]))
        self.assertEqual('2026-11-05', expansion.listing_date(rows[1]))
        self.assertEqual('Proteção de dados pessoais', rows[0]['source_description'])
        self.assertEqual(
            'https://www.gov.br/anpd/++api++/@search?portal_type=News+Item&path=%2Fpt-br%2Fassuntos%2Fnoticias&sort_on=effective&sort_order=descending&b_size=2&b_start=2',
            next_url,
        )

    def test_listing_final_page_has_no_next_page(self):
        payload = {
            'items_total': 3,
            'items': [listing_item('noticia-tres', 'ANPD publica atualização da LGPD', '2026-11-04T09:00:00+00:00')],
        }
        url = LISTING + '&b_start=2'
        rows, next_url = expansion.discover('anpd-br', json.dumps(payload), url)
        self.assertEqual(1, len(rows))
        self.assertIsNone(next_url)

    def test_listing_rejects_unverified_query_identity_date_or_incomplete_page(self):
        payload = {'items_total': 1, 'items': [listing_item('noticia-um', 'ANPD notícia', '2026-11-06T12:00:00+00:00')]}
        for bad_url in (LISTING.replace('sort_order=descending', 'sort_order=ascending'),
                        LISTING.replace('/anpd/++api++/@search', '/anpd/elsewhere')):
            with self.subTest(url=bad_url), self.assertRaises(ValueError):
                expansion.discover('anpd-br', json.dumps(payload), bad_url)
        bad_item = {**payload, 'items': [listing_item('noticia-um', 'ANPD notícia', 'not-a-date')]}
        with self.assertRaisesRegex(ValueError, 'effective_date_missing'):
            expansion.discover('anpd-br', json.dumps(bad_item), LISTING)
        incomplete = {**payload, 'items': []}
        with self.assertRaisesRegex(ValueError, 'page_incomplete'):
            expansion.discover('anpd-br', json.dumps(incomplete), LISTING)

    def test_detail_reads_ordered_plaintext_and_official_effective_date(self):
        payload = {
            '@id': ARTICLE,
            '@type': 'News Item',
            'review_state': 'published',
            'title': 'ANPD orienta sobre transferências internacionais',
            'effective': '2026-11-06T12:50:06+00:00',
            'blocks_layout': {'items': ['lead', 'section', 'related']},
            'blocks': {
                'lead': {'@type': 'slate', 'plaintext': 'A ANPD publicou orientação sobre proteção de dados pessoais.'},
                'section': {'@type': 'slate', 'plaintext': 'A medida trata das transferências internacionais e dos direitos dos titulares.'},
                'related': {'@type': 'slate', 'plaintext': 'LEIA TAMBÉM » notícia relacionada'},
            },
        }
        item = expansion.extract('anpd-br', json.dumps(payload), ARTICLE)
        self.assertEqual('2026-11-06', item['published_date'])
        self.assertIn('A ANPD publicou orientação', item['content_text'])
        self.assertIn('direitos dos titulares', item['content_text'])
        self.assertNotIn('LEIA TAMBÉM', item['content_text'])
        self.assertEqual('official_plone_rest_api', item['metadata']['extraction_method'])
        self.assertEqual('official_news_item_body', item['metadata']['read_scope'])

    def test_runtime_parser_dispatch_accepts_json_detail_body(self):
        payload = {
            '@id': ARTICLE,
            '@type': 'News Item',
            'review_state': 'published',
            'title': 'ANPD publica orientação',
            'effective': '2026-11-06T12:50:06+00:00',
            'blocks_layout': {'items': ['body']},
            'blocks': {'body': {'@type': 'slate', 'plaintext': 'A ANPD publicou orientação sobre proteção de dados pessoais.'}},
        }
        item = parsers.extract_document('anpd-br', json.dumps(payload).encode(), ARTICLE, 'application/json')
        self.assertEqual('2026-11-06', item['published_date'])

        with self.assertRaisesRegex(ValueError, 'anpd_detail_json_invalid'):
            parsers.extract_document('anpd-br', b'<html/>', ARTICLE, 'text/html')

    def test_detail_api_identity_and_date_must_match_listing(self):
        self.assertEqual(
            'https://www.gov.br/anpd/++api++/pt-br/assuntos/noticias/noticia-um',
            expansion.detail_request_url('anpd-br', ARTICLE),
        )
        expansion.verify_detail_response('anpd-br', ARTICLE,
            'https://www.gov.br/anpd/++api++/pt-br/assuntos/noticias/noticia-um')
        with self.assertRaisesRegex(ValueError, 'identity_mismatch'):
            expansion.extract('anpd-br', json.dumps({
                '@id': 'https://www.gov.br/anpd/pt-br/assuntos/noticias/outro',
                '@type': 'News Item', 'review_state': 'published', 'title': 'Notícia',
                'effective': '2026-11-06T12:00:00+00:00',
                'blocks_layout': {'items': ['b']}, 'blocks': {'b': {'@type': 'slate', 'plaintext': 'Texto integral da notícia.'}},
            }), ARTICLE)

    def test_descending_listing_stops_after_period_boundary(self):
        rows = [
            {'date_observations': [{'meaning': 'expansion_listing_published', 'locator': 'ANPD', 'value': '2026-11-05T12:00:00+00:00'}]},
            {'date_observations': [{'meaning': 'expansion_listing_published', 'locator': 'ANPD', 'value': '2026-10-01T12:00:00+00:00'}]},
        ]
        self.assertIsNone(expansion.next_within_window('anpd-br', rows,
            'https://www.gov.br/anpd/++api++/@search?b_start=10', '2026-11-01'))


if __name__ == '__main__':
    unittest.main()
