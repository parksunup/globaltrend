import datetime as dt
import hashlib
import json
import unittest
import uuid
from pathlib import Path

from scripts.collector.cloud_step import prepare


ROOT = Path(__file__).resolve().parents[1]


class CloudSnapshotCursorTests(unittest.TestCase):
    def test_completed_ftc_snapshot_copies_claimed_hashes_to_cursor(self):
        registry = json.loads((ROOT / "config/trend-collector.json").read_text())
        config = next(x for x in registry["sources"] if x["source"] == "ftc")
        listing_url = "https://www.ftc.gov/feeds/press-release-consumer-protection.xml"
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
                "url_hashes": hashes,
            },
            "previous_listing_hashes": [],
        }

        bundle = prepare(claim)

        self.assertTrue(bundle["result"]["listing_scan_complete"])
        self.assertEqual(bundle["cursor"]["processed_url_hashes"], sorted(hashes)[:50])
        self.assertEqual(len(bundle["cursor"]["processed_url_hashes"]), 50)

    def test_snapshot_without_hashes_is_rejected_instead_of_silently_empty(self):
        registry = json.loads((ROOT / "config/trend-collector.json").read_text())
        config = next(x for x in registry["sources"] if x["source"] == "ftc")
        listing_url = "https://www.ftc.gov/feeds/press-release-consumer-protection.xml"
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

        with self.assertRaisesRegex(ValueError, "listing_snapshot_hashes_missing_or_invalid"):
            prepare(claim)


if __name__ == "__main__":
    unittest.main()
