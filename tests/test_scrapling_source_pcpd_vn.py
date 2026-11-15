import unittest

from scripts.collector_scrapling.adapters import pcpd, vn_gov


class PcpdScraplingAdapterTests(unittest.TestCase):
    def test_archive_urls_cover_inclusive_window_newest_first(self):
        self.assertEqual(
            pcpd.listing_urls("2026-01-25", "2026-01-27"),
            [
                "https://www.info.gov.hk/gia/general/202601/27.htm",
                "https://www.info.gov.hk/gia/general/202601/26.htm",
                "https://www.info.gov.hk/gia/general/202601/25.htm",
            ],
        )

    def test_archive_page_with_no_pcpd_item_is_valid_empty_day(self):
        url = "https://www.info.gov.hk/gia/general/202611/09.htm"
        html = "<ul><li><a href='/gia/general/202611/09/P1.htm'>Red flags hoisted at beaches</a></li></ul>"
        self.assertEqual(pcpd.parse_listing("hk-pcpd", html, url), [])
        self.assertEqual(
            pcpd.next_page_url(html, url, since="2026-11-09"),
            None,
        )

    def test_archive_filters_to_pcpd_article_and_preserves_archive_date(self):
        url = "https://www.info.gov.hk/gia/general/202601/27.htm"
        html = """<ul>
        <li><a href="/gia/general/202601/27/P2026012600522.htm">HKMA and PCPD strengthen collaboration to safeguard personal data</a></li>
        <li><a href="/gia/general/202601/27/P2026012600523.htm">Other government release</a></li>
        <li><a href="https://example.com/privacy">Privacy item on an unapproved host</a></li>
        </ul>"""
        rows = pcpd.parse_listing("hk-pcpd", html, url)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["date_observations"][0]["value"], "2026-01-27")

    def test_detail_returns_full_article_body_with_review_flag(self):
        url = "https://www.info.gov.hk/gia/general/202601/27/P2026012600522.htm"
        html = """<html><body><main><h1>PCPD and HKMA collaboration</h1>
        <div class="content"><p>The Privacy Commissioner announced a personal data initiative.</p>
        <p>It includes further details for members of the public.</p></div></main></body></html>"""
        item = pcpd.parse_detail("hk-pcpd", html, url, {"title": "PCPD and HKMA collaboration", "date_observations": [{"value": "2026-01-27"}]})
        self.assertEqual(item["published_date"], "2026-01-27")
        self.assertIn("personal data initiative", item["content_text"])
        self.assertTrue(item["metadata"]["requires_review"])


class VietnamScraplingAdapterTests(unittest.TestCase):
    def test_home_and_policies_discovery_are_separate_from_timeline(self):
        home = "https://en.baochinhphu.vn/"
        home_html = '<a class="box-focus-link-title" data-linktype="newsdetail" href="/new-policies-111261102100407268.htm">Focus</a>'
        rows = vn_gov.parse_listing("vn-gov", home_html, home)
        self.assertEqual(len(rows), 1)
        self.assertEqual(vn_gov.next_page_url(home_html, home), "https://en.baochinhphu.vn/policies.htm")

        policies = "https://en.baochinhphu.vn/policies.htm"
        policies_html = '''<input id="hdZoneId" value="11151"><script>timeline.url='/timelinelist/{0}/{1}.htm'</script>
        <div class="box-category-item-sub"><h3 class="box-category-content"><a data-linktype="newsdetail" class="box-category-link-title" href="/law-111261102100407268.htm">Law</a></h3></div>'''
        self.assertEqual(len(vn_gov.parse_listing("vn-gov", policies_html, policies)), 1)
        self.assertEqual(vn_gov.next_page_url(policies_html, policies), "https://en.baochinhphu.vn/timelinelist/11151/2.htm")

    def test_timeline_pagination_stops_when_empty_or_before_window(self):
        url = "https://en.baochinhphu.vn/timelinelist/11151/2.htm"
        old = '''<div class="box-category-item-sub"><h3 class="box-category-content"><a class="box-category-link-title" data-linktype="newsdetail" href="/old-story-111261027112720379.htm">Old story</a></h3><span class="time-ago">27 October 2026</span></div>'''
        self.assertIsNone(vn_gov.next_page_url(old, url, since="2026-11-01"))
        self.assertIsNone(vn_gov.next_page_url("", url, since="2026-11-01"))

    def test_detail_checks_full_body_for_relevance_even_when_title_is_generic(self):
        url = "https://en.baochinhphu.vn/new-policies-take-effect-111261102100407268.htm"
        html = '''<html><head><meta property="article:published_time" content="2026-11-02T07:57:00+07:00"></head>
        <h1 class="detail-title" data-role="title">New policies take effect</h1>
        <div class="detail-time"><div data-role="publishdate">November 02, 2026 7:57 AM GMT+7</div></div>
        <div class="detail-content"><p>Decree No. 363/2026/ND-CP provides administrative penalties for violations in the field of personal data protection.</p></div></html>'''
        item = vn_gov.parse_detail("vn-gov", html, url, {"title": "New policies take effect"})
        self.assertEqual(item["published_date"], "2026-11-02")
        self.assertTrue(item["metadata"]["privacy_relevant"])
        self.assertIn("personal data", item["content_text"])

    def test_topic_filter_uses_content_not_title_only(self):
        self.assertTrue(vn_gov.is_privacy_relevant("A general policy announcement about personal data protection"))
        self.assertFalse(vn_gov.is_privacy_relevant("The cabinet met about transport"))


if __name__ == "__main__":
    unittest.main()
