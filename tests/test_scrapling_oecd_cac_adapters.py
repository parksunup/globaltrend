import unittest
from unittest.mock import patch

from scripts.collector_scrapling.adapters.cac import parse_detail as parse_cac_detail
from scripts.collector_scrapling.adapters.cac import parse_listing as parse_cac_listing
from scripts.collector_scrapling.adapters.oecd import LEGACY_LISTING_URL as OECD_LISTING
from scripts.collector_scrapling.adapters.oecd import RSS_LISTING_URLS, listing_urls as oecd_listing_urls
from scripts.collector_scrapling.adapters.oecd import parse_detail as parse_oecd_detail
from scripts.collector_scrapling.adapters.oecd import extract_pdf as extract_oecd_pdf
from scripts.collector_scrapling.adapters.oecd import parse_listing as parse_oecd_listing


class OECDAdapterTests(unittest.TestCase):
    def test_webcms_rss_api_routes_are_primary_and_privacy_titles_are_filtered(self):
        routes = oecd_listing_urls("2026-11-01", "2026-11-09")
        self.assertEqual(routes, list(RSS_LISTING_URLS))
        self.assertTrue(all(url.startswith("https://api.oecd.org/webcms/search/rss?") for url in routes))
        xml = """<?xml version="1.0"?><rss version="2.0"><channel>
          <item><title>Privacy and personal data safeguards</title>
            <link>https://www.oecd.org/en/publications/privacy-safeguards.html</link>
            <description><![CDATA[<p>Official summary about privacy protection.</p>]]></description>
            <pubDate>Mon, 09 Nov 2026 09:00:00 GMT</pubDate></item>
          <item><title>Economic outlook</title><link>https://www.oecd.org/en/publications/economic-outlook.html</link>
            <description>Macroeconomic forecast.</description><pubDate>Mon, 09 Nov 2026 09:00:00 GMT</pubDate></item>
          <item><title>Privacy report</title><link>https://example.org/privacy.html</link>
            <description>Personal data.</description></item>
        </channel></rss>"""
        rows = parse_oecd_listing("oecd", xml, routes[1])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["published_date"], "2026-11-09")
        self.assertEqual(rows[0]["feed_text"], "Official summary about privacy protection.")
        self.assertEqual(rows[0]["read_scope_expected"], "official_rss_summary")

    def test_empty_privacy_rss_feed_is_a_valid_zero_candidate_result(self):
        rows = parse_oecd_listing("oecd", "<rss version='2.0'><channel></channel></rss>", RSS_LISTING_URLS[0])
        self.assertEqual(rows, [])

    def test_rss_excerpt_fallback_is_not_labelled_as_article_body(self):
        row = {
            "title": "Privacy notice",
            "url": "https://www.oecd.org/en/publications/privacy-notice.html",
            "feed_text": "Official RSS abstract.",
            "source_feed_url": RSS_LISTING_URLS[1],
            "published_date": "2026-11-09",
            "date_observations": [{"meaning": "official_rss_published", "value": "2026-11-09"}],
        }
        parsed = parse_oecd_detail("oecd", "", row["url"], row)
        self.assertEqual(parsed["content_text"], "Official RSS abstract.")
        self.assertEqual(parsed["metadata"]["read_scope"], "official_rss_summary")
        self.assertEqual(parsed["metadata"]["source_feed_url"], RSS_LISTING_URLS[1])
        self.assertTrue(parsed["metadata"]["requires_review"])

    def test_pr42_alternate_official_listing_extracts_only_oecd_article_paths(self):
        html = """<main>
          <a href="/en/publications/privacy-digital.html">Privacy and data protection</a>
          <a href="/en/about/news/press-releases/2026/10/oecd-privacy-release.html">OECD privacy release</a>
          <a href="https://example.org/en/publications/privacy.html">External source</a>
          <a href="/en/publications/">Publications index</a>
        </main>"""
        rows = parse_oecd_listing("oecd", html, OECD_LISTING)
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]["url"].startswith("https://www.oecd.org/en/publications/"))
        self.assertEqual(rows[0]["read_scope_expected"], "official_abstract")

    def test_next_page_must_be_observed_on_official_topic_path(self):
        from scripts.collector_scrapling.adapters.oecd import next_page_url

        html = '<main><a rel="next" href="?page=1">Next</a></main>'
        self.assertEqual(next_page_url(html, OECD_LISTING), OECD_LISTING + "?page=1")
        malicious = '<main><a rel="next" href="https://example.org/page">Next</a></main>'
        with self.assertRaises(ValueError):
            next_page_url(malicious, OECD_LISTING)

    def test_abstract_scope_and_date_disagreement_are_preserved(self):
        url = "https://www.oecd.org/en/publications/privacy-report.html"
        html = """<main><h1 class="cmp-report-header__title">Privacy report</h1>
          <time datetime="2026-10-14">15 October 2026</time>
          <div class="cmp-two-column-container"><h2 class="cmp-title__text">Abstract</h2>
          <div class="cmp-text"><p>This is the official abstract, not the complete report.
          <a href="/content/dam/oecd/report.pdf">Download complete report</a></p></div></div></main>"""
        parsed = parse_oecd_detail("oecd", html, url, {"title": "Privacy report"})
        self.assertIn("official abstract", parsed["content_text"])
        self.assertEqual(parsed["metadata"]["read_scope"], "official_abstract")
        self.assertIsNone(parsed["published_date"])
        self.assertTrue(parsed["metadata"]["date_conflict"])
        self.assertTrue(parsed["metadata"]["requires_review"])
        self.assertEqual(len(parsed["metadata"]["unread_attachments"]), 1)

    def test_official_pdf_replaces_abstract_but_preserves_date_conflict(self):
        url = "https://www.oecd.org/content/dam/oecd/report.pdf"
        html_item = {
            "title_original": "Privacy report",
            "published_date": None,
            "metadata": {
                "read_scope": "official_abstract",
                "date_conflict": True,
                "date_observations": [{"meaning": "detail_display_date", "value": "15 October 2026"},
                                      {"meaning": "detail_datetime_attribute", "value": "2026-10-14"}],
                "related_documents": [{"url": url, "title": "Download report", "read": False}],
                "unread_attachments": [url],
            },
        }

        class Page:
            def extract_text(self):
                return "Full official report text."

        class Reader:
            is_encrypted = False
            pages = [Page()]

        with patch("pypdf.PdfReader", return_value=Reader()):
            parsed = extract_oecd_pdf(b"%PDF-test", url, {"html_item": html_item})
        self.assertIn("Full official report text.", parsed["content_text"])
        self.assertEqual(parsed["metadata"]["read_scope"], "official_linked_report_pdf_full_text")
        self.assertTrue(parsed["metadata"]["date_conflict"])
        self.assertEqual(parsed["metadata"]["unread_attachments"], [])


class CACAdapterTests(unittest.TestCase):
    def test_listing_extracts_only_verified_privacy_article_paths(self):
        listing = "https://www.cac.gov.cn/wxzw/sjzl/A093708index_1.htm"
        html = """<div id="loadingInfoPage"><ul>
          <li><h5><a href="/2026-10/28/c_1794942554784626.htm">个人信息保护合规审计服务认证名单</a></h5><span class="times">2026年10月28日</span></li>
          <li><h5><a href="https://example.org/privacy">个人信息跨境</a></h5></li>
          <li><h5><a href="/2026-10/20/c_1794000000000000.htm">会议通知</a></h5></li>
        </ul></div>"""
        rows = parse_cac_listing("cn-cac", html, listing)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["url"], "https://www.cac.gov.cn/2026-10/28/c_1794942554784626.htm")
        self.assertEqual(rows[0]["published_date"], "2026-10-28")

    def test_short_original_notice_is_retained_and_flagged_for_review(self):
        url = "https://www.cac.gov.cn/2026-10/28/c_1794942554784626.htm"
        html = """<html><div class="main-title"><h1 class="title">第三批认证机构名单</h1></div>
          <div id="pubtime">2026年10月28日</div><div id="BodyLabel">
          <p>近期，第三批个人信息保护合规审计服务认证工作已完成，21家机构获得认证。具体名单可通过认证机构官方网站查询。</p>
          </div></html>"""
        parsed = parse_cac_detail("cn-cac", html, url, {"title": "旧标题"})
        self.assertEqual(parsed["title_original"], "第三批认证机构名单")
        self.assertIn("21家机构", parsed["content_text"])
        self.assertEqual(parsed["published_date"], "2026-10-28")
        self.assertTrue(parsed["metadata"]["short_notice"])
        self.assertTrue(parsed["metadata"]["requires_review"])


if __name__ == "__main__":
    unittest.main()
