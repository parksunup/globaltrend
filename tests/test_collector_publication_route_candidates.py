import unittest

from scripts.collector.publication_route_candidates import discover_publication_route_candidates
from scripts.collector.parsers import extract_publication_document


LISTINGS = {
    "iapp": (
        "https://iapp.org/news",
        """<main><div class="chakra-linkbox">
          <a class="chakra-linkbox__overlay" href="/news/a/privacy-law-update">Privacy law update</a>
          <div class="chakra-card__body"><span>6 Nov. 2026</span><span>OPINION</span></div>
        </div><a class="chakra-linkbox__overlay" href="https://elsewhere.example/news/a/not-ours">External</a></main>""",
    ),
    "fpf": (
        "https://fpf.org/blog/",
        """<main><div class="posts-list facetwp-template">
          <div class="spotlight__colum--post">
            <div class="spotlight__img"><a href="/blog/chatbot-legislation-update/"><img src="/image.jpg"></a></div>
            <h2><a href="/blog/chatbot-legislation-update/">Chatbot legislation update</a></h2>
            <p>Oct 29, 2026</p>
          </div>
          <article><h2><a href="/fpf-training-program-2024-faqs/">FPF Member Training FAQs</a></h2></article>
          <a href="/issue/chatbots/">Chatbots</a>
        </div></main>""",
    ),
    "gpa": (
        "https://globalprivacyassembly.com/news-events/latest-news/",
        """<nav><a href="/not-a-news-item/">Navigation item</a></nav>
        <section><div class="vc_grid-item-mini"><h3>GPA publishes privacy principles</h3>
          <a class="vc_gitem-link vc-zone-link" href="/gpa-privacy-principles/"></a>
          <a href="/gpa-privacy-principles/">Continue reading GPA publishes privacy principles</a>
        </div></section>""",
    ),
    "noyb": (
        "https://noyb.eu/en/news",
        """<header><a class="skip-link" href="#main-content">Skip to main content</a></header>
        <main id="main-content"><article class="node--article--card node--type--article node--view-mode--card">
          <h2>Fnac Darty fined for app tracking</h2>
          <a href="/en/noyb-win-fnac-darty">29.10.2026 Online tracking Fnac Darty fined Read more</a>
        </article></main>""",
    ),
    "freevacy": (
        "https://www.freevacy.com/news",
        """<main><article class="article-card card p-0">
          <h2>CSR Bill amendment and AI agents</h2>
          <a href="/news/the-register/csr-bill-amendment/7815">The Register</a>
          <a href="/news/the-register/csr-bill-amendment/7815">CSR Bill amendment and AI agents</a>
          <a href="/news/the-register/csr-bill-amendment/7815"><img src="/thumb.jpg"></a>
        </article><a href="/news/">News index</a></main>""",
    ),
    "overview-legal": (
        "https://overview.legal/this-week?ui=v1",
        """<section class="type-section"><ul class="post-list">
          <li><a class="post-link" href="/posts/607721">CJEU - C-484/24 - NTH Haustechnik CJEU · Nov 5 EN</a></li>
          <li><a class="topic-link" href="/topics/personal-data">Personal Data 179</a></li>
          <li><a class="post-link" href="/types/news">+ 134 more news →</a></li>
        </ul></section>""",
    ),
}


class PublicationRouteCandidatesTests(unittest.TestCase):
    def test_freevacy_uses_explicit_published_label_date(self):
        html='''<main><h1>CSR Bill amendment grants ministers powers</h1>
        <h5>Published: 05/11/2026</h5><article><p>Official syndicated article body.</p></article></main>'''
        item=extract_publication_document(
            'freevacy',html.encode(),
            'https://www.freevacy.com/news/the-register/csr-bill-amendment-grants-ministers-powers-to-investigate-rogue-ai-agents/7815',
            'text/html',{'title':'CSR Bill amendment grants ministers powers'})
        self.assertEqual(item['published_date'],'2026-11-05')
        self.assertEqual(item['metadata']['date_observations'][0]['locator'],'Freevacy article h5 Published label')

    def test_gpa_uses_explicit_published_time_and_ignores_updated_time(self):
        html = '''<main><h1>GPA reference panel</h1>
        <time class="entry-date published" datetime="2026-11-03T18:52:50+08:00">3 November 2026</time>
        <time class="updated tm-hide" datetime="2026-11-04T07:26:09+08:00">4 November 2026</time>
        <article><p>Official article body with enough text to parse.</p></article></main>'''
        item = extract_publication_document(
            'gpa', html.encode(),
            'https://globalprivacyassembly.com/global-privacy-assembly-welcomes-its-new-gpa-reference-panel-members/',
            'text/html', {'title': 'GPA reference panel'})
        self.assertEqual(item['published_date'], '2026-11-03')
        self.assertEqual(item['metadata']['date_observations'][0]['meaning'], 'published_display')

    def test_g7_opc_dcterms_issued_is_publication_date_not_meeting_date(self):
        html='''<main><h1 id="wb-cont">G7 Data Protection and privacy Authorities Roundtable</h1>
        <meta name="dcterms.issued" title="W3CDTF" content="2026-07-08">
        <meta name="dcterms.modified" title="W3CDTF" content="2026-07-08">
        <section aria-label="Main content"><p>We met on 25 and 26 June 2026 under the presidency of France.</p></section></main>'''
        from scripts.collector.expansion import extract
        item=extract('g7-dpa',html,
            'https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2026/communique-g7-260626')
        self.assertEqual(item['published_date'],'2026-07-08')
        self.assertEqual(item['metadata']['date_observations'][0]['locator'],'meta dcterms.issued')

    def test_each_observed_layout_yields_existing_article_links_and_evidence(self):
        expected = {
            "iapp": ("https://iapp.org/news/a/privacy-law-update", "Privacy law update", "professional_publication"),
            "fpf": ("https://fpf.org/blog/chatbot-legislation-update/", "Chatbot legislation update", "research_organization"),
            "gpa": ("https://globalprivacyassembly.com/gpa-privacy-principles/", "GPA publishes privacy principles", "international_network"),
            "noyb": ("https://noyb.eu/en/noyb-win-fnac-darty", "Fnac Darty fined for app tracking", "civil_society_organization"),
            "freevacy": ("https://www.freevacy.com/news/the-register/csr-bill-amendment/7815", "CSR Bill amendment and AI agents", "syndicated_news_aggregator"),
            "overview-legal": ("https://overview.legal/posts/607721", "CJEU - C-484/24 - NTH Haustechnik CJEU · Nov 5 EN", "third_party_legal_case_aggregator"),
        }
        for source, (listing_url, html) in LISTINGS.items():
            with self.subTest(source=source):
                rows = discover_publication_route_candidates(source, html, listing_url)
                self.assertEqual(len(rows), 1)
                row = rows[0]
                self.assertEqual(row["url"], expected[source][0])
                self.assertEqual(row["title"], expected[source][1])
                self.assertEqual(row["source_type"], expected[source][2])
                self.assertIn("date_observations", row)
                self.assertNotIn("next_url", row)
                self.assertNotIn("continuation_url", row)

    def test_complete_card_dates_are_preserved_as_raw_listing_evidence(self):
        expected = {
            "iapp": "6 Nov. 2026",
            "fpf": "Oct 29, 2026",
            "noyb": "29.10.2026",
        }
        for source, value in expected.items():
            with self.subTest(source=source):
                listing_url, html = LISTINGS[source]
                row = discover_publication_route_candidates(source, html, listing_url)[0]
                self.assertEqual(row["date_observations"][0]["value"], value)
                self.assertEqual(row["date_observations"][0]["meaning"], "listing_published_display")

    def test_unqualified_overview_date_is_not_promoted_to_a_year_or_publication_date(self):
        listing_url, html = LISTINGS["overview-legal"]
        row = discover_publication_route_candidates("overview-legal", html, listing_url)[0]
        self.assertEqual(row["date_observations"], [{
            "meaning": "listing_date_unqualified",
            "locator": "visible overview.legal post label; year absent",
            "value": "Nov 5",
        }])
        self.assertEqual(row["content_origin_kind"], "third_party_aggregated_record")
        self.assertFalse(row["primary_source_verified_by_this_listing"])

    def test_structured_article_published_date_is_used_and_modified_date_is_ignored(self):
        from scripts.collector.parsers import extract_publication_document
        html='''<main><h1>Article</h1><article>Article text with enough content.</article>
        <script type="application/ld+json">{"@type":"Article","datePublished":"2026-05-28T00:00:00Z","dateModified":"2026-11-13T06:00:31Z"}</script></main>'''
        item=extract_publication_document('overview-legal',html.encode(),
            'https://overview.legal/posts/607723','text/html')
        self.assertEqual(item['published_date'],'2026-05-28')
        self.assertEqual(item['metadata']['date_observations'][0]['locator'],
                         'application/ld+json datePublished')

    def test_iapp_full_listing_date_is_normalized_when_detail_has_only_schema_metadata(self):
        from scripts.collector.parsers import extract_publication_document
        url,listing=LISTINGS['iapp']
        row=discover_publication_route_candidates('iapp',listing,url)[0]
        row.update(source_type='professional_publication',source_name='IAPP')
        item=extract_publication_document('iapp',b'<main><h1>Article</h1><article>Article text.</article></main>',
            'https://iapp.org/news/a/privacy-law-update','text/html',row)
        self.assertEqual(item['published_date'],'2026-11-06')

    def test_freevacy_is_retained_as_a_syndicated_aggregator_item(self):
        listing_url, html = LISTINGS["freevacy"]
        row = discover_publication_route_candidates("freevacy", html, listing_url)[0]
        self.assertEqual(row["source_name"], "Freevacy")
        self.assertEqual(row["content_origin_kind"], "syndicated_summary")
        self.assertEqual(row["publisher_label"], "The Register")
        self.assertEqual(row["date_observations"], [])

    def test_gpa_deduplicates_image_and_text_anchors_for_the_same_existing_article(self):
        listing_url, html = LISTINGS["gpa"]
        rows = discover_publication_route_candidates("gpa", html, listing_url)
        self.assertEqual([row["url"] for row in rows], ["https://globalprivacyassembly.com/gpa-privacy-principles/"])

    def test_overview_legal_does_not_treat_topic_or_more_links_as_articles(self):
        listing_url, html = LISTINGS["overview-legal"]
        rows = discover_publication_route_candidates("overview-legal", html, listing_url)
        self.assertTrue(all(row["url"].startswith("https://overview.legal/posts/") for row in rows))
        self.assertEqual(len(rows), 1)

    def test_fpf_does_not_select_training_faq_or_issue_taxonomy_as_blog_article(self):
        listing_url, html = LISTINGS["fpf"]
        rows = discover_publication_route_candidates("fpf", html, listing_url)
        self.assertEqual(len(rows), 1)
        self.assertIn("/blog/", rows[0]["url"])
        self.assertNotIn("training-program", rows[0]["url"])

    def test_listing_url_and_article_hosts_must_match_observed_allowlist(self):
        with self.assertRaisesRegex(ValueError, "listing_url_unverified"):
            discover_publication_route_candidates("iapp", LISTINGS["iapp"][1], "https://evil.example/news")
        html = '<div class="chakra-linkbox"><a class="chakra-linkbox__overlay" href="https://evil.example/news/a/fake">Fake</a></div>'
        self.assertEqual(discover_publication_route_candidates("iapp", html, LISTINGS["iapp"][0]), [])

    def test_unsupported_sources_fail_explicitly(self):
        with self.assertRaisesRegex(ValueError, "source_unsupported"):
            discover_publication_route_candidates("not-a-supported-source", "<main></main>", "https://example.org/news")


if __name__ == "__main__":
    unittest.main()
