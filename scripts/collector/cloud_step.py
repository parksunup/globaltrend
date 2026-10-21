"""Prepare one bounded Python collection step; the connector commits it atomically.

No credentials and no DB writes. An uncommitted bundle never advances DB state.
Use only with a live collector_cloud_take claim and collector_cloud_commit RPC.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from .core import HttpClient, FetchError, collect
from . import parsers

ROOT = Path(__file__).resolve().parents[2]


def validate_claim(claim):
    if claim.get('slug') not in ('oecd', 'ftc'):
        raise ValueError('cloud_source_not_assigned')
    expires = dt.datetime.fromisoformat(claim['lease_until'].replace('Z', '+00:00'))
    if expires <= dt.datetime.now(dt.timezone.utc):
        raise ValueError('lease_expired')


class PreparedStore:
    def __init__(self, cursor):
        self.cursor = cursor
        self.operations = []
        self.complete = False
        self.failure = None

    def resume(self, config, since, until):
        return self.cursor

    def ingest(self, config, url, item):
        if self.operations:
            raise ValueError('one_document_per_commit_required')
        self.operations.append({
            'p_source_id': config['source_id'], 'p_external_id': None,
            'p_canonical_url': url, 'p_title_original': item['title_original'],
            'p_published_at': item['published_date']+'T00:00:00Z' if item['published_date'] else None,
            'p_event_date': None, 'p_fetched_at': None,
            'p_language_code': config.get('language', 'en'),
            'p_document_type': 'press_release' if '/press-releases/' in url else 'news',
            'p_content_text': item['content_text'], 'p_content_hash': item['content_hash'],
            'p_raw_storage_path': None, 'p_metadata': item['metadata'],
            'p_instruction_version': 'trend-ko-v1',
        })
        # collect's provisional counters are removed from the output below.
        return {}

    def discovery_failure(self, config, url, title, error):
        self.failure = {'url': url, 'title': title, 'reason': error}

    def progress(self, config, since, until, cursor):
        self.cursor = cursor

    def checkpoint(self, config, until):
        self.complete = True


def prepare(claim):
    validate_claim(claim)
    registry = json.loads((ROOT/'config/trend-collector.json').read_text())
    config = next(c for c in registry['sources'] if c['source'] == claim['slug'])
    if config['source_id'] != claim['source_id']:
        raise ValueError('claim_source_mismatch')
    store = PreparedStore(claim['cursor'])
    client = HttpClient(config['hosts'], interval=2)
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    backlog = bool(claim.get('backlog_id'))
    if backlog:
        detail = claim['detail']
        result = {'source': claim['slug'], 'since': claim['since'], 'until': claim['until'],
                  'coverage_complete': False, 'status': 'partial', 'reason': 'backlog_detail_saved'}
        try:
            body, url, ctype = client.get(detail['url'])
            item = parsers.extract_document(claim['slug'], body, url, ctype, detail)
            item['metadata'].update(ai_ready=item['published_date'] is not None and not item['metadata']['requires_review'],
                                    relevance_reason='full_body_available_human_relevance_review_pending')
            if item['published_date'] and not claim['since'] <= item['published_date'] <= claim['until']:
                result['reason'] = 'backlog_out_of_range'
            else:
                store.ingest(config, url, item)
        except (FetchError, ValueError) as error:
            result.update(status='failed', reason=str(error), failed_url=detail['url'])
    else:
        result = collect(config, client, store, claim['since'], claim['until'], max_pages=1, max_items=1)
        if store.failure:
            # The commit RPC must persist this backlog before accepting the advance.
            store.failure['cursor'] = store.cursor
            store.cursor = {**store.cursor, 'offset': store.cursor['offset'] + 1}
            result.update(status='partial', reason='detail_failure_parked', parked_failure=store.failure)
    for field in ('new', 'changed', 'duplicate'):
        result.pop(field, None)
    result.update(runtime='cloud-python-connector', started_at=started,
                  prepared_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                  requests=client.budget['requests'], downloaded_bytes=client.budget['bytes'],
                  saved=False)
    return {'cursor': store.cursor, 'complete': store.complete, 'failure': store.failure,
            'backlog_resolved': backlog and result['status'] != 'failed',
            'operations': store.operations, 'result': result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--claim', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    bundle = prepare(json.loads(Path(args.claim).read_text()))
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2))
    print(json.dumps({'result': bundle['result'], 'prepared_operations': len(bundle['operations'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
