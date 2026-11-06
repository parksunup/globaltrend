import json
import unittest
from unittest.mock import patch

from scripts.collector_v2.preflight import ROOT, run


class ReadOnlyPreflightTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((ROOT / 'config/trend-writing-policy.json').read_text(encoding='utf-8'))

    def test_checks_source_and_draft_contracts_with_read_rpc_calls_only(self):
        policy = self.policy

        class Store:
            def __init__(self):
                self.calls = []

            def preflight(self, config):
                self.calls.extend(['collector_source_allowed', 'collector_capacity'])
                return {'allowed': True, 'database_bytes': 42, 'stop_bytes': 400000000}

            def rpc(self, name, payload):
                self.calls.append(name)
                if name == 'collector_draft_policy':
                    return {'policy_version': 'trend-draft-unlimited-v2',
                            'daily_claim_limit': None, 'targeted_claim_supported': True}
                if name == 'collector_writing_policy':
                    return {'policy_id': policy['policy_id'],
                            'job_instruction_version': policy['job_instruction_version'],
                            'instruction_hashes': policy['instruction_hashes']}
                raise AssertionError('unexpected RPC: ' + name)

        store = Store()
        result = run(store, [{'source': 'sample', 'source_id': 'source-id'}])

        self.assertEqual(result['status'], 'passed')
        self.assertFalse(result['writes_performed'])
        self.assertTrue(result['draft_policy']['matches_contract'])
        self.assertTrue(result['writing_policy']['matches_contract'])
        self.assertNotIn('collector_cloud_take', store.calls)
        self.assertNotIn('collector_cloud_commit', store.calls)
        self.assertNotIn('claim_trend_draft_jobs', store.calls)
        self.assertNotIn('submit_trend_draft', store.calls)

    def test_policy_mismatch_fails_preflight_without_claiming_a_draft(self):
        class Store:
            def preflight(self, config):
                return {'allowed': True}

            def rpc(self, name, payload):
                if name == 'collector_draft_policy':
                    return {'policy_version': 'old-policy', 'daily_claim_limit': 10,
                            'targeted_claim_supported': False}
                return {'policy_id': 'stale', 'job_instruction_version': 'old',
                        'instruction_hashes': {}}

        result = run(Store(), [{'source': 'sample', 'source_id': 'source-id'}])
        self.assertEqual(result['status'], 'failed')
        self.assertFalse(result['draft_policy']['matches_contract'])
        self.assertFalse(result['writing_policy']['matches_contract'])
        self.assertFalse(result['writes_performed'])

    def test_draft_generation_readiness_reports_configuration_without_exposing_key(self):
        policy = self.policy

        class Store:
            def preflight(self, config):
                return {'allowed': True}

            def rpc(self, name, payload):
                if name == 'collector_draft_policy':
                    return {'policy_version': 'trend-draft-unlimited-v2',
                            'daily_claim_limit': None, 'targeted_claim_supported': True}
                return {'policy_id': policy['policy_id'],
                        'job_instruction_version': policy['job_instruction_version'],
                        'instruction_hashes': policy['instruction_hashes']}

        with patch.dict('os.environ', {'DRAFT_API_KEY': 'secret-value', 'DRAFT_MODEL': 'test-model'}):
            result = run(Store(), [{'source': 'sample', 'source_id': 'source-id'}])
        self.assertTrue(result['draft_generation']['ready'])
        self.assertEqual(result['draft_generation']['model'], 'test-model')
        self.assertNotIn('secret-value', json.dumps(result))


if __name__ == '__main__':
    unittest.main()
