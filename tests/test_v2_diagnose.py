import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from scripts.collector_v2 import diagnose

_loads = json.loads


class DiagnoseExitTests(unittest.TestCase):
    def invoke(self, results):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'probe.json'
            with patch.object(diagnose, 'run_source', side_effect=results), \
                 patch('sys.argv', ['diagnose', '--source', 'one', '--output', str(output)]):
                registry = {'sources': [{'source': 'one', 'enabled': True}]}
                with patch.object(diagnose.json, 'loads', return_value=registry):
                    try:
                        diagnose.main()
                    except SystemExit as error:
                        return error.code, _loads(output.read_text(encoding='utf-8'))
                    return 0, _loads(output.read_text(encoding='utf-8'))

    def test_failed_sample_returns_partial_exit_and_writes_evidence(self):
        code, evidence = self.invoke([{'source': 'one', 'status': 'failed'}])
        self.assertEqual(code, 3)
        self.assertEqual(evidence['sources'][0]['status'], 'failed')

    def test_parsed_sample_returns_success(self):
        code, evidence = self.invoke([{'source': 'one', 'status': 'parsed_sample'}])
        self.assertEqual(code, 0)
        self.assertEqual(evidence['sources'][0]['status'], 'parsed_sample')


class DiagnoseSourceSelectionTests(unittest.TestCase):
    def test_default_selection_includes_enabled_only(self):
        sources = [{'source': 'active', 'enabled': True}, {'source': 'held', 'enabled': False}]
        self.assertEqual([s['source'] for s in diagnose.select_sources(sources, None)], ['active'])
        self.assertEqual([s['source'] for s in diagnose.select_sources(sources, ['all'])], ['active'])

    def test_explicit_selection_can_probe_held_source_without_enabling_it(self):
        held = {'source': 'edps', 'enabled': False, 'permissions': {'collect': False}}
        selected = diagnose.select_sources([held], ['edps'])
        self.assertEqual(selected, [held])
        self.assertFalse(selected[0]['enabled'])
        self.assertFalse(selected[0]['permissions']['collect'])

    def test_unknown_explicit_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unknown source: missing'):
            diagnose.select_sources([{'source': 'edps', 'enabled': False}], ['missing'])

    def test_ico_probe_uses_requested_date_range_on_official_fallback(self):
        config = {
            'source': 'ico', 'listing': 'https://www.wiredgov.net/news/ico',
            'hosts': ['www.wiredgov.net'],
        }
        with patch.object(diagnose, 'CrawleeClient') as client_type, \
             patch.object(diagnose, 'fetch_listing', return_value=([{'url': 'https://www.wiredgov.net/news/ico/item'}], None)) as listing, \
             patch.object(diagnose.parsers, 'extract_document', return_value={
                 'content_text': 'A sufficiently long official republication text.',
                 'published_date': '2026-11-07',
                 'metadata': {'read_scope': 'full_article', 'requires_review': True,
                              'date_observations': [], 'unread_attachments': []},
             }), patch.object(diagnose, 'supplement_official_pdf', side_effect=lambda item, *_: item):
            client_type.return_value.get.return_value = (
                b'<article>detail</article>',
                'https://www.wiredgov.net/news/ico/item', 'text/html',
            )
            record = diagnose.run_source(config, since='2026-11-01', until='2026-11-07')
        called_url = listing.call_args.args[2]
        params = parse_qs(urlsplit(called_url).query)
        self.assertEqual(params['from'], ['2026-11-01'])
        self.assertEqual(params['to'], ['2026-11-07'])
        self.assertEqual(record['status'], 'parsed_sample')


if __name__ == '__main__':
    unittest.main()

