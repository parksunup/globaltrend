"""Read-only readiness test on the machine that will actually collect sources.

Never ingests, claims draft jobs, advances progress, or changes runtime switches.
"""
import argparse
import datetime as dt
import json
import os
import time
from pathlib import Path

from .core import HttpClient, FetchError
from .environment import runtime_info, runtime_problem
from .run import probe_source, source_eligibility
from .store import SupabaseStore

ROOT = Path(__file__).resolve().parents[2]
OPERATION_GATES = ('COLLECTION_ENABLED', 'FREE_LIMITS_VERIFIED', 'CLOUD_PIPELINE_VERIFIED')


def check(configs, samples):
    result = {
        'schema_version': 1,
        'mode': 'preflight',
        'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'runtime': runtime_info(),
        'selected_sources': [c['source'] for c in configs],
        'sources': [],
        'writes_performed': False,
        'coverage_complete': False,
        'automatic_korean_drafting': False,
        'schedule_switch_enabled': os.environ.get('SCHEDULE_ENABLED') == 'true',
        'scheduled_execution_observed': os.environ.get('GITHUB_ACTIONS') == 'true' and os.environ.get('RUN_EVENT') == 'schedule',
        'operation_gates': {k: os.environ.get(k) == 'true' for k in OPERATION_GATES},
        'collection_preflight_passed': False,
        'outcome': 'blocked',
        'operation_success': False,
        'activation_blockers': [],
        'stop_reason': runtime_problem(),
    }
    if result['stop_reason']:
        result['activation_blockers'].append(result['stop_reason'])
        return result
    budget = {'requests': 0, 'bytes': 0, 'started': time.monotonic()}
    store = None
    for config in configs:
        row = {'source': config['source'], 'status': 'held', 'reason': None}
        result['sources'].append(row)
        reasons = source_eligibility(config, require_id=True)
        if reasons:
            row['reason'] = reasons[0]
            continue
        try:
            if store is None:
                store = SupabaseStore()
            row['database'] = store.preflight(config)
            if not row['database']['allowed']:
                row['reason'] = row['database']['reason']
                continue
            client = HttpClient(config['hosts'], interval=6 if config['source'] == 'ico' else 2, budget=budget)
            probe, failed = probe_source(config, client, samples.get(config['source'], []))
            row['access'] = {k: v for k, v in probe.items() if k not in ('source', 'status', 'coverage_complete')}
            readable = (not failed and probe.get('listing', {}).get('status') == 'parsed'
                        and probe.get('detail', {}).get('status') == 'parsed')
            row['status'] = 'passed' if readable else 'failed'
            row['reason'] = None if readable else 'source_access_or_parser_failed'
        except (FetchError, ValueError, TypeError, KeyError, AttributeError) as error:
            row['status'] = 'failed'
            row['reason'] = str(error) if isinstance(error, FetchError) else 'invalid_readiness_response'
    result['collection_preflight_passed'] = bool(configs) and all(r['status'] == 'passed' for r in result['sources'])
    blockers = result['activation_blockers']
    if not result['collection_preflight_passed']:
        blockers.append('selected_source_checks_incomplete')
    if not all(result['operation_gates'].values()):
        blockers.append('operation_gates_not_verified')
    if not result['runtime']['scheduler_connected']:
        blockers.append('external_scheduler_unverified')
    default_branch = os.environ.get('COLLECTOR_DEFAULT_BRANCH')
    if result['runtime']['scheduler_connected'] and (not default_branch or os.environ.get('GITHUB_REF_NAME') != default_branch):
        blockers.append('workflow_not_on_default_branch')
    if not result['schedule_switch_enabled']:
        blockers.append('schedule_not_enabled')
    if not result['collection_preflight_passed']:
        result.update(outcome='failed', stop_reason='preflight_failed')
    elif not all(result['operation_gates'].values()):
        result.update(outcome='blocked', stop_reason='operation_gates_not_verified')
    else:
        result.update(outcome='preflight_passed', stop_reason=None)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source')
    parser.add_argument('--output', default='work/collector-result.json')
    args = parser.parse_args()
    registry = json.loads((ROOT / 'config/trend-collector.json').read_text())
    configs = [c for c in registry['sources'] if not args.source or c['source'] == args.source]
    if not configs:
        parser.error('unknown source')
    samples = {c['source']: json.loads((ROOT / f"data/trends/source-configs/{c['source']}.json").read_text()).get('sample_urls', [])[:1]
               for c in configs}
    result = check(configs, samples)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result['outcome'] == 'preflight_passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
