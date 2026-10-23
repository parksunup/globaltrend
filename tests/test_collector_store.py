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
        with self.assertRaisesRegex(FetchError, '^database_rpc_failure:collector_capacity:'):
            self.store(b'not json').rpc('collector_capacity', {})

    def test_first_automatic_backfill_uses_one_calendar_month(self):
        self.assertEqual(SupabaseStore._range_start({}, '2026-10-21'), '2026-09-21')
        self.assertEqual(SupabaseStore._range_start({}, '2024-03-31'), '2024-02-29')
        self.assertEqual(SupabaseStore._range_start({}, '2025-03-31'), '2025-02-28')

    def test_incremental_run_keeps_three_day_overlap_after_last_success(self):
        self.assertEqual(SupabaseStore._range_start({'last_success_date':'2026-10-19'}, '2026-10-21'), '2026-10-16')
