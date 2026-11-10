import unittest
from types import SimpleNamespace
from unittest.mock import patch

from scripts.collector_scrapling import runner


class _MemoryClient:
    def __init__(self, responses):
        self.responses = responses
        self.requests = 0
        self.bytes_received = 0

    def get(self, url):
        self.requests += 1
        body, content_type = self.responses[url]
        body = body.encode("utf-8") if isinstance(body, str) else body
        self.bytes_received += len(body)
        return body, url, content_type


class ScraplingRunnerTests(unittest.TestCase):
    def test_listing_and_detail_are_collected_without_database_write(self):
        listing = runner.LISTINGS["cn-cac"]
        detail = "https://www.cac.gov.cn/2026-10/28/c_1794942554784626.htm"
        html_listing = "<fixture listing>"
        html_detail = "<fixture detail>"

        def parse_listing(source_id, html, url):
            self.assertEqual(html, html_listing)
            return [{"url": detail, "title": "personal data protection notice", "published_date": "2026-10-28"}]

        def parse_detail(source_id, html, url, row):
            self.assertEqual(html, html_detail)
            return {"title_original": row["title"], "content_text": "Short official notice",
                    "content_hash": "abc", "published_date": row["published_date"],
                    "metadata": {"requires_review": True, "ai_ready": False}}

        adapter = SimpleNamespace(parse_listing=parse_listing, parse_detail=parse_detail)
        client = _MemoryClient({listing: (html_listing, "text/html"), detail: (html_detail, "text/html")})
        with patch.object(runner, "_adapter", return_value=adapter):
            result = runner.collect_source("cn-cac", "2026-10-28", "2026-10-28", client=client)
        self.assertEqual(result["status"], "partial")
        self.assertFalse(result["database_writes"])
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(client.requests, 2)
        self.assertFalse(result["coverage_complete"])

    def test_pcpd_empty_day_is_valid_complete_date_window(self):
        archive = "https://www.info.gov.hk/gia/general/202611/09.htm"
        adapter = SimpleNamespace(
            listing_urls=lambda start, end: [archive],
            parse_listing=lambda source_id, html, url: [],
        )
        client = _MemoryClient({archive: ("<html><ul><li>No PCPD item</li></ul></html>", "text/html")})
        with patch.object(runner, "_adapter", return_value=adapter):
            result = runner.collect_source("hk-pcpd", "2026-11-09", "2026-11-09", client=client)
        self.assertEqual(result["status"], "empty_window")
        self.assertTrue(result["coverage_complete"])
        self.assertEqual(result["discovered"], 0)
        self.assertFalse(result["errors"])

    def test_unknown_dates_are_retained_for_review_and_other_sources_not_complete(self):
        listing = runner.LISTINGS["calprivacy"]
        detail = "https://privacy.ca.gov/2026/11/privacy-update/"
        adapter = SimpleNamespace(
            parse_listing=lambda source_id, html, url: [{"url": detail, "title": "Privacy update"}],
            parse_detail=lambda source_id, html, url, row: {
                "title_original": row["title"], "content_text": "Official text",
                "content_hash": "abc", "published_date": None,
                "metadata": {"requires_review": False, "ai_ready": True},
            },
        )
        client = _MemoryClient({listing: ("list", "text/html"), detail: ("detail", "text/html")})
        with patch.object(runner, "_adapter", return_value=adapter):
            result = runner.collect_source("calprivacy", "2026-11-01", "2026-11-09", client=client)
        item = result["items"][0]
        self.assertTrue(item["metadata"]["requires_review"])
        self.assertFalse(item["metadata"]["ai_ready"])
        self.assertEqual(item["metadata"]["date_range_status"], "unknown_date_retained_for_review")
        self.assertFalse(result["coverage_complete"])


if __name__ == "__main__":
    unittest.main()
