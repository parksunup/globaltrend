"""Trafilatura-assisted main-text fallback without date or policy inference."""
import hashlib
from trafilatura import extract


def fallback_main_text(html: bytes) -> dict | None:
    """Return a competing body candidate; adapters still own metadata evidence."""
    text = extract(html, output_format='txt', include_comments=False,
                   include_tables=True, favor_precision=True)
    if not text or len(text.strip()) < 100:
        return None
    normalized = '\n'.join(line.strip() for line in text.splitlines() if line.strip())
    return {'content_text': normalized,
            'content_hash': hashlib.sha256(normalized.encode('utf-8')).hexdigest(),
            'extractor': 'trafilatura-2.3.1',
            'metadata_evidence': 'unchanged; source adapter remains authoritative'}
