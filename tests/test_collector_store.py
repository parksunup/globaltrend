"""Supabase HTTP response contracts, including successful void RPCs."""
import unittest
from unittest.mock import Mock

from scripts.collector.core import FetchError
from scripts.collector.store import SupabaseStore


class StoreResponseTests(unittest.TestCase):
    def store(self, body):
        store = SupabaseStore.__new__(SupabaseStore)
        store.base = 'https://example.supabase.co'
        store.key = 'test-placeholder'
        store.client = Mock()
        store.client.request.return_value = (body, store.base, 'application/json')
        return store

    def test_successful_empty_void_rpc_is_not_a_database_failure(self):
        store = self.store(b'')
        self.assertIsNone(store.rpc('collector_set_progress', {}))

    def test_json_rpc_response_retains_its_value(self):
        self.assertEqual(self.store(b'{"can_write":true}').rpc('collector_capacity', {}),
                         {'can_write': True})

    def test_nonempty_malformed_rpc_response_remains_a_failure(self):
        with self.assertRaisesRegex(FetchError, '^database_rpc_failure:collector_capacity$'):
            self.store(b'not json').rpc('collector_capacity', {})
