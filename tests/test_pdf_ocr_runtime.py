"""Exercise the installed OCR engine on an image-only PDF in cloud runners."""

import io
import shutil
import unittest

from scripts.collector.parsers import extract_pdf


class PdfOcrRuntimeTests(unittest.TestCase):
    def test_scanned_document_receives_searchable_text(self):
        if not shutil.which('ocrmypdf'):
            self.skipTest('OCRmyPDF is installed on the cloud collector runners')
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            self.skipTest('Pillow is only required for the cloud OCR integration test')
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 42)
        page = Image.new('RGB', (1300, 250), 'white')
        ImageDraw.Draw(page).text((45, 70), 'PRIVACY DATA PROTECTION REPORT', fill='black', font=font)
        document = io.BytesIO()
        page.save(document, format='PDF', resolution=150)
        result = extract_pdf(document.getvalue(), 'https://example.org/scanned.pdf', 'pdpc')
        self.assertEqual(result['ocr_pages'], [1])
        self.assertEqual(result['extraction_method'], 'ocrmypdf+pypdf')
        self.assertIn('PRIVACY DATA PROTECTION REPORT', result['pages'][0]['text'].upper())


if __name__ == '__main__':
    unittest.main()
