import unittest
from unittest.mock import patch

from scripts.collector import expansion, parsers
from scripts.collector.web import normalize_document, ROUTES


class UnboundedCollectorScopeTests(unittest.TestCase):
    def test_verified_pagination_parser_accepts_pages_above_previous_ceiling(self):
        self.assertEqual(
            parsers.listing_page_number('https://www.edpb.europa.eu/news_en?page=1001'),
            1001,
        )

    def test_frozen_official_listing_cursor_accepts_more_than_one_hundred_urls(self):
        urls = [
            f'https://www.europarl.europa.eu/news/en/press-room/20261108IPR{i:08d}/privacy-update-{i}'
            for i in range(101)
        ]
        cursor = {
            'page': 'https://www.europarl.europa.eu/rss/doc/press-releases/en.xml',
            'offset': 100,
            'frozen_urls': urls,
            'frozen_next': None,
        }
        expansion._bounded_frozen_cursor(cursor, 'eu-parliament')

    def test_complete_web_article_is_not_rejected_for_arbitrary_title_or_body_length(self):
        body = 'The official authority describes its privacy decision and required measures. ' * 6000
        document = {
            'url': 'https://www.consilium.europa.eu/en/press/press-releases/2026/10/28/test/',
            'title': 'A complete official title ' * 100,
            'published_date': '2026-10-28',
            'body': body,
            'read_scope': 'official_full_article',
            'evidence': {
                'method': 'web_open',
                'ref': 'observed-page-reference',
                'publication_locator': 'press release header',
                'body_locator': 'article paragraphs',
                'complete_body': True,
                'accessed_at': '2026-10-29T01:00:00Z',
            },
        }
        # Test body-size validation independently from deployment activation.
        # EU Council remains held for its summary-only route and access review.
        route = dict(ROUTES['eu-council'], enabled=True)
        with patch.dict(ROUTES, {'eu-council': route}):
            result = normalize_document('eu-council', document, '2026-10-27', '2026-10-29')
        self.assertEqual(result['p_content_text'], body.strip())
        self.assertEqual(result['p_title_original'], document['title'].strip())


if __name__ == '__main__':
    unittest.main()
