"""Cloud worker that reuses existing Supabase lease, bundle and commit RPCs."""
import argparse
import datetime as dt
import json
import os
import uuid

from scripts.collector.store import SupabaseStore
from scripts.collector_v2.cloud_step import prepare


def run(slugs, *, browser=False):
    store = SupabaseStore()
    worker = 'collector-v2:' + str(uuid.uuid4())
    summary = {'worker': worker, 'started_at': dt.datetime.now(dt.timezone.utc).isoformat(),
               'runtime': 'github-hosted', 'commits': [], 'status': 'partial'}
    registry = json.loads((__import__('pathlib').Path(__file__).resolve().parents[2] /
                           'config/trend-collector.json').read_text(encoding='utf-8'))
    configs = {c['source']: c for c in registry['sources']}
    for slug in slugs:
        config = configs.get(slug)
        if not config or not config.get('enabled'):
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': 'source_not_enabled'})
            continue
        if config.get('executor') not in ('cloud-python', None) and slug not in ('oecd', 'ftc'):
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': 'source_owned_by_other_executor'})
            continue
        gate = store.preflight(config)
        if not gate['allowed']:
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': gate['reason']})
            continue
        while True:
            claim = store.rpc('collector_cloud_take', {'p_worker': worker, 'p_slug': slug})
            if not claim:
                summary['commits'].append({'source': slug, 'status': 'queue_empty'})
                break
            bundle = prepare(claim, browser_hosts=config['hosts'] if browser else ())
            saved = store.rpc('collector_cloud_commit', {
                'p_source_id': claim['source_id'], 'p_worker': worker,
                'p_lease_token': claim['lease_token'], 'p_bundle': bundle,
                'p_execution_id': os.environ.get('GITHUB_RUN_ID', summary['worker'])})
            summary['commits'].append({'source': slug, 'status': 'committed',
                'run_status': bundle['result']['status'], 'saved_result': saved})
            if bundle['result']['status'] == 'failed':
                break
    summary['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
    summary['status'] = 'completed' if all(x['status'] in ('committed', 'queue_empty') and
        x.get('run_status') in (None, 'success') for x in summary['commits']) else 'partial'
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='append', required=True)
    parser.add_argument('--browser', action='store_true')
    parser.add_argument('--output', default='work/collector-v2-worker.json')
    args = parser.parse_args()
    result = run(args.source, browser=args.browser)
    from pathlib import Path
    path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'status': result['status'], 'claims': len(result['commits'])}, ensure_ascii=False))
    if result['status'] != 'completed': raise SystemExit(3)


if __name__ == '__main__':
    main()
