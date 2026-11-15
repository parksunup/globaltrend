import unittest
from unittest.mock import patch

from scripts.collector_scrapling.adapters import calprivacy, ftc


class FtcScraplingAdapterTests(unittest.TestCase):
    def test_listing_url_omits_robots_disallowed_page_size_parameter(self):
        self.assertIn("search=privacy", ftc.LISTING_URL)
        self.assertIn("field_mission%5B29%5D=29", ftc.LISTING_URL)
        self.assertNotIn("items_per_page", ftc.LISTING_URL)

    def test_listing_rejects_disallowed_parameter_even_if_html_has_results(self):
        html = '<main><article><h2><a href="/news-events/news/press-releases/2026/07/privacy-action">Privacy action</a></h2></article></main>'
        with self.assertRaisesRegex(ValueError, "robots_disallowed_page_size_parameter"):
            ftc.parse_listing(
                "ftc", html,
                "https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29",
            )

    def test_listing_filters_privacy_and_rejects_off_host_links(self):
        html = '''<main>
          <article><h2><a href="/news-events/news/press-releases/2026/07/privacy-action">FTC privacy practices action</a></h2><time datetime="2026-07-29T12:00:00-04:00"></time></article>
          <article><h2><a href="/news-events/news/press-releases/2026/07/competition">Competition matters</a></h2></article>
          <article><h2><a href="https://evil.example/news-events/news/press-releases/2026/07/privacy">Privacy action</a></h2></article>
        </main>'''
        rows = ftc.parse_listing("ftc", html, ftc.LISTING_URL)
        self.assertEqual(1, len(rows))
        self.assertEqual("FTC privacy practices action", rows[0]["title"])
        self.assertEqual("https://search.ftc.gov/news-events/news/press-releases/2026/07/privacy-action", rows[0]["url"])
        self.assertEqual("2026-07-29T12:00:00-04:00", rows[0]["date_observations"][0]["value"])

    def test_next_page_preserves_allowed_filters_and_never_adds_page_size(self):
        html = '<a rel="next" href="?search=privacy&amp;field_mission%5B29%5D=29&amp;page=1">Next</a>'
        target = ftc.next_page_url(html, ftc.LISTING_URL)
        self.assertEqual(
            "https://search.ftc.gov/news-events/news/press-releases?search=privacy&field_mission%5B29%5D=29&page=1",
            target,
        )

    def test_verified_oldest_first_page_can_end_window_scan_but_unknown_dates_cannot(self):
        older = '''<main><article><a href="/news-events/news/press-releases/2026/10/privacy-update">FTC privacy update</a><time datetime="2026-10-30"></time></article><a rel="next" href="?search=privacy&amp;field_mission%5B29%5D=29&amp;page=2">Next</a></main>'''
        self.assertIsNone(ftc.next_page_url(older, ftc.LISTING_URL, since="2026-11-11"))
        unknown = '''<main><article><a href="/news-events/news/press-releases/2026/10/privacy-update">FTC privacy update</a></article><a rel="next" href="?search=privacy&amp;field_mission%5B29%5D=29&amp;page=2">Next</a></main>'''
        self.assertIsNotNone(ftc.next_page_url(unknown, ftc.LISTING_URL, since="2026-11-11"))

    def test_detail_uses_source_body_fallback_and_records_review_state(self):
        html = '''<html><main><article><h1>FTC privacy release</h1>
          <time datetime="2026-07-29T12:00:00-04:00"></time>
          <div class="field--name-body"><p>The Commission announced a privacy enforcement action.</p></div>
        </article></main></html>'''
        with patch.object(ftc, "_trafilatura_text", return_value=""):
            item = ftc.parse_detail("ftc", html, "https://search.ftc.gov/news-events/news/press-releases/2026/07/privacy-action", {"title": "listing title"})
        self.assertEqual("FTC privacy release", item["title_original"])
        self.assertIn("privacy enforcement action", item["content_text"])
        self.assertEqual("2026-07-29", item["published_date"])
        self.assertTrue(item["metadata"]["requires_review"])
        self.assertFalse(item["metadata"]["ai_ready"])

    def test_detail_date_conflict_with_route_month_is_not_silently_accepted(self):
        html = '''<html><main><article><h1>FTC privacy release</h1>
          <time datetime="2026-02-13T22:00:00Z"></time>
          <div class="field--name-body"><p>A privacy enforcement action.</p></div>
        </article></main></html>'''
        item = ftc.parse_detail(
            "ftc", html,
            "https://search.ftc.gov/news-events/news/press-releases/2026/07/privacy-action",
            {"title": "FTC privacy release"},
        )
        self.assertIsNone(item["published_date"])
        self.assertTrue(item["metadata"]["date_conflict"])
        self.assertIn("route_month_candidate_not_full_date", [
            observation["meaning"] for observation in item["metadata"]["date_observations"]
        ])


class CalPrivacyScraplingAdapterTests(unittest.TestCase):
    def test_listing_keeps_relevant_cards_and_verified_next_page(self):
        html = '''<main><article class="post">
          <div class="cat-info"><h2>Privacy enforcement update</h2></div>
          <a class="thumbnail-link" href="/2026/11/privacy-enforcement-update/"></a>
          <span class="published">November 6, 2026</span>
        </article><article class="post"><div class="cat-info"><h2>Office event</h2></div>
          <a class="thumbnail-link" href="/2026/11/office-event/"></a></article>
          <a class="next" href="/category/content-types/news/press-release/page/2/">Older</a>
        </main>'''
        rows = calprivacy.parse_listing("calprivacy", html, calprivacy.LISTING_URL)
        self.assertEqual(1, len(rows))
        self.assertEqual("Privacy enforcement update", rows[0]["title"])
        self.assertEqual("https://privacy.ca.gov/2026/11/privacy-enforcement-update/", rows[0]["url"])
        self.assertEqual(
            "https://privacy.ca.gov/category/content-types/news/press-release/page/2/",
            calprivacy.next_page_url(html, calprivacy.LISTING_URL),
        )

    def test_next_page_rejects_external_hosts(self):
        html = '<a rel="next" href="https://evil.example/category/content-types/news/press-release/page/2/">Next</a>'
        self.assertIsNone(calprivacy.next_page_url(html, calprivacy.LISTING_URL))

    def test_detail_uses_official_body_and_marks_machine_extraction(self):
        html = '''<html><head><meta property="article:published_time" content="2026-11-06T08:00:00-08:00"></head>
          <main><h1>Privacy enforcement update</h1><div class="et_pb_text_1"><div class="et_pb_text_inner">
          The agency announced an enforcement update and described the official action.
          </div></div></main></html>'''
        with patch.object(calprivacy, "_trafilatura_text", return_value=""):
            item = calprivacy.parse_detail("calprivacy", html, "https://privacy.ca.gov/2026/11/privacy-enforcement-update/", {})
        self.assertEqual("Privacy enforcement update", item["title_original"])
        self.assertIn("official action", item["content_text"])
        self.assertEqual("2026-11-06", item["published_date"])
        self.assertTrue(item["metadata"]["requires_review"])
        self.assertFalse(item["metadata"]["ai_ready"])


if __name__ == "__main__":
    unittest.main()
