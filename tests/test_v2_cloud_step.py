import unittest
from unittest.mock import patch

from scripts.collector import cloud_step as legacy, parsers
from scripts.collector_v2.cloud_step import prepare


class ShortBodyTests(unittest.TestCase):
    def test_short_successful_extraction_remains_for_review(self):
        item = {'content_text': 'short', 'metadata': {'requires_review': False}}

        def exercise(claim):
            return parsers.extract_document('ppc', b'', 'https://example.com/', 'text/html')

        with patch.object(parsers, 'extract_document', return_value=item), patch.object(legacy, 'prepare', side_effect=exercise):
            result = prepare({})
        self.assertTrue(result['metadata']['requires_review'])
        self.assertTrue(result['metadata']['short_body_review'])
        self.assertFalse(result['metadata']['ai_ready'])

    def test_long_successful_extraction_preserves_existing_review_decision(self):
        item = {'content_text': 'x' * 300, 'metadata': {'requires_review': False}}

        def exercise(claim):
            return parsers.extract_document('ppc', b'', 'https://example.com/', 'text/html')

        with patch.object(parsers, 'extract_document', return_value=item), patch.object(legacy, 'prepare', side_effect=exercise):
            result = prepare({})
        self.assertFalse(result['metadata']['requires_review'])
        self.assertNotIn('short_body_review', result['metadata'])


if __name__ == '__main__':
    unittest.main()
