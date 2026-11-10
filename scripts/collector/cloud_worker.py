"""Drain approved cloud-python collector claims from a scheduled runner.

This runner uses only the existing collector_cloud_take/commit RPC contract.
It never changes a cursor outside the atomic commit RPC and never prints a
Supabase credential or lease token.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / 'config' / 'trend-collector.json'


class WorkerError(RuntimeError):
    pass


def _credentials(environ=None):
    env = os.environ if environ is None else environ
    base = (env.get('SUPABASE_URL') or '').rstrip('/')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY') or ''
    parsed = urllib.parse.urlsplit(base)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise WorkerError('supabase_url_missing_or_invalid')
    if not key:
        raise WorkerError('supabase_service_role_key_missing')
    if key.startswith('sb_publishable_'):
        raise WorkerError('supabase_secret_key_required')
    return base, key


def rpc_call(name, args, environ=None, opener=urllib.request.urlopen):
    if name not in ('collector_cloud_take', 'collector_cloud_commit'):
        raise WorkerError('rpc_not_allowed')
    base, key = _credentials(environ)
    body = json.dumps(args, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    headers = {
        'apikey': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    # Legacy service_role keys are JWTs and can be used as the bearer token.
    # New sb_secret keys must be sent on apikey only; Supabase rejects them as JWTs.
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    request = urllib.request.Request(
        base + '/rest/v1/rpc/' + name,
        data=body,
        method='POST',
        headers=headers,
    )
    try:
        with opener(request, timeout=30) as response:
            payload = response.read()
    except urllib.error.HTTPError as error:
        # Never read or include PostgREST error bodies: they can echo arguments.
        raise WorkerError(name + '_http_' + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise WorkerError(name + '_network_error') from None
    try:
        return json.loads(payload.decode('utf-8')) if payload else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise WorkerError(name + '_invalid_json_response') from None


def eligible_sources(registry_path=REGISTRY_PATH, source_id=None):
    registry = json.loads(Path(registry_path).read_text(encoding='utf-8'))
    configured = registry.get('sources')
    if not isinstance(configured, list):
        raise WorkerError('collector_registry_invalid')
    rows = [row for row in configured if isinstance(row, dict)
            and row.get('executor') == 'cloud-python' and row.get('enabled') is True
            and all(row.get('permissions', {}).get(k) is True for k in ('collect', 'store', 'ai'))]
    if source_id:
        rows = [row for row in rows if row.get('source') == source_id]
        if not rows:
            raise WorkerError('source_not_enabled_for_cloud_python')
    return rows


def _validate_claim(claim, source, worker):
    if not isinstance(claim, dict):
        raise WorkerError('cloud_claim_invalid')
    for field in ('slug', 'source_id', 'worker', 'lease_token', 'lease_until', 'msg_id', 'read_ct', 'since', 'until'):
        if field not in claim:
            raise WorkerError('cloud_claim_missing_' + field)
    if claim['slug'] != source['source'] or claim['source_id'] != source['source_id'] or claim['worker'] != worker:
        raise WorkerError('cloud_claim_identity_mismatch')
    try:
        lease_until = dt.datetime.fromisoformat(str(claim['lease_until']).replace('Z', '+00:00'))
    except ValueError:
        raise WorkerError('cloud_claim_lease_invalid') from None
    if lease_until.tzinfo is None or lease_until <= dt.datetime.now(dt.timezone.utc):
        raise WorkerError('cloud_claim_lease_expired')
    if not isinstance(claim['lease_token'], str) or not claim['lease_token']:
        raise WorkerError('cloud_claim_lease_token_invalid')
    return claim


def _validate_bundle(bundle, claim):
    if not isinstance(bundle, dict) or not isinstance(bundle.get('operations'), list) or not isinstance(bundle.get('result'), dict):
        raise WorkerError('cloud_bundle_invalid')
    if len(bundle['operations']) > 1:
        raise WorkerError('cloud_bundle_operation_count_invalid')
    result = bundle['result']
    if result.get('source') != claim['slug'] or result.get('since') != claim['since'] or result.get('until') != claim['until']:
        raise WorkerError('cloud_bundle_claim_mismatch')
    for operation in bundle['operations']:
        if not isinstance(operation, dict):
            raise WorkerError('cloud_bundle_operation_invalid')
        if operation.get('p_source_id') != claim['source_id']:
            raise WorkerError('cloud_bundle_source_mismatch')
    return bundle


def prepare_claim_file(claim_path, output_path, run=subprocess.run, python=sys.executable):
    # The service-role credential is never passed to the network/parsing child.
    child_env = {key: value for key, value in os.environ.items()
                 if key not in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                                'SUPABASE_ACCESS_TOKEN', 'SUPABASE_ANON_KEY')}
    command = [python, '-m', 'scripts.collector.cloud_step', '--claim', str(claim_path), '--output', str(output_path)]
    try:
        completed = run(command, cwd=ROOT, env=child_env, capture_output=True, text=True, check=False)
    except OSError:
        raise WorkerError('cloud_step_start_failed') from None
    if completed.returncode != 0:
        raise WorkerError('cloud_step_failed')
    try:
        return json.loads(Path(output_path).read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        raise WorkerError('cloud_step_bundle_missing_or_invalid') from None


def process_one(source, worker, call_rpc=rpc_call, prepare=prepare_claim_file, temp_root=None):
    claim = call_rpc('collector_cloud_take', {'p_worker': worker, 'p_slug': source['source']})
    if claim is None:
        return {'source': source['source'], 'status': 'idle'}
    claim = _validate_claim(claim, source, worker)
    with tempfile.TemporaryDirectory(prefix='collector-cloud-claim-', dir=temp_root) as directory:
        claim_path = Path(directory) / 'claim.json'
        output_path = Path(directory) / 'bundle.json'
        claim_path.write_text(json.dumps(claim, ensure_ascii=False), encoding='utf-8')
        bundle = _validate_bundle(prepare(claim_path, output_path), claim)
        committed = call_rpc('collector_cloud_commit', {
            'p_source_id': claim['source_id'],
            'p_worker': claim['worker'],
            'p_lease_token': claim['lease_token'],
            'p_bundle': bundle,
            'p_execution_id': str(uuid.uuid4()),
        })
    if not isinstance(committed, dict):
        raise WorkerError('cloud_commit_invalid_response')
    return {
        'source': source['source'],
        'status': 'committed',
        'event_id': committed.get('event_id'),
        'saved_count': len(committed.get('saved') or []),
        'retry_after_seconds': committed.get('retry_after_seconds'),
    }


def run_source(source, worker, call_rpc=rpc_call, prepare=prepare_claim_file):
    outcomes = []
    while True:
        outcome = process_one(source, worker, call_rpc=call_rpc, prepare=prepare)
        outcomes.append(outcome)
        if outcome['status'] == 'idle':
            return outcomes


def _worker_id(override=None, environ=None):
    if override:
        base = override
    else:
        env = os.environ if environ is None else environ
        run_id = env.get('GITHUB_RUN_ID') or uuid.uuid4().hex
        attempt = env.get('GITHUB_RUN_ATTEMPT') or '1'
        base = 'globaltrend-gha-' + run_id + '-' + attempt
    return base[:120]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', help='One configured cloud-python source; default is every enabled source.')
    parser.add_argument('--worker', help='Bounded worker ID; defaults to the GitHub run ID.')
    args = parser.parse_args(argv)
    try:
        sources = eligible_sources(source_id=args.source)
    except WorkerError as error:
        # Error identifiers contain no request/authorization bodies or secrets.
        print(json.dumps({'status': 'failed', 'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1

    worker_base = _worker_id(args.worker)
    results = []
    failed = False
    for source in sources:
        worker = worker_base + ':' + source['source']
        try:
            results.extend(run_source(source, worker))
        except WorkerError as error:
            # A source failure must not prevent the remaining configured sources
            # from being attempted. WorkerError identifiers are already sanitized.
            failed = True
            results.append({'source': source['source'], 'status': 'failed', 'error': str(error)})
        except Exception as error:
            # Keep unexpected errors attributable without echoing exception text,
            # which can contain request arguments or response data.
            failed = True
            results.append({'source': source['source'], 'status': 'failed',
                            'error': 'unexpected_' + type(error).__name__})
    status = 'partial' if failed else 'complete'
    print(json.dumps({'status': status, 'sources': results}, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
