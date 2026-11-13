import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class CollectorScopeRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'config/trend-source-catalog.json').read_text(encoding='utf-8'))
        cls.cloud = json.loads((ROOT / 'config/trend-collector.json').read_text(encoding='utf-8'))
        cls.edge = json.loads((ROOT / 'supabase/functions/trend-collector/registry.json').read_text(encoding='utf-8'))
        cls.cloud_by_id = {row['source']: row for row in cls.cloud['sources']}
        cls.edge_by_id = {row['source']: row for row in cls.edge['sources']}
        cls.catalog_by_id = {row['id']: row for row in cls.catalog['sources']}

    def test_every_requested_catalog_id_has_both_runtime_registry_records(self):
        expected = set(self.catalog_by_id)
        self.assertEqual(37, len(expected))
        self.assertTrue(expected <= set(self.cloud_by_id))
        self.assertTrue(expected <= set(self.edge_by_id))

    def test_eur_lex_user_deferred_hold_is_in_the_complete_catalog_and_registry(self):
        requested = set(self.catalog_by_id)
        self.assertEqual(set(), set(self.cloud_by_id) - requested)
        self.assertEqual(set(), set(self.edge_by_id) - requested)
        self.assertIn('eur-lex', requested)
        for row in (self.cloud_by_id['eur-lex'], self.edge_by_id['eur-lex']):
            self.assertFalse(row['enabled'])
            self.assertEqual('user_deferred_2026_10_29', row.get('hold_reason'))
            self.assertEqual('held_by_user', row.get('verification_status'))

    def test_source_ids_match_between_cloud_and_edge_registry(self):
        for source in self.catalog_by_id:
            self.assertEqual(self.cloud_by_id[source]['source_id'], self.edge_by_id[source]['source_id'], source)

    def test_held_sources_are_visible_but_cannot_be_claimed_or_written(self):
        held_sources = {source for source, row in self.cloud_by_id.items()
                        if source in self.catalog_by_id and not row['enabled']}
        self.assertTrue(held_sources)
        for source in held_sources:
            for row in (self.cloud_by_id[source], self.edge_by_id[source]):
                self.assertFalse(row['enabled'], source)
                self.assertEqual({'collect': False, 'store': False, 'ai': False}, row['permissions'], source)
                self.assertTrue(row.get('verification_status'), source)
                self.assertTrue(row.get('verification'), source)
                catalog_source_id = self.catalog_by_id[source].get('source_id')
                if catalog_source_id is not None:
                    self.assertEqual(row['source_id'], catalog_source_id, source)

    def test_unverified_registration_migration_does_not_enqueue_or_enable_sources(self):
        migration = (ROOT / 'supabase/migrations/20261108150000_register_unverified_catalog_sources.sql').read_text(encoding='utf-8')
        self.assertIn("'collector_executor','hold'", migration)
        self.assertIn("true,null,false)", migration)
        self.assertNotRegex(migration, r'(?i)insert\s+into\s+public\.collector_(edge_sources|cloud_routes)')

    def test_cloud_python_sources_are_present_in_sql_cloud_source_allowlists(self):
        sql = '\n'.join(path.read_text(encoding='utf-8') for path in (ROOT / 'supabase/migrations').glob('*.sql'))
        enabled_cloud = {
            row['source'] for row in self.cloud['sources']
            if row.get('enabled') is True and row.get('executor') == 'cloud-python'
        }
        self.assertTrue(enabled_cloud)
        for source in enabled_cloud:
            self.assertIn("'" + source + "'", sql, source)

    def test_anpd_has_a_live_cloud_route_and_separate_source_specific_activation(self):
        cloud = self.cloud_by_id['anpd-br']
        edge = self.edge_by_id['anpd-br']
        self.assertTrue(cloud['enabled'])
        self.assertEqual('cloud-python', cloud['executor'])
        self.assertEqual({'collect': True, 'store': True, 'ai': True}, cloud['permissions'])
        self.assertEqual(cloud['source_id'], edge['source_id'])
        migration = (ROOT / 'supabase/migrations/20261108180000_enable_anpd_plone_rest.sql').read_text(encoding='utf-8')
        self.assertIn("'anpd-br'", migration)
        self.assertIn("'terms_review_result','not_found_http_404'", migration)
        self.assertIn("'robots_review_result','robots_txt_allows_anpd_path'", migration)
        self.assertIn('relevance_review_required', migration)

    def test_nist_has_a_live_cloud_route_and_can_pass_collection_permission_gate(self):
        cloud = self.cloud_by_id['nist']
        edge = self.edge_by_id['nist']
        self.assertTrue(cloud['enabled'])
        self.assertEqual('cloud-python', cloud['executor'])
        self.assertEqual({'collect': True, 'store': True, 'ai': True}, cloud['permissions'])
        self.assertEqual(cloud['source_id'], edge['source_id'])
        self.assertFalse(self.catalog_by_id['nist'].get('hold_reason'))
        migration = (ROOT / 'supabase/migrations/20261108181000_enable_nist_nccoe_news.sql').read_text(encoding='utf-8')
        self.assertIn("'nist'", migration)
        self.assertIn('terms_review_url', migration)
        self.assertIn('relevance_review_required', migration)


if __name__ == '__main__':
    unittest.main()
