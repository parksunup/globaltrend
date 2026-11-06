"""Read-only checks for Crawlee collection and retained-draft contracts."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path

from scripts.collector.environment import runtime_info
from scripts.collector.store import SupabaseStore

ROOT = Path(__file__).resolve().parents[2]


def run(store, configs=None):
    """Call only read RPCs; never claim work or write source data."""
    if configs is None:
        registry = json.loads((ROOT / 'config/trend-collector.json').read_text(encoding='utf-8'))
        configs = [item for item in registry['sources'] if item.get('enabled')]
    local_policy = json.loads((ROOT / 'config/trend-writing-policy.json').read_text(encoding='utf-8'))
    result = {
        'mode': 'crawlee-preflight',
        'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'runtime': runtime_info(),
        'writes_performed': False,
        'coverage_complete': False,
        'sources': [],
        'draft_policy': None,
        'writing_policy': None,
        'draft_generation': {
            'provider': 'openai',
            'api_key_configured': bool(os.environ.get('DRAFT_API_KEY')),
            'model': os.environ.get('DRAFT_MODEL', '').strip() or None,
            'ready': bool(os.environ.get('DRAFT_API_KEY') and os.environ.get('DRAFT_MODEL', '').strip()),
        },
        'status': 'failed',
    }
    for config in configs:
        row = {'source': config['source'], 'status': 'failed'}
        try:
            row['database'] = store.preflight(config)
            row['status'] = 'passed' if row['database'].get('allowed') else 'failed'
        except Exception as error:
            row['error'] = str(error)[:300]
        result['sources'].append(row)
    try:
        draft_policy = store.rpc('collector_draft_policy', {})
        result['draft_policy'] = {
            'policy_version': draft_policy.get('policy_version'),
            'daily_claim_limit': draft_policy.get('daily_claim_limit'),
            'targeted_claim_supported': draft_policy.get('targeted_claim_supported'),
            'matches_contract': draft_policy == {
                'policy_version': 'trend-draft-unlimited-v2',
                'daily_claim_limit': None,
                'targeted_claim_supported': True,
            },
        }
    except Exception as error:
        result['draft_policy'] = {'matches_contract': False, 'error': str(error)[:300]}
    try:
        writing_policy = store.rpc('collector_writing_policy', {})
        hashes_match = writing_policy.get('instruction_hashes') == local_policy['instruction_hashes']
        result['writing_policy'] = {
            'policy_id': writing_policy.get('policy_id'),
            'job_instruction_version': writing_policy.get('job_instruction_version'),
            'instruction_hashes_match': hashes_match,
            'matches_contract': hashes_match and
                writing_policy.get('policy_id') == local_policy['policy_id'] and
                writing_policy.get('job_instruction_version') == local_policy['job_instruction_version'],
        }
    except Exception as error:
        result['writing_policy'] = {'matches_contract': False, 'error': str(error)[:300]}
    result['status'] = 'passed' if (
        bool(configs) and all(item['status'] == 'passed' for item in result['sources']) and
        result['draft_policy'].get('matches_contract') and
        result['writing_policy'].get('matches_contract')
    ) else 'failed'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='append')
    parser.add_argument('--output', default='work/collector-v2-preflight.json')
    args = parser.parse_args()
    registry = json.loads((ROOT / 'config/trend-collector.json').read_text(encoding='utf-8'))
    configs = [item for item in registry['sources'] if item.get('enabled') and
               (not args.source or item['source'] in args.source)]
    if not configs:
        parser.error('no enabled sources selected')
    result = run(SupabaseStore(), configs)
    output = Path(args.output)
    if not output.is_absolute():
        output = ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'status': result['status'],
        'sources': len(result['sources']),
        'allowed': sum(item['status'] == 'passed' for item in result['sources']),
        'draft_policy_matches': result['draft_policy']['matches_contract'],
        'writing_policy_matches': result['writing_policy']['matches_contract'],
        'draft_api_key_configured': result['draft_generation']['api_key_configured'],
        'draft_model_configured': bool(result['draft_generation']['model']),
        'draft_generation_ready': result['draft_generation']['ready'],
        'writes_performed': False,
    }, ensure_ascii=False))
    if result['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
