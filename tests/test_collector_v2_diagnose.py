import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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


if __name__ == '__main__':
    unittest.main()

