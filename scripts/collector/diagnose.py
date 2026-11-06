"""Read-only live listing/detail diagnostics for registered expansion adapters."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import json
from pathlib import Path
from .core import HttpClient, fetch_listing
from . import expansion, parsers

ROOT = Path(__file__).resolve().parents[2]


def diagnose(config):
    record = {'source': config['source'], 'status': 'failed', 'stage': 'listing',
              'coverage_complete': False, 'database_writes': False}
    client = HttpClient(config['hosts'], interval=2)
    try:
        rows, next_url = fetch_listing(config['source'], client, config['listing'])
        record.update(discovered=len(rows), next_url=next_url)
        if not rows:
            raise ValueError('listing_empty_or_structure_changed')
        record['stage'] = 'detail'
        row = rows[0]
        requested = expansion.detail_request_url(config['source'], row['url'])
        body, final, content_type = client.get(requested)
        expansion.verify_detail_response(config['source'], row['url'], final)
        item = parsers.extract_document(config['source'], body,
            row['url'] if config['source'] == 'ec' else final, content_type, row)
        record.update(status='parsed_sample', url=row['url'],
            title=item['title_original'], characters=len(item['content_text']),
            published_date=item['published_date'], metadata=item['metadata'])
    except Exception as error:
        record['error'] = str(error) if isinstance(error, ValueError) else type(error).__name__ + ':' + str(error)
    record.update(requests=client.budget['requests'], downloaded_bytes=client.budget['bytes'])
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='work/expansion-diagnostics.json')
    args = parser.parse_args()
    registry = json.loads((ROOT/'config/trend-collector.json').read_text(encoding='utf-8'))
    configs = [c for c in registry['sources'] if c.get('enabled') and c['source'] in expansion.ROUTES]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(diagnose, configs))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'sources': results}, ensure_ascii=False, indent=2), encoding='utf-8')
    for result in results:
        print(json.dumps({k: result[k] for k in ('source', 'status', 'error', 'characters') if k in result}))


if __name__ == '__main__':
    main()
