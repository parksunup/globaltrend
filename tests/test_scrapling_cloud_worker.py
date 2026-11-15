import hashlib
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit, parse_qs

from scripts.collector_scrapling.cloud_worker import (
    WorkerError,
    daily_window,
    run,
    _normalize_item,
    source_row_gate,
)


class ScraplingCloudWorkerTests(unittest.TestCase):
    def test_all_sources_default_to_unbounded_pages_and_items(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps({
                "collector": "scrapling-separate-v1", "timezone": "Asia/Seoul", "lookback_days": 3,
                "max_pages_per_source": None, "max_items_per_source": None,
                "sources": [{"source": slug, "source_id": slug + "-id", "language": "en"}
                            for slug in ("cn-cac", "hk-pcpd", "vn-gov", "ftc", "calprivacy")],
            }), encoding="utf-8")
            def rpc(name, args):
                if name in ("collector_source_allowed",): return True
                if name == "collector_capacity": return {"can_write": True}
                if name == "record_scrapling_collection_run": return {"run_id": args["p_id"]}
                raise AssertionError(name)
            def collect(source, since, until, **kwargs):
                self.assertEqual(kwargs, {"max_pages": None, "max_items": None})
                return {"status": "empty_window", "coverage_complete": True,
                        "pages": 12, "discovered": 80, "details_attempted": 0,
                        "errors": [], "items": []}
            result = run(registry_path=path, call_rpc=rpc, collect=collect)
            self.assertEqual(result["status"], "complete")
            self.assertEqual(len(result["sources"]), 5)
            self.assertTrue(all(row["status"] == "empty_window" and row["coverage_complete"]
                                for row in result["sources"]))

    def test_source_row_gate_checks_only_the_exact_live_approval_fields(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self):
                return json.dumps([{"id": "oecd-id", "is_active": True,
                                    "terms_reviewed_at": "2026-10-19T08:18:39Z"}]).encode()
        captured = {}
        def opener(request, timeout):
            captured["url"] = request.full_url
            captured["headers"] = request.headers
            return Response()
        env = {"SUPABASE_URL": "https://example.supabase.co",
               "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_test"}
        with patch.dict("os.environ", env, clear=True):
            gate = source_row_gate("oecd-id", opener=opener)
        self.assertEqual(gate, {"row_found": True, "is_active": True,
                                "terms_reviewed": True, "allowed": True})
        self.assertEqual(parse_qs(urlsplit(captured["url"]).query),
                         {"select": ["id,is_active,terms_reviewed_at"], "id": ["eq.oecd-id"]})
        self.assertEqual(captured["headers"]["Apikey"], "sb_secret_test")
        self.assertNotIn("Authorization", captured["headers"])

    def test_daily_window_uses_korea_calendar_and_three_day_overlap(self):
        now = datetime.fromisoformat("2026-11-08T16:30:00+00:00")
        self.assertEqual(daily_window(now), ("2026-11-07", "2026-11-09"))

    def test_registry_source_id_maps_and_hashes_full_text_without_truncation(self):
        body = "A complete official privacy announcement body for testing."
        row = {
            "url": "https://www.ftc.gov/news-events/news/press-releases/test",
            "title_original": "FTC privacy announcement",
            "content_text": body,
            "content_hash": hashlib.sha256(body.encode()).hexdigest(),
            "published_date": None,
            "metadata": {"date_conflict": True, "collector": "scrapling-separate-v1"},
        }
        result = _normalize_item(
            {"source_id": "source-uuid", "language": "en"}, row, "run-uuid", "2026-11-09T00:00:00+00:00"
        )
        self.assertEqual(result["p_content_text"], body)
        self.assertIsNone(result["p_published_at"])
        self.assertTrue(result["p_metadata"]["date_conflict"])
        self.assertEqual(result["p_metadata"]["scrapling_run_id"], "run-uuid")

    def test_hash_mismatch_and_over_limit_body_fail_closed(self):
        row = {"url": "https://privacy.ca.gov/a", "title_original": "Title", "content_text": "Long enough body."}
        with self.assertRaisesRegex(WorkerError, "hash_mismatch"):
            _normalize_item({"source_id": "s", "language": "en"}, {**row, "content_hash": "0" * 64}, "r", "now")
        with self.assertRaisesRegex(WorkerError, "over_limit"):
            _normalize_item({"source_id": "s", "language": "en"}, {**row, "content_text": "x" * 80_001}, "r", "now")

    def test_unapproved_source_is_never_requested_or_ingested(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps({
                "collector": "scrapling-separate-v1", "timezone": "Asia/Seoul", "lookback_days": 3,
                "sources": [{"source": "vn-gov", "source_id": "vn-id", "language": "en"}],
            }), encoding="utf-8")
            calls = []
            def rpc(name, args):
                calls.append((name, args))
                if name == "collector_source_allowed":
                    return False
                if name == "record_scrapling_collection_run":
                    return {"run_id": args["p_id"]}
                raise AssertionError("unapproved source reached a write path")
            def collect(*args, **kwargs):
                raise AssertionError("unapproved source was fetched")

            result = run(registry_path=path, call_rpc=rpc, collect=collect,
                         source_status=lambda source_id: {"row_found": True, "is_active": False,
                                                          "terms_reviewed": True, "allowed": False})
            self.assertEqual(result["sources"][0]["status"], "held")
            self.assertEqual(result["status"], "partial")
            self.assertFalse(any(name == "ingest_source_item" for name, _ in calls))

    def test_rpc_false_uses_same_row_approval_predicate_and_records_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps({
                "collector": "scrapling-separate-v1", "timezone": "Asia/Seoul", "lookback_days": 3,
                "max_pages_per_source": 2, "max_items_per_source": 3,
                "sources": [{"source": "oecd", "source_id": "oecd-id", "language": "en"}],
            }), encoding="utf-8")
            calls = []
            body = "OECD official privacy update with enough text to ingest."
            item = {
                "url": "https://www.oecd.org/en/topics/privacy-and-data-protection.html/test",
                "title_original": "OECD privacy update", "published_date": "2026-11-10",
                "content_text": body, "content_hash": hashlib.sha256(body.encode()).hexdigest(),
                "metadata": {"ai_ready": False},
            }
            def rpc(name, args):
                calls.append((name, args))
                if name == "collector_source_allowed": return False
                if name == "collector_capacity": return {"can_write": True}
                if name == "ingest_source_item": return [{"item_created": True, "content_changed": True}]
                if name == "record_scrapling_collection_run": return {"run_id": args["p_id"]}
                raise AssertionError(name)
            def collect(*args, **kwargs):
                return {"status": "success", "coverage_complete": True, "pages": 1,
                        "discovered": 1, "details_attempted": 1, "errors": [], "items": [item]}
            row = {"row_found": True, "is_active": True, "terms_reviewed": True, "allowed": True}
            result = run(registry_path=path, call_rpc=rpc, collect=collect,
                         source_status=lambda source_id: row)
            self.assertEqual(result["sources"][0]["source_gate_fallback"], "active_and_terms_reviewed_row")
            self.assertEqual(result["sources"][0]["source_gate_diagnostic"]["row_allowed"], True)
            self.assertTrue(any(name == "ingest_source_item" for name, _ in calls))

    def test_allowed_items_are_ingested_and_run_has_start_and_finish_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(json.dumps({
                "collector": "scrapling-separate-v1", "timezone": "Asia/Seoul", "lookback_days": 3,
                "max_pages_per_source": 2, "max_items_per_source": 3,
                "sources": [{"source": "ftc", "source_id": "ftc-id", "language": "en"}],
            }), encoding="utf-8")
            calls = []
            body = "FTC official privacy release full text."
            item = {
                "url": "https://www.ftc.gov/news-events/news/press-releases/fixture",
                "title_original": "FTC official privacy release",
                "published_date": "2026-11-08",
                "content_text": body,
                "content_hash": hashlib.sha256(body.encode()).hexdigest(),
                "metadata": {"read_scope": "official_ftc_press_release_body", "ai_ready": False},
            }
            def rpc(name, args):
                calls.append((name, args))
                if name == "collector_source_allowed":
                    return True
                if name == "collector_capacity":
                    return {"can_write": True}
                if name == "ingest_source_item":
                    return [{"item_created": True, "content_changed": True}]
                if name == "record_scrapling_collection_run":
                    return {"run_id": args["p_id"], "status": args["p_status"]}
                raise AssertionError(name)
            def collect(source, since, until, **kwargs):
                self.assertEqual(source, "ftc")
                self.assertEqual(kwargs, {"max_pages": 2, "max_items": 3})
                return {"status": "partial", "coverage_complete": False, "pages": 1,
                        "discovered": 1, "details_attempted": 1, "errors": [], "items": [item]}

            result = run(registry_path=path, call_rpc=rpc, collect=collect,
                         execution_id="fixture-run", git_sha="a" * 40)
            self.assertEqual(result["status"], "partial")
            self.assertEqual(result["sources"][0]["new"], 1)
            ingested = next(args for name, args in calls if name == "ingest_source_item")
            self.assertEqual(ingested["p_source_id"], "ftc-id")
            self.assertEqual(ingested["p_metadata"]["scrapling_run_id"], result["run_id"])
            run_records = [args for name, args in calls if name == "record_scrapling_collection_run"]
            self.assertEqual([row["p_status"] for row in run_records], ["running", "partial"])


if __name__ == "__main__":
    unittest.main()
