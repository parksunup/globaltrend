import unittest
from unittest.mock import patch
from scripts.collector_v2.worker import owned_sources, run


class SourceOwnershipTests(unittest.TestCase):
    def test_worker_passes_lease_and_bundle_to_existing_commit(self):
        claim = {'source_id': 'id', 'lease_token': 'lease'}
        bundle = {'result': {'status': 'success'}, 'operations': [{'test': True}]}

        class Store:
            def __init__(self): self.calls = []; self.taken = False
            def preflight(self, config): return {'allowed': True}
            def rpc(self, name, payload):
                self.calls.append((name, payload))
                if name == 'collector_cloud_take':
                    if self.taken: return None
                    self.taken = True
                    return claim
                if name == 'collector_cloud_commit': return {'saved': True}
                raise AssertionError(name)

        store = Store()
        with patch('scripts.collector_v2.worker.SupabaseStore', return_value=store), patch('scripts.collector_v2.worker.prepare', return_value=bundle):
            result = run(['ftc'])
        commit = next(payload for name, payload in store.calls if name == 'collector_cloud_commit')
        self.assertEqual(commit['p_lease_token'], 'lease')
        self.assertEqual(commit['p_bundle'], bundle)
        self.assertEqual(result['status'], 'completed')

    def test_all_owned_does_not_take_edge_or_unassigned_sources(self):
        configs = [
            {'source': 'ftc', 'enabled': True, 'executor': 'edge'},
            {'source': 'ec', 'enabled': True, 'executor': 'cloud-python'},
            {'source': 'edpb', 'enabled': True, 'executor': 'edge'},
            {'source': 'unknown', 'enabled': True},
            {'source': 'oecd', 'enabled': False, 'executor': 'cloud-python'},
        ]
        self.assertEqual(owned_sources(configs), ['ftc', 'ec'])


if __name__ == '__main__':
    unittest.main()
