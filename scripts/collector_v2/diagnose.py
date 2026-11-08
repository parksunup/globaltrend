"""Read-only Crawlee diagnostic using the existing source adapters."""
import json
import argparse
import datetime as dt
from pathlib import Path
from scripts.collector import parsers, expansion
from scripts.collector.core import fetch_listing
from scripts.collector_v2.transport import CrawleeClient
from scripts.collector_v2.extraction import fallback_main_text
from scripts.collector_v2.cloud_step import supplement_official_pdf
import re
from urllib.parse import urljoin, urlsplit
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
WEB = json.loads((ROOT/'config/collector-web.json').read_text(encoding='utf-8'))


def run_web_source(source, browser=False):
    spec = WEB[source]
    hosts = {urlsplit(url).hostname for url in spec['discovery']}
    hosts.discard(None)
    client = CrawleeClient(hosts, browser_hosts=hosts if browser else ())
    record = {'source': source, 'mode': 'crawlee', 'database_writes': False,
              'coverage_complete': False, 'status': 'failed'}
    try:
        candidates = []
        for listing in spec['discovery']:
            body, final, ctype = client.get(listing)
            if ctype not in ('text/html', 'application/xhtml+xml'):
                continue
            soup = BeautifulSoup(body, 'html.parser')
            for anchor in soup.select('a[href]'):
                target = urljoin(final, anchor['href'])
                if any(re.fullmatch(pattern, target) for pattern in spec['routes']):
                    candidates.append((target, anchor.get_text(' ', strip=True)))
            if candidates:
                break
        if not candidates:
            raise ValueError('no_current_url_matching_verified_official_route')
        url, title = candidates[0]
        body, final, ctype = client.get(url)
        if final != url and not any(re.fullmatch(pattern, final) for pattern in spec['routes']):
            raise ValueError('detail_redirect_outside_verified_route')
        item = fallback_main_text(body)
        if item is None:
            raise ValueError('trafilatura_body_too_short')
        record.update(status='parsed_sample', stage='detail', url=final,
                      title=title or None, characters=len(item['content_text']),
                      publication_date='unverified', requires_review=True)
    except Exception as exc:
        record.update(stage=record.get('stage', 'listing'), error=str(exc)[:300])
    record.update(requests=client.requests, downloaded_bytes=client.downloaded_bytes)
    return record


def run_source(config, since=None, until=None):
    name = config['source']
    if name in WEB and WEB[name].get('enabled', True):
        return run_web_source(name, browser=bool(config.get('browser_hosts')))
    client = CrawleeClient(config['hosts'], browser_hosts=config.get('browser_hosts', ()))
    result = {'source': name, 'mode': 'crawlee', 'database_writes': False,
              'coverage_complete': False, 'status': 'failed'}
    try:
        listing_url = config['listing']
        if name == 'ico':
            # The ICO adapter is a date-windowed search of WiredGov's official
            # ICO republication channel. Probe the same route as production.
            until = until or dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
            since = since or (dt.date.fromisoformat(until) - dt.timedelta(days=7)).isoformat()
            listing_url = parsers.ico_range_url(listing_url, since, until)
        rows, next_url = fetch_listing(name, client, listing_url)
        result.update(discovered=len(rows), next_url=next_url, stage='detail')
        if not rows:
            raise ValueError('listing_empty_or_structure_changed')
        row = rows[0]
        detail_url = expansion.detail_request_url(name, row['url']) if name in expansion.ROUTES else row['url']
        body, final, ctype = client.get(detail_url)
        if name in expansion.ROUTES:
            expansion.verify_detail_response(name, row['url'], final)
        item = parsers.extract_document(name, body, row['url'] if name == 'ec' else final, ctype, row)
        item = supplement_official_pdf(item, name, client)
        result.update(status='parsed_sample', url=row['url'], characters=len(item['content_text']),
                      published_date=item['published_date'], read_scope=item['metadata'].get('read_scope'),
                      pdf_text_attachment=item['metadata'].get('pdf_text_attachment'),
                      pdf_attachment_failure=item['metadata'].get('pdf_attachment_failure'),
                      requires_review=item['metadata'].get('requires_review'))
    except Exception as exc:
        result.update(stage=result.get('stage', 'listing'), error=str(exc)[:300])
    result.update(requests=client.requests, downloaded_bytes=client.downloaded_bytes)
    return result


def select_sources(sources, requested):
    """All enabled sources by default; explicit read-only probes can include held sources."""
    names = [name for name in (requested or []) if name != 'all']
    if not names:
        return [source for source in sources if source.get('enabled')]
    known = {source['source'] for source in sources}
    unknown = sorted(set(names) - known)
    if unknown:
        raise ValueError('unknown source: ' + ', '.join(unknown))
    return [source for source in sources if source['source'] in names]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='append')
    parser.add_argument('--browser', action='append', default=[])
    parser.add_argument('--since')
    parser.add_argument('--until')
    parser.add_argument('--output', default='work/collector-v2-probe.json')
    args = parser.parse_args()
    registry = json.loads((ROOT/'config/trend-collector.json').read_text(encoding='utf-8'))
    try:
        # Explicit read-only probes can inspect a source held from production
        # collection without changing its state.
        configs = select_sources(registry['sources'], args.source)
    except ValueError as error:
        parser.error(str(error))
    if args.since:
        dt.date.fromisoformat(args.since)
    if args.until:
        dt.date.fromisoformat(args.until)
    if args.since and args.until and args.since > args.until:
        parser.error('since must precede until')
    results = [run_source({**c, **({'browser_hosts': c['hosts']} if c['source'] in args.browser else {})},
                          since=args.since, until=args.until) for c in configs]
    target = Path(args.output)
    if not target.is_absolute(): target = ROOT / target
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({'sources': results}, ensure_ascii=False, indent=2), encoding='utf-8')
    for item in results:
        print(json.dumps({k: item[k] for k in ('source', 'status', 'stage', 'error', 'characters',
                         'pdf_text_attachment', 'pdf_attachment_failure', 'requires_review') if k in item}, ensure_ascii=False))
    if not results or any(item['status'] != 'parsed_sample' for item in results):
        raise SystemExit(3)


if __name__ == '__main__':
    main()

