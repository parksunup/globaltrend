import datetime as dt
import hashlib
import json
import unittest
import uuid
from pathlib import Path

from scripts.collector.cloud_step import prepare


ROOT = Path(__file__).resolve().parents[1]


class CloudSnapshotCursorTests(unittest.TestCase):
    def test_completed_ftc_snapshot_uses_durable_seen_flag_not_a_capped_hash_cursor(self):
        registry = json.loads((ROOT / "config/trend-collector.json").read_text())
        config = next(x for x in registry["sources"] if x["source"] == "ftc")
        listing_url = "https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29"
        item_url = "https://www.ftc.gov/news-events/news/press-releases/example"
        item_hash = hashlib.sha256(item_url.encode()).hexdigest()
        hashes = [
            hashlib.sha256(f"snapshot-row-{i}".encode()).hexdigest()
            for i in range(49)
        ] + [item_hash]
        snapshot_id = str(uuid.uuid4())
        claim = {
            "slug": "ftc",
            "source_id": config["source_id"],
            "worker": "cursor-contract-test",
            "lease_token": str(uuid.uuid4()),
            "lease_until": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)).isoformat(),
            "since": "2026-10-16",
            "until": "2026-10-27",
            "cursor": {
                "page": listing_url,
                "offset": 49,
                "fingerprint": "a" * 64,
                "snapshot_id": snapshot_id,
            },
            "snapshot_protocol": 1,
            "snapshot": {
                "id": snapshot_id,
                "listing_url": listing_url,
                "fingerprint": "a" * 64,
                "row_count": 50,
                "ordinal": 49,
                "row": {
                    "url": item_url,
                    "title": "Example",
                    "date_observations": [],
                },
                "seen_before": True,
                "url_hashes": hashes,
            },
            "previous_listing_hashes": [],
        }

        bundle = prepare(claim)

        self.assertTrue(bundle["result"]["listing_scan_complete"])
        self.assertNotIn("processed_url_hashes", bundle["cursor"])
        self.assertEqual(bundle["operations"], [])
        self.assertNotIn("duplicate", bundle["result"])

    def test_snapshot_without_hash_array_is_processed_from_its_durable_row(self):
        registry = json.loads((ROOT / "config/trend-collector.json").read_text())
        config = next(x for x in registry["sources"] if x["source"] == "ftc")
        listing_url = "https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29"
        snapshot_id = str(uuid.uuid4())
        claim = {
            "slug": "ftc",
            "source_id": config["source_id"],
            "worker": "cursor-contract-test",
            "lease_token": str(uuid.uuid4()),
            "lease_until": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)).isoformat(),
            "since": "2026-10-16",
            "until": "2026-10-27",
            "cursor": {
                "page": listing_url,
                "offset": 0,
                "fingerprint": "a" * 64,
                "snapshot_id": snapshot_id,
            },
            "snapshot_protocol": 1,
            "snapshot": {
                "id": snapshot_id,
                "listing_url": listing_url,
                "fingerprint": "a" * 64,
                "row_count": 1,
                "ordinal": 0,
                "row": {
                    "url": "https://www.ftc.gov/news-events/news/press-releases/example",
                    "title": "Example",
                    "date_observations": [],
                },
            },
            "previous_listing_hashes": [],
        }

        from unittest.mock import patch
        from scripts.collector.core import HttpClient
        class Client(HttpClient):
            def __init__(self,*args,**kwargs): self.budget={'requests':0,'bytes':0}
            def get(self,url):
                return b'<h1>Example</h1><time datetime="2026-10-27"></time><main><article class="node--view-mode-full"><div class="field--name-body"><p>Official privacy article body with enough detail for collection.</p></div></article></main>',url,'text/html'
        with patch('scripts.collector.cloud_step.HttpClient',Client):
            bundle=prepare(claim)
        self.assertEqual(bundle['operations'][0]['p_canonical_url'],claim['snapshot']['row']['url'])
        self.assertNotIn('processed_url_hashes',bundle['cursor'])


if __name__ == "__main__":
    unittest.main()
