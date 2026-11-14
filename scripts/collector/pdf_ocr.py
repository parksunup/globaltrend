"""Shared OCR fallback for official PDFs handled by cloud Python collectors.

The source PDF is never published or modified in place.  OCRmyPDF adds a text
layer to scanned pages in a temporary copy; pypdf remains the text extractor.
"""

from functools import lru_cache
import json
from pathlib import Path
import subprocess
import tempfile


LANGUAGES = {
    'en': 'eng', 'es': 'spa', 'fr': 'fra', 'ja': 'jpn',
    'nl': 'nld', 'pt': 'por', 'zh': 'chi_sim+chi_tra',
}


@lru_cache(maxsize=1)
def _source_languages():
    catalog = Path(__file__).resolve().parents[2] / 'config' / 'trend-collector.json'
    sources = json.loads(catalog.read_text(encoding='utf-8'))['sources']
    return {item['source']: item.get('language', 'en') for item in sources}


def ocr_language(source=None):
    """Use the registered source language, retaining English for mixed PDFs."""
    language = LANGUAGES.get(_source_languages().get(source, 'en'), 'eng')
    return language if language == 'eng' else 'eng+' + language


def add_text_layer(pdf_bytes, source=None, pages=None):
    """Return a temporary OCR copy; raise a stable error when OCR cannot run."""
    with tempfile.TemporaryDirectory(prefix='globaltrend-pdf-ocr-') as directory:
        source_path = Path(directory) / 'source.pdf'
        output_path = Path(directory) / 'searchable.pdf'
        source_path.write_bytes(pdf_bytes)
        command = ['ocrmypdf', '--redo-ocr', '--output-type', 'pdf',
                   '--optimize', '0', '--language', ocr_language(source)]
        if pages:
            command.extend(['--pages', ','.join(str(page) for page in pages)])
        command.extend([str(source_path), str(output_path)])
        try:
            result = subprocess.run(command, capture_output=True, check=False, timeout=900)
        except FileNotFoundError:
            raise ValueError('pdf_ocr_runtime_missing') from None
        except subprocess.TimeoutExpired:
            raise ValueError('pdf_ocr_timeout') from None
        if result.returncode != 0 or not output_path.is_file():
            # stderr can contain document text or filesystem paths. Keep only
            # the exit status in collector events.
            raise ValueError('pdf_ocr_failed_exit_' + str(result.returncode))
        return output_path.read_bytes()
