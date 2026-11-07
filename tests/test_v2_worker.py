import unittest
from scripts.collector_v2.worker import owned_sources


class SourceOwnershipTests(unittest.TestCase):
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
