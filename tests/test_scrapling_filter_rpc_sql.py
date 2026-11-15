import base64
import json
import unittest

from scripts.collector_scrapling.filter_rpc_sql import build_sql


class ScraplingFilterRpcSqlTests(unittest.TestCase):
    def test_decision_payload_is_base64_json_and_does_not_interpolate_values(self):
        payload = {
            "run_id": "11111111-1111-4111-8111-111111111111",
            "source_item_id": "22222222-2222-4222-8222-222222222222",
            "revision_id": "33333333-3333-4333-8333-333333333333",
            "input_hash": "a" * 64,
            "decision": "accepted",
            "reason": "short safe reason",
            "filter_version": "scrapling-dedup-v1",
            "metadata": {"match_note": "not SQL: ' OR true; --"},
        }
        sql = build_sql("decision", payload)
        encoded = sql.split("decode('", 1)[1].split("'", 1)[0]
        self.assertEqual(json.loads(base64.b64decode(encoded)), payload)
        self.assertNotIn("not SQL", sql)
        self.assertIn("record_scrapling_filter_decision", sql)

    def test_writer_payload_rejects_non_object_result(self):
        payload = {
            "run_id": "11111111-1111-4111-8111-111111111111",
            "execution_id": "codex-task-test",
            "started_at": "2026-11-09T00:00:00Z",
            "finished_at": "2026-11-09T00:00:00Z",
            "status": "idle",
            "result": "article body must not be stored here",
        }
        with self.assertRaisesRegex(ValueError, "result_must_be_object"):
            build_sql("writer", payload)

    def test_decision_rejects_article_text_fields(self):
        payload = {
            "run_id": "11111111-1111-4111-8111-111111111111",
            "source_item_id": "22222222-2222-4222-8222-222222222222",
            "revision_id": "33333333-3333-4333-8333-333333333333",
            "input_hash": "a" * 64,
            "decision": "accepted",
            "reason": "short safe reason",
            "filter_version": "scrapling-dedup-v1",
            "content_text": "article body",
        }
        with self.assertRaisesRegex(ValueError, "source_text_must_not_be_sent"):
            build_sql("decision", payload)


if __name__ == "__main__":
    unittest.main()
