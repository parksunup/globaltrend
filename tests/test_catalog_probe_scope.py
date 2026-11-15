import unittest

from scripts.catalog_probe import select_probe_sources


class CatalogProbeScopeTests(unittest.TestCase):
    def test_default_scope_excludes_user_held_inventory_entries(self):
        rows=[{'id':'source-a'},{'id':'eur-lex','hold_reason':'user_deferred_2026_10_29','runtime_enabled':False}]
        self.assertEqual([row['id'] for row in select_probe_sources(rows)],['source-a'])

    def test_explicitly_selecting_user_held_entry_fails_before_probe(self):
        rows=[{'id':'source-a'},{'id':'eur-lex','hold_reason':'user_deferred_2026_10_29','runtime_enabled':False}]
        with self.assertRaisesRegex(ValueError,'source_held_by_user:eur-lex'):
            select_probe_sources(rows,['eur-lex'])

    def test_unknown_source_id_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'unknown_source_ids:missing'):
            select_probe_sources([{'id':'source-a'}],['missing'])


if __name__=='__main__':
    unittest.main()
