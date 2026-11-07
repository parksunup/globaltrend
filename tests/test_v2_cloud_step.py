import unittest
import io
from unittest.mock import patch

from scripts.collector import cloud_step as legacy, parsers
from scripts.collector_v2.cloud_step import prepare, supplement_official_pdf


class ShortBodyTests(unittest.TestCase):
    def test_public_pdf_with_empty_user_password_is_read(self):
        from pypdf import PdfWriter
        from pypdf._page import PageObject
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.encrypt(user_password='', owner_password='owner')
        output = io.BytesIO()
        writer.write(output)
        with patch.object(PageObject, 'extract_text', return_value='public text content ' * 4):
            pdf = parsers.extract_pdf(output.getvalue(), 'https://example.com/file.pdf')
        self.assertEqual(len(pdf['pages']), 1)

    def test_pdf_with_nonempty_user_password_is_held(self):
        from pypdf import PdfWriter
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.encrypt(user_password='secret')
        output = io.BytesIO()
        writer.write(output)
        with self.assertRaisesRegex(ValueError, 'pdf_limit_or_encrypted'):
            parsers.extract_pdf(output.getvalue(), 'https://example.com/file.pdf')

    def test_pdf_attachment_is_read_with_review_and_provenance(self):
        url = 'https://example.com/a.pdf'
        item = {'content_text': 'notice', 'metadata': {'related_documents': [{'url': url, 'read': False}], 'unread_attachments': [url]}}
        class Client:
            hosts = {'example.com'}
            def get(self, target): return b'%PDF-fake', target, 'application/pdf'
        with patch.object(parsers, 'extract_pdf', return_value={'pages': [{'text': 'official text'}], 'related_documents': []}):
            result = supplement_official_pdf(item, 'ppc', Client())
        self.assertIn('official text', result['content_text'])
        self.assertEqual(result['metadata']['unread_attachments'], [])
        self.assertTrue(result['metadata']['requires_review'])
        self.assertFalse(result['metadata']['ai_ready'])

    def test_pdf_failure_remains_unread(self):
        url = 'https://example.com/a.pdf'
        item = {'content_text': 'notice', 'metadata': {'related_documents': [{'url': url, 'read': False}], 'unread_attachments': [url]}}
        class Client:
            hosts = {'example.com'}
            def get(self, target): return b'bad', target, 'text/html'
        result = supplement_official_pdf(item, 'cn-tc260', Client())
        self.assertEqual(result['metadata']['unread_attachments'], [url])
        self.assertEqual(result['metadata']['pdf_attachment_failure'], 'attachment_not_pdf')

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
