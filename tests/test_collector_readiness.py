import unittest

from scripts.collector.readiness import mark_ai_readiness


class DraftReadinessTests(unittest.TestCase):
    def test_date_and_editorial_review_do_not_change_text_readiness(self):
        item = {
            'title_original': 'Official notice',
            'content_text': 'Readable source text.',
            'published_date': None,
            'metadata': {'requires_review': True},
        }

        result = mark_ai_readiness(item)

        self.assertIs(result, item)
        self.assertTrue(result['metadata']['ai_ready'])
        self.assertEqual(result['metadata']['draft_readiness_reason'], 'usable_title_and_source_text')
        self.assertTrue(result['metadata']['requires_review'])

    def test_missing_title_or_source_text_is_not_ready(self):
        for item in (
            {'title_original': '', 'content_text': 'Readable source text.', 'metadata': {}},
            {'title_original': 'Official notice', 'content_text': '  ', 'metadata': {}},
        ):
            with self.subTest(item=item):
                result = mark_ai_readiness(item)
                self.assertFalse(result['metadata']['ai_ready'])
                self.assertEqual(
                    result['metadata']['draft_readiness_reason'],
                    'missing_or_unusable_title_or_source_text',
                )


if __name__ == '__main__':
    unittest.main()
