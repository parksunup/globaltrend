import json
import unittest
from unittest.mock import Mock, patch

from scripts.collector import preflight
from scripts.collector.environment import runtime_info, runtime_problem


class RuntimeTests(unittest.TestCase):
    def test_local_process_does_not_claim_to_be_a_scheduler(self):
        with patch.dict('os.environ', {}, clear=True):
            info = runtime_info()
        self.assertEqual(info['actual'], 'standalone-process')
        self.assertFalse(info['scheduler_connected'])

    def test_requested_self_hosted_must_match_actual_runner(self):
        env = {'GITHUB_ACTIONS':'true', 'COLLECTOR_RUNNER':'self-hosted',
               'COLLECTOR_ACTUAL_RUNNER':'github-hosted'}
        with patch.dict('os.environ', env, clear=True):
            self.assertEqual(runtime_problem(), 'runner_selection_mismatch')

    def test_unknown_runner_selection_is_not_silently_accepted(self):
        with patch.dict('os.environ', {'COLLECTOR_RUNNER':'typo'}, clear=True):
            self.assertEqual(runtime_problem(), 'unsupported_runner_selection')


class PreflightTests(unittest.TestCase):
    def config(self):
        return {'source':'edpb', 'source_id':'a23ccfc6-4ad0-4ae7-bc85-0da35cfd2c1e',
                'hosts':['www.edpb.europa.eu'], 'enabled':True,
                'permissions':{'collect':True,'store':True,'ai':True}}

    def run_check(self, probe_failed=False, db_allowed=True, env_extra=None):
        probe = {'source':'edpb','listing':{'status':'failed' if probe_failed else 'parsed'},
                 'detail':{'status':'parsed','requires_review':True}}
        store = Mock()
        store.preflight.return_value = {'allowed':db_allowed, 'reason':None if db_allowed else 'database_storage_cap'}
        env = {'GITHUB_ACTIONS':'true', 'COLLECTOR_RUNNER':'github-hosted',
               'COLLECTOR_ACTUAL_RUNNER':'github-hosted', 'GITHUB_RUN_ID':'123',
               'GITHUB_REF_NAME':'candidate', 'COLLECTOR_DEFAULT_BRANCH':'main',
               'COLLECTION_ENABLED':'true','FREE_LIMITS_VERIFIED':'true','CLOUD_PIPELINE_VERIFIED':'true',
               'SCHEDULE_ENABLED':'false', **(env_extra or {})}
        with patch.dict('os.environ', env, clear=True), \
             patch.object(preflight, 'SupabaseStore', return_value=store), \
             patch.object(preflight, 'HttpClient'), \
             patch.object(preflight, 'probe_source', return_value=(probe,probe_failed)) as fetch:
            result = preflight.check([self.config()], {'edpb':[]})
        return result, store, fetch

    def test_success_checks_readiness_without_writes_or_activation(self):
        result, store, fetch = self.run_check()
        self.assertTrue(result['collection_preflight_passed'])
        self.assertFalse(result['schedule_switch_enabled'])
        self.assertFalse(result['scheduled_execution_observed'])
        self.assertFalse(result['automatic_korean_drafting'])
        self.assertFalse(result['writes_performed'])
        self.assertIn('workflow_not_on_default_branch',result['activation_blockers'])
        self.assertFalse(result['coverage_complete'])
        self.assertEqual([c[0] for c in store.method_calls], ['preflight'])
        fetch.assert_called_once()

    def test_network_failure_is_not_hidden_by_database_success(self):
        result, _, _ = self.run_check(probe_failed=True)
        self.assertFalse(result['collection_preflight_passed'])
        self.assertEqual(result['sources'][0]['status'],'failed')

    def test_readable_sources_do_not_override_missing_operation_gate(self):
        result, _, _ = self.run_check(env_extra={'FREE_LIMITS_VERIFIED':'false'})
        self.assertTrue(result['collection_preflight_passed'])
        self.assertEqual(result['outcome'], 'blocked')
        self.assertEqual(result['stop_reason'], 'operation_gates_not_verified')
        self.assertFalse(result['operation_success'])

    def test_database_cap_prevents_source_fetch(self):
        result, _, fetch = self.run_check(db_allowed=False)
        self.assertFalse(result['collection_preflight_passed'])
        fetch.assert_not_called()

    def test_mismatched_runtime_stops_before_database_and_http(self):
        result, store, fetch = self.run_check(env_extra={'COLLECTOR_ACTUAL_RUNNER':'self-hosted'})
        self.assertEqual(result['stop_reason'],'runner_selection_mismatch')
        self.assertFalse(result['collection_preflight_passed'])
        store.preflight.assert_not_called()
        fetch.assert_not_called()

    def test_report_does_not_serialize_credentials(self):
        result, _, _ = self.run_check(env_extra={'SUPABASE_SECRET_KEY':'never-log-this-secret'})
        self.assertNotIn('never-log-this-secret',json.dumps(result))

    def test_standalone_process_does_not_prove_an_app_schedule(self):
        result, _, _ = self.run_check(env_extra={'GITHUB_ACTIONS':'false','RUN_EVENT':'schedule'})
        self.assertTrue(result['collection_preflight_passed'])
        self.assertFalse(result['scheduled_execution_observed'])
        self.assertIn('external_scheduler_unverified',result['activation_blockers'])
        self.assertNotIn('workflow_not_on_default_branch',result['activation_blockers'])


if __name__ == '__main__':
    unittest.main()
