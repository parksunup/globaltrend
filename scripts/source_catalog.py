"""Source-catalog contract shared by diagnostics and the Crawlee worker."""
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / 'config' / 'trend-source-catalog.json'


def load_catalog(path=CATALOG_PATH):
    catalog = json.loads(Path(path).read_text(encoding='utf-8'))
    if catalog.get('version') != 1 or not isinstance(catalog.get('sources'), list):
        raise ValueError('source_catalog_version_or_shape_invalid')
    seen = set()
    for source in catalog['sources']:
        slug = source.get('id')
        if not isinstance(slug, str) or not slug or slug in seen:
            raise ValueError('source_catalog_id_missing_or_duplicate')
        seen.add(slug)
        parsed = urlsplit(source.get('listing', ''))
        hosts = source.get('hosts')
        if parsed.scheme != 'https' or parsed.hostname not in hosts or not hosts:
            raise ValueError('source_catalog_listing_host_mismatch:' + slug)
        if source.get('cadence') not in ('daily', 'weekly'):
            raise ValueError('source_catalog_cadence_invalid:' + slug)
        if not source.get('language') or not source.get('kind') or not source.get('cohort'):
            raise ValueError('source_catalog_metadata_missing:' + slug)
    return catalog

