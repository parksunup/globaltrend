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

    def test_ftc_walks_past_ten_pages_and_certifies_empty_filtered_window(self):
        listing = "https://search.ftc.gov/news-events/news/press-releases?search=privacy&field_mission%5B29%5D=29"
        responses = {}
        for page in range(1, 13):
            url = listing if page == 1 else listing + f"&page={page - 1}"
            responses[url] = (str(page), "text/html")

        def next_page(html, url):
            page = int(html)
            return listing + f"&page={page}" if page < 12 else None

        adapter = SimpleNamespace(parse_listing=lambda *_args: [], next_page_url=next_page,
                                  listing_dates=lambda _rows: [],
                                  proves_before_window=lambda _rows, _since: False)
        client = _MemoryClient(responses)
        with patch.object(runner, "_adapter", return_value=adapter):
            result = runner.collect_source("ftc", "2026-11-11", "2026-11-13", client=client)
        self.assertEqual(result["pages"], 12)
        self.assertEqual(result["status"], "empty_window")
        self.assertTrue(result["coverage_complete"])
        self.assertEqual(result["items"], [])
        self.assertFalse(result["errors"])

    def test_vietnam_checks_every_candidate_and_continues_past_mixed_date_page(self):
        from scripts.collector_scrapling.adapters import vn_gov

        home = vn_gov.HOME
        policies = vn_gov.POLICIES
        page2 = f"{vn_gov.TIMELINE}/2.htm"
        page3 = f"{vn_gov.TIMELINE}/3.htm"
        urls = [f"https://{vn_gov.HOST}/privacy-item-{i:018d}.htm" for i in range(3)]
        responses = {
            home: ("home", "text/html"),
            policies: ("policies", "text/html"),
            page2: ("mixed", "text/html"),
            page3: ("empty", "text/html"),
            **{url: (day, "text/html") for url, day in zip(urls, ("13", "12", "09"))},
        }

        def parse_listing(_source, html, _url):
            if html == "mixed":
                return [{"url": urls[0], "title": "Privacy A", "published_date": "2026-11-13"},
                        {"url": urls[1], "title": "Privacy B", "published_date": "2026-11-12"},
                        {"url": urls[2], "title": "Privacy C", "published_date": "2026-11-09"}]
            return []

        def next_page(html, url, since=None):
            if url == home:
                return policies
            if url == policies:
                return page2
            if url == page2:
                return page3
            return None

        def proves_exhausted(html, url, _since):
            return url == page3 and html == "empty"

        def parse_detail(_source, html, _url, row):
            day = int(html)
            return {"title_original": row["title"], "content_text": "official article body",
                    "published_date": f"2026-11-{day:02d}", "content_hash": "hash",
                    "metadata": {"privacy_relevant": True}}

        adapter = SimpleNamespace(parse_listing=parse_listing, next_page_url=next_page,
                                   proves_window_exhausted=proves_exhausted,
                                   parse_detail=parse_detail)
        with patch.object(runner, "_adapter", return_value=adapter):
            result = runner.collect_source("vn-gov", "2026-11-11", "2026-11-13",
                                           client=_MemoryClient(responses))
        self.assertEqual(result["details_attempted"], 3)
        self.assertEqual(result["out_of_range"], 1)
        self.assertEqual(len(result["items"]), 2)
        self.assertTrue(result["coverage_complete"])
        self.assertEqual(result["status"], "success")

    def test_unknown_vietnam_date_cannot_be_reported_as_a_proven_empty_window(self):
        from scripts.collector_scrapling.adapters import vn_gov
        home, policies = vn_gov.HOME, vn_gov.POLICIES
        page = f"{vn_gov.TIMELINE}/2.htm"
        detail = f"https://{vn_gov.HOST}/privacy-item-000000000000000001.htm"
        responses = {home: ("home", "text/html"), policies: ("policies", "text/html"),
                     page: ("timeline", "text/html"), detail: ("detail", "text/html")}
        adapter = SimpleNamespace(
            parse_listing=lambda _source, html, _url: ([{"url": detail, "title": "Privacy item"}]
                                                       if html == "timeline" else []),
            next_page_url=lambda _html, url, since=None: policies if url == home else page if url == policies else None,
            proves_window_exhausted=lambda _html, url, _since: url == page,
            parse_detail=lambda *_args: {"title_original": "Privacy item", "content_text": "official content",
                                        "published_date": None, "content_hash": "hash",
                                        "metadata": {"privacy_relevant": False}},
        )
        with patch.object(runner, "_adapter", return_value=adapter):
            result = runner.collect_source("vn-gov", "2026-11-11", "2026-11-13",
                                           client=_MemoryClient(responses))
        self.assertEqual(result["unknown_date_candidates"], 1)
        self.assertFalse(result["coverage_complete"])
        self.assertEqual(result["status"], "partial")


if __name__ == "__main__":
    unittest.main()
