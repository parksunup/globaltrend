"""Bounded source selection for the scheduled Crawlee collector."""
import json
import tempfile
import unittest
from pathlib import Path

from scripts.collector.run import select_configs


class SourceSetTests(unittest.TestCase):
    def write_set(self, value):
        handle = tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.json', delete=False)
        self.addCleanup(lambda: Path(handle.name).unlink(missing_ok=True))
        with handle:
            json.dump(value, handle)
        return handle.name

    def test_source_set_selects_only_listed_sources_in_registry_order(self):
        registry = [{'source': slug} for slug in ('a', 'b', 'c')]
        path = self.write_set({'sources': ['c', 'a']})
        self.assertEqual([row['source'] for row in select_configs(registry, source_set_path=path)], ['a', 'c'])

    def test_source_set_rejects_unknown_sources(self):
        path = self.write_set({'sources': ['missing']})
        with self.assertRaisesRegex(ValueError, 'source_set_unknown_source'):
            select_configs([{'source': 'known'}], source_set_path=path)

    def test_source_and_source_set_cannot_be_combined(self):
        path = self.write_set({'sources': ['a']})
        with self.assertRaisesRegex(ValueError, 'mutually_exclusive'):
            select_configs([{'source': 'a'}], source='a', source_set_path=path)

    def test_source_set_rejects_duplicates(self):
        path = self.write_set({'sources': ['a', 'a']})
        with self.assertRaisesRegex(ValueError, 'source_set_schema_invalid'):
            select_configs([{'source': 'a'}], source_set_path=path)


if __name__ == '__main__':
    unittest.main()
