"""Read-only Crawlee diagnostic using the existing source adapters."""
import json
import argparse
from pathlib import Path
from scripts.collector import parsers, expansion
from scripts.collector.core import fetch_listing
from scripts.collector_v2.transport import CrawleeClient

ROOT = Path(__file__).resolve().parents[2]


def run_source(config):
    name = config['source']
    client = CrawleeClient(config['hosts'], browser_hosts=config.get('browser_hosts', ()))
    result = {'source': name, 'mode': 'crawlee', 'database_writes': False,
              'coverage_complete': False, 'status': 'failed'}
    try:
        rows, next_url = fetch_listing(name, client, config['listing'])
        result.update(discovered=len(rows), next_url=next_url, stage='detail')
        if not rows:
            raise ValueError('listing_empty_or_structure_changed')
        row = rows[0]
        detail_url = expansion.detail_request_url(name, row['url']) if name in expansion.ROUTES else row['url']
        body, final, ctype = client.get(detail_url)
        if name in expansion.ROUTES:
            expansion.verify_detail_response(name, row['url'], final)
        item = parsers.extract_document(name, body, row['url'] if name == 'ec' else final, ctype, row)
        result.update(status='parsed_sample', url=row['url'], characters=len(item['content_text']),
                      published_date=item['published_date'], read_scope=item['metadata'].get('read_scope'))
    except Exception as exc:
        result.update(stage=result.get('stage', 'listing'), error=str(exc)[:300])
    result.update(requests=client.requests, downloaded_bytes=client.downloaded_bytes)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='append')
    parser.add_argument('--browser', action='append', default=[])
    parser.add_argument('--output', default='work/collector-v2-probe.json')
    args = parser.parse_args()
    registry = json.loads((ROOT/'config/trend-collector.json').read_text(encoding='utf-8'))
    results = [run_source(c) for c in registry['sources'] if c.get('enabled') and (not args.source or c['source'] in args.source)]
    for result in results:
        if result['source'] in args.browser:
            config = next(c for c in registry['sources'] if c['source'] == result['source'])
            result.update(run_source({**config, 'browser_hosts': config['hosts']}))
    target = Path(args.output)
    if not target.is_absolute(): target = ROOT / target
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({'sources': results}, ensure_ascii=False, indent=2), encoding='utf-8')
    for item in results:
        print(json.dumps({k: item[k] for k in ('source', 'status', 'stage', 'error', 'characters') if k in item}, ensure_ascii=False))


if __name__ == '__main__':
    main()
