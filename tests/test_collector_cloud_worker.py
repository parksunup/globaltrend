import datetime as dt
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest.mock import patch

from scripts.collector import cloud_worker


SOURCE = {
    'source': 'ec',
    'source_id': 'source-uuid',
    'executor': 'cloud-python',
    'enabled': True,
    'permissions': {'collect': True, 'store': True, 'ai': True},
}


def claim_for(source=SOURCE, worker='test-worker'):
    return {
        'slug': source['source'],
        'source_id': source['source_id'],
        'worker': worker,
        'lease_token': 'lease-secret',
        'lease_until': (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)).isoformat(),
        'msg_id': 123,
        'read_ct': 1,
        'since': '2026-11-01',
        'until': '2026-11-08',
        'cursor': None,
    }


def bundle_for(claim):
    return {
        'cursor': {'page': 'https://example.test/next'},
        'complete': False,
        'failure': None,
        'backlog_resolved': False,
        'operations': [],
        'result': {
            'source': claim['slug'],
            'since': claim['since'],
            'until': claim['until'],
            'status': 'partial',
            'coverage_complete': False,
        },
    }


class CloudWorkerTests(unittest.TestCase):
    def test_idle_claim_is_normal_and_does_not_prepare_or_commit(self):
        calls = []

        def rpc(name, args):
            calls.append((name, args))
            return None

        def prepare(*args):
            self.fail('idle claim must not run collector')

        outcome = cloud_worker.process_one(SOURCE, 'test-worker', call_rpc=rpc, prepare=prepare)
        self.assertEqual(outcome, {'source': 'ec', 'status': 'idle'})
        self.assertEqual(calls, [('collector_cloud_take', {'p_worker': 'test-worker', 'p_slug': 'ec'})])

    def test_claim_commits_exact_bundle_with_exact_lease_identity(self):
        claim = claim_for()
        bundle = bundle_for(claim)
        calls = []

        def rpc(name, args):
            calls.append((name, args))
            return claim if name.endswith('_take') else {
                'event_id': 'event-uuid', 'saved': [], 'retry_after_seconds': 0,
            }

        observed = {}

        def prepare(claim_path, output_path):
            observed['claim_path'] = Path(claim_path)
            observed['output_path'] = Path(output_path)
            observed['claim'] = json.loads(Path(claim_path).read_text(encoding='utf-8'))
            return bundle

        with tempfile.TemporaryDirectory() as temp_root:
            outcome = cloud_worker.process_one(SOURCE, 'test-worker', call_rpc=rpc,
                                                prepare=prepare, temp_root=temp_root)
            self.assertEqual(list(Path(temp_root).iterdir()), [])

        take_name, take_args = calls[0]
        commit_name, commit_args = calls[1]
        self.assertEqual(take_name, 'collector_cloud_take')
        self.assertEqual(take_args, {'p_worker': 'test-worker', 'p_slug': 'ec'})
        self.assertEqual(commit_name, 'collector_cloud_commit')
        self.assertEqual(commit_args['p_source_id'], claim['source_id'])
        self.assertEqual(commit_args['p_worker'], claim['worker'])
        self.assertEqual(commit_args['p_lease_token'], claim['lease_token'])
        self.assertEqual(commit_args['p_bundle'], bundle)
        self.assertEqual(outcome['status'], 'committed')
        self.assertEqual(outcome['event_id'], 'event-uuid')
        self.assertNotIn('lease_token', json.dumps(outcome))

    def test_commit_error_is_propagated_without_cursor_retry_or_manual_mutation(self):
        claim = claim_for()
        bundle = bundle_for(claim)
        calls = []

        def rpc(name, args):
            calls.append((name, args))
            if name.endswith('_take'):
                return claim
            raise cloud_worker.WorkerError('collector_cloud_commit_http_409')

        with self.assertRaisesRegex(cloud_worker.WorkerError, 'commit_http_409'):
            cloud_worker.process_one(SOURCE, 'test-worker', call_rpc=rpc,
                                     prepare=lambda *_: bundle)
        self.assertEqual([name for name, _ in calls], [
            'collector_cloud_take', 'collector_cloud_commit',
        ])
        self.assertNotIn('cursor', calls[1][1])

    def test_disabled_and_unassigned_sources_are_not_selected(self):
        registry = {'sources': [
            SOURCE,
            {**SOURCE, 'source': 'disabled', 'enabled': False},
            {**SOURCE, 'source': 'no-store', 'permissions': {'collect': True, 'store': False, 'ai': True}},
            {**SOURCE, 'source': 'edge', 'executor': 'edge'},
        ]}
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / 'registry.json'
            registry_path.write_text(json.dumps(registry), encoding='utf-8')
            self.assertEqual([row['source'] for row in cloud_worker.eligible_sources(registry_path)], ['ec'])
            with self.assertRaisesRegex(cloud_worker.WorkerError, 'source_not_enabled_for_cloud_python'):
                cloud_worker.eligible_sources(registry_path, source_id='disabled')

    def test_configured_cloud_sources_include_edps_official_rss(self):
        sources = cloud_worker.eligible_sources()
        by_slug = {row['source']: row for row in sources}
        self.assertTrue({'ec', 'eu-parliament', 'edps'}.issubset(by_slug))
        self.assertEqual(by_slug['edps']['listing'], 'https://social.edps.europa.eu/@EDPS.rss')
        self.assertTrue(by_slug['edps']['permissions']['collect'])
        self.assertTrue(by_slug['edps']['permissions']['store'])

    def test_invalid_claim_and_bundle_are_rejected_before_commit(self):
        bad_claim = claim_for()
        bad_claim['worker'] = 'someone-else'
        with self.assertRaisesRegex(cloud_worker.WorkerError, 'identity_mismatch'):
            cloud_worker._validate_claim(bad_claim, SOURCE, 'test-worker')

        claim = claim_for()
        bundle = bundle_for(claim)
        bundle['result']['until'] = '2026-11-09'
        with self.assertRaisesRegex(cloud_worker.WorkerError, 'bundle_claim_mismatch'):
            cloud_worker._validate_bundle(bundle, claim)

    def test_child_process_does_not_receive_service_credentials(self):
        observed = {}
        result = type('Result', (), {'returncode': 0})()

        def run(command, **kwargs):
            observed.update(kwargs)
            Path(kwargs['env']['TMP_OUTPUT']).write_text('{}', encoding='utf-8')
            return result

        with tempfile.TemporaryDirectory() as directory:
            claim_path = Path(directory) / 'claim.json'
            output_path = Path(directory) / 'bundle.json'
            claim_path.write_text('{}', encoding='utf-8')
            env = {
                'SUPABASE_URL': 'https://supabase.test',
                'SUPABASE_SERVICE_ROLE_KEY': 'do-not-pass',
                'TMP_OUTPUT': str(output_path),
            }
            with patch.dict(os.environ, env, clear=True):
                cloud_worker.prepare_claim_file(claim_path, output_path, run=run)
        child_env = observed['env']
        self.assertNotIn('SUPABASE_URL', child_env)
        self.assertNotIn('SUPABASE_SERVICE_ROLE_KEY', child_env)
        self.assertNotIn('SUPABASE_ACCESS_TOKEN', child_env)
        self.assertNotIn('SUPABASE_ANON_KEY', child_env)

    def test_rpc_http_error_does_not_echo_error_body(self):
        def opener(*_args, **_kwargs):
            raise urllib.error.HTTPError('https://supabase.test/rpc', 403, 'blocked', {}, None)

        env = {
            'SUPABASE_URL': 'https://supabase.test',
            'SUPABASE_SERVICE_ROLE_KEY': 'secret-value',
        }
        with self.assertRaises(cloud_worker.WorkerError) as caught:
            cloud_worker.rpc_call('collector_cloud_take', {'p_worker': 'w', 'p_slug': 'ec'},
                                  environ=env, opener=opener)
        self.assertEqual(str(caught.exception), 'collector_cloud_take_http_403')
        self.assertNotIn('secret-value', str(caught.exception))

    def test_new_secret_key_is_sent_only_as_apikey(self):
        observed = {}

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'null'

        def opener(request, **_kwargs):
            observed['apikey'] = request.get_header('Apikey')
            observed['authorization'] = request.get_header('Authorization')
            return Response()

        result = cloud_worker.rpc_call(
            'collector_cloud_take', {'p_worker': 'test', 'p_slug': 'ec'},
            environ={'SUPABASE_URL': 'https://supabase.test',
                     'SUPABASE_SERVICE_ROLE_KEY': 'sb_secret_example'},
            opener=opener,
        )
        self.assertIsNone(result)
        self.assertEqual(observed['apikey'], 'sb_secret_example')
        self.assertIsNone(observed['authorization'])

    def test_publishable_key_is_rejected_before_rpc(self):
        with self.assertRaisesRegex(cloud_worker.WorkerError, 'supabase_secret_key_required'):
            cloud_worker._credentials({
                'SUPABASE_URL': 'https://supabase.test',
                'SUPABASE_SERVICE_ROLE_KEY': 'sb_publishable_example',
            })

    def test_one_source_failure_does_not_skip_remaining_enabled_sources(self):
        second = {**SOURCE, 'source': 'eu-parliament'}
        output = io.StringIO()
        with (patch.object(cloud_worker, 'eligible_sources', return_value=[SOURCE, second]),
              patch.object(cloud_worker, 'run_source', side_effect=[
                  cloud_worker.WorkerError('collector_cloud_take_http_503'),
                  [{'source': 'eu-parliament', 'status': 'idle'}],
              ]) as run_source,
              redirect_stdout(output)):
            status = cloud_worker.main([])

        self.assertEqual(status, 1)
        self.assertEqual(run_source.call_count, 2)
        payload = json.loads(output.getvalue())
        self.assertEqual(payload['status'], 'partial')
        self.assertEqual([row['source'] for row in payload['sources']], ['ec', 'eu-parliament'])
        self.assertEqual(payload['sources'][0]['error'], 'collector_cloud_take_http_503')


if __name__ == '__main__':
    unittest.main()
