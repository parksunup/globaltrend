import sys
import types
import unittest
from unittest.mock import patch

from scripts.collector import extraction


class CollectorExtractionOrderTests(unittest.TestCase):
    def test_trafilatura_body_is_primary_and_adapter_body_is_not_used(self):
        order = []
        fake = types.SimpleNamespace(
            extract=lambda *args, **kwargs: (order.append('trafilatura') or 'Trafilatura body. ' * 12),
            extract_metadata=lambda *args, **kwargs: None)
        adapter_item = {'title_original': 'Adapter title', 'content_text': 'Adapter body',
                        'content_hash': 'adapter-hash', 'published_date': '2026-10-01',
                        'metadata': {'requires_review': True, 'date_observations': [{'value': '2026-10-01'}]}}
        with patch.dict(sys.modules, {'trafilatura': fake}), patch.object(
                extraction.parsers, 'extract_document',
                side_effect=lambda *args, **kwargs: (order.append('metadata-adapter') or adapter_item)) as source_parser:
            item = extraction.extract_document(
                'cnil', b'<html><main>article</main></html>',
                'https://www.cnil.fr/example', 'text/html', {'title': 'Official item'})
        source_parser.assert_called_once()
        self.assertEqual(order, ['trafilatura', 'metadata-adapter'])
        self.assertEqual(item['content_text'], ' '.join(['Trafilatura body.'] * 12))
        self.assertEqual(item['published_date'], '2026-10-01')
        self.assertEqual(item['metadata']['extraction_method'], 'trafilatura')
        self.assertTrue(item['metadata']['requires_review'])

    def test_source_parser_runs_only_after_trafilatura_cannot_extract(self):
        expected = {'title_original': 'Fallback', 'content_text': 'Body', 'content_hash': 'hash',
                    'published_date': None, 'metadata': {'requires_review': True}}
        fake = types.SimpleNamespace(extract=lambda *args, **kwargs: None)
        with patch.dict(sys.modules, {'trafilatura': fake}), patch.object(
                extraction.parsers, 'extract_document', return_value=expected) as source_parser:
            item = extraction.extract_document(
                'cnil', b'<html></html>', 'https://www.cnil.fr/example',
                'text/html', {'title': 'Fallback'})
        source_parser.assert_called_once()
        self.assertEqual(item['metadata']['extraction_method'], 'source_parser_fallback')
        self.assertEqual(item['metadata']['trafilatura_first_attempt'], 'no_usable_main_text')

    def test_nonempty_short_trafilatura_body_is_not_rejected_by_character_threshold(self):
        fake = types.SimpleNamespace(
            extract=lambda *args, **kwargs: 'Short body.',
            extract_metadata=lambda *args, **kwargs: types.SimpleNamespace(title='Short title', date=None))
        adapter_item = {'title_original': 'Adapter title', 'content_text': 'Adapter body',
                        'content_hash': 'adapter-hash', 'published_date': None,
                        'metadata': {'requires_review': True}}
        with patch.dict(sys.modules, {'trafilatura': fake}), patch.object(
                extraction.parsers, 'extract_document', return_value=adapter_item) as source_parser:
            item = extraction.extract_document(
                'new-source', b'<html><body><p>Short body.</p></body></html>',
                'https://example.org/news/1', 'text/html', {'title': 'Short title'})
        source_parser.assert_called_once()
        self.assertEqual(item['content_text'], 'Short body.')
        self.assertEqual(item['metadata']['extraction_method'], 'trafilatura')

    def test_document_heading_wins_over_listing_teaser_and_adapter_cannot_bypass_review(self):
        fake = types.SimpleNamespace(
            extract=lambda *args, **kwargs: 'A complete article body with verified facts. ' * 8,
            extract_metadata=lambda *args, **kwargs: types.SimpleNamespace(title='Site name | teaser', date=None))
        adapter_item = {'title_original': 'Adapter title', 'content_text': 'Adapter body',
                        'content_hash': 'adapter-hash', 'published_date': '2026-10-01',
                        'metadata': {'requires_review': False, 'ai_ready': True,
                                     'date_observations': [{'value': '2026-10-01'}]}}
        html = b'<html><main><h1>Actual article title</h1><p>Article</p></main></html>'
        with patch.dict(sys.modules, {'trafilatura': fake}), patch.object(
                extraction.parsers, 'extract_document', return_value=adapter_item):
            item = extraction.extract_document(
                'cnil', html, 'https://www.cnil.fr/example', 'text/html',
                {'title': 'Short listing teaser'})
        self.assertEqual(item['title_original'], 'Actual article title')
        self.assertFalse(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertEqual(item['metadata']['body_review_status'],
                         'machine_extracted_not_human_reviewed')

    def test_official_edps_rss_post_retains_full_text_and_explicit_date(self):
        item=extraction.extract_official_rss_post({
            'rss_source':'edps',
            'title':'Datapedia: Automated proctoring',
            'feed_text':'The EDPS published a privacy update with findings and recommendations.',
            'date_observations':[{'meaning':'listing_published_rfc822','locator':'rss item pubDate',
                                  'value':'Sun, 08 Nov 2026 08:36:16 +0000'}]})
        self.assertEqual(item['published_date'],'2026-11-08')
        self.assertIn('findings and recommendations',item['content_text'])
        self.assertEqual(item['metadata']['read_scope'],'official_rss_item_full_post')
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])


if __name__ == '__main__':
    unittest.main()
