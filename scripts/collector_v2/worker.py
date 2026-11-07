"""Cloud worker that reuses existing Supabase lease, bundle and commit RPCs."""
import argparse
import datetime as dt
import json
import os
import uuid

from scripts.collector.store import SupabaseStore
from scripts.collector_v2.cloud_step import prepare


def owned_sources(configs):
    return [c['source'] for c in configs if c.get('enabled') and
            (c.get('executor') == 'cloud-python' or c['source'] in ('oecd', 'ftc'))]


def run(slugs, *, browser=False, all_owned=False, max_claims=1):
    if not 1 <= max_claims <= 100:
        raise ValueError('max_claims_out_of_range')
    store = SupabaseStore()
    worker = 'collector-v2:' + str(uuid.uuid4())
    summary = {'worker': worker, 'started_at': dt.datetime.now(dt.timezone.utc).isoformat(),
               'runtime': 'github-hosted', 'commits': [], 'status': 'partial'}
    registry = json.loads((__import__('pathlib').Path(__file__).resolve().parents[2] /
                           'config/trend-collector.json').read_text(encoding='utf-8'))
    configs = {c['source']: c for c in registry['sources']}
    if all_owned:
        slugs = owned_sources(registry['sources'])
    if not slugs:
        raise ValueError('no_owned_sources_selected')
    for slug in slugs:
        config = configs.get(slug)
        if not config or not config.get('enabled'):
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': 'source_not_enabled'})
            continue
        if config.get('executor') != 'cloud-python' and slug not in ('oecd', 'ftc'):
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': 'source_owned_by_other_executor'})
            continue
        gate = store.preflight(config)
        if not gate['allowed']:
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': gate['reason']})
            continue
        source_claims = 0
        while source_claims < max_claims:
            claim = store.rpc('collector_cloud_take', {'p_worker': worker, 'p_slug': slug})
            if not claim:
                summary['commits'].append({'source': slug, 'status': 'queue_empty'})
                break
            bundle = prepare(claim, browser_hosts=config['hosts'] if browser else ())
            source_claims += 1
            saved = store.rpc('collector_cloud_commit', {
                'p_source_id': claim['source_id'], 'p_worker': worker,
                'p_lease_token': claim['lease_token'], 'p_bundle': bundle,
                'p_execution_id': os.environ.get('GITHUB_RUN_ID', summary['worker'])})
            summary['commits'].append({'source': slug, 'status': 'committed',
                'run_status': bundle['result']['status'], 'saved_result': saved})
            if bundle['result']['status'] == 'failed':
                break
        else:
            summary['commits'].append({'source': slug, 'status': 'held', 'reason': 'claim_limit_reached'})
    summary['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
    summary['status'] = 'completed' if all(x['status'] in ('committed', 'queue_empty') and
        x.get('run_status') in (None, 'success') for x in summary['commits']) else 'partial'
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--source', action='append')
    selection.add_argument('--all-owned', action='store_true')
    parser.add_argument('--browser', action='store_true')
    parser.add_argument('--max-claims', type=int, default=1, help='maximum claims per source, 1–100')
    parser.add_argument('--output', default='work/collector-v2-worker.json')
    args = parser.parse_args()
    result = run(args.source, browser=args.browser, all_owned=args.all_owned, max_claims=args.max_claims)
    from pathlib import Path
    path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'status': result['status'], 'claims': len(result['commits'])}, ensure_ascii=False))
    if result['status'] != 'completed': raise SystemExit(3)


if __name__ == '__main__':
    main()
