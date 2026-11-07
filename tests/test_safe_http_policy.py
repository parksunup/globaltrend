import time
import unittest
from unittest.mock import patch

from scripts.collector import core


class SafeHttpPolicyTests(unittest.TestCase):
    def test_headers_keep_project_identity_and_custom_content_type(self):
        headers = core.safe_request_headers({
            'user-agent': 'browser-like identity',
            'ACCEPT': 'text/plain',
            'Content-Type': 'application/json',
        })
        self.assertEqual(headers['User-Agent'], core.USER_AGENT)
        self.assertEqual(headers['Accept'], core.DEFAULT_ACCEPT)
        self.assertEqual(headers['Content-Type'], 'application/json')

    def test_host_pacing_is_shared_across_client_instances(self):
        host = 'pace-test.example'
        core._HOST_NEXT_ALLOWED.pop(host, None)
        with patch.object(core.time, 'sleep') as sleep:
            core.pace_host(host, 10)
            core.pace_host(host, 10)
        sleep.assert_called_once()

    def test_zero_interval_does_not_sleep(self):
        with patch.object(core.time, 'sleep') as sleep:
            core.pace_host('no-delay.example', 0)
        sleep.assert_not_called()


if __name__ == '__main__':
    unittest.main()

