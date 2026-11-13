"""Read-only live verification for the OAIC PublicNow alternate route."""
import json
import re

from . import expansion
from .core import FetchError, HttpClient


def main():
    source_url = expansion.ROUTES['oaic']['publicnow_source']
    hosts = expansion.ROUTES['oaic']['hosts']
    result = {
        'route': source_url,
        'status': 'failed',
        'robots_unavailable': [],
        'candidate_count': 0,
        'listing_error': None,
        'detail': None,
    }
    with HttpClient(hosts, interval=6) as client:
        try:
            listing, final_url, _ = client.get(source_url)
            rows, _ = expansion.discover('oaic', listing.decode('utf-8', 'replace'), final_url)
            result['candidate_count'] = len(rows)
            result['listing_url'] = final_url
            result['robots_unavailable'] = client.robots_unavailable
            if not rows:
                result['listing_error'] = 'no_validated_candidates'
            else:
                row = rows[0]
                detail_url = row['url']
                body, final_detail, _ = client.get(detail_url)
                extracted = expansion.extract('oaic', body.decode('utf-8', 'replace'), final_detail, row)
                result['detail'] = {
                    'url': final_detail,
                    'title_present': bool(extracted.get('title')),
                    'body_characters': len(extracted.get('content_text', '')),
                    'oaic_attribution': bool(re.search(r'\bOAIC\b|Office of the Australian Information Commissioner', body.decode('utf-8', 'replace'), re.I)),
                    'publisher_attribution': bool(re.search(r'Public Technologies', body.decode('utf-8', 'replace'), re.I)),
                }
                result['status'] = 'passed' if result['detail']['title_present'] and result['detail']['body_characters'] >= 80 and result['detail']['oaic_attribution'] and result['detail']['publisher_attribution'] else 'failed_validation'
                result['robots_unavailable'] = client.robots_unavailable
        except (FetchError, ValueError, KeyError, IndexError) as exc:
            result['listing_error'] = str(exc)[:200]
            result['robots_unavailable'] = client.robots_unavailable
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    if result['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
