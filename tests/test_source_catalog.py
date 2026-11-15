import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.source_catalog import load_catalog
from scripts.catalog_probe import detail_title, extract_main_text, filter_listing_rows, host_wide_access_failure, parse_listing, privacy_signals


class SourceCatalogTests(unittest.TestCase):
    def test_full_requested_scope_is_present_once(self):
        catalog = load_catalog()
        sources = catalog['sources']
        self.assertEqual(37, len(sources))
        ids = [source['id'] for source in sources]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual({'original-19': 19, 'additional-12': 12, 'additional-source': 5,
                          'previously-tested-held': 1},
                         {cohort: sum(source['cohort'] == cohort for source in sources)
                          for cohort in ('original-19', 'additional-12', 'additional-source',
                                         'previously-tested-held')})
        self.assertNotIn('rd-privacy-watch', ids)
        self.assertIn('eur-lex', ids)

    def test_listing_host_must_be_allowlisted(self):
        bad = '{"version":1,"sources":[{"id":"x","listing":"https://elsewhere.example/news","hosts":["example.org"],"cadence":"daily","language":"en","kind":"official","cohort":"x"}]}'
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'catalog.json'
            path.write_text(bad, encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'listing_host_mismatch'):
                load_catalog(path)

    def test_html_listing_fallback_skips_newsletter_and_keeps_article(self):
        html = b'''<html><body><nav><a href="/news#signupform">Newsletter sign up</a></nav>
          <section><a href="/news/privacy-enforcement-update-2026">Authority issues privacy enforcement update</a></section>
        </body></html>'''
        rows = parse_listing(html, 'https://example.org/news', 'text/html', {'example.org'})
        self.assertEqual(['https://example.org/news/privacy-enforcement-update-2026'], [row['url'] for row in rows])

    def test_text_plain_json_listing_is_parsed_as_json(self):
        data = b'{"items":[{"title":"Privacy announcement","url":"/news/privacy-update"}]}'
        rows = parse_listing(data, 'https://example.org/api', 'text/plain', {'example.org'})
        self.assertEqual('https://example.org/news/privacy-update', rows[0]['url'])

    def test_rss_mastodon_item_uses_description_when_title_is_missing(self):
        feed = b'''<?xml version="1.0"?><rss><channel><item>
          <guid>https://social.edps.europa.eu/@EDPS/123</guid>
          <link>https://social.edps.europa.eu/@EDPS/123</link>
          <pubDate>Sun, 08 Nov 2026 08:36:16 +0000</pubDate>
          <description>&lt;p&gt;*** # Datapedia: Automated proctoring ***&lt;/p&gt;&lt;p&gt;The EDPS published a privacy update.&lt;/p&gt;</description>
        </item></channel></rss>'''
        rows = parse_listing(feed, 'https://social.edps.europa.eu/@EDPS.rss',
                             'application/rss+xml', {'social.edps.europa.eu'})
        self.assertEqual('Datapedia: Automated proctoring', rows[0]['title'])
        self.assertIn('The EDPS published a privacy update.', rows[0]['feed_text'])
        self.assertEqual('2026-11-08', rows[0]['date_observations'][0]['value'])

    def test_trafilatura_extracts_article_body_and_publication_metadata(self):
        html = '''<html><head><title>Privacy enforcement update</title>
          <meta property="article:published_time" content="2026-11-07T10:00:00Z"></head>
          <body><nav>Home Menu Sign up</nav><main><article><h1>Privacy enforcement update</h1>
          <p>The supervisory authority announced a new privacy enforcement decision on Saturday.</p>
          <p>The decision explains the applicable legal obligations and the corrective measures required of the organization.</p>
          <p>The authority will monitor implementation and publish a further update when the review is complete.</p>
          </article></main><footer>Cookie settings</footer></body></html>'''
        body, metadata = extract_main_text(html, 'https://example.org/news/privacy-enforcement-update')
        self.assertIn('supervisory authority', body)
        self.assertNotIn('Cookie settings', body)
        self.assertEqual('2026-11-07', metadata.date)

    def test_catalog_probe_uses_same_precision_preference_as_production(self):
        with patch('scripts.catalog_probe.extract', return_value='A full article body.') as extractor, \
             patch('scripts.catalog_probe.extract_metadata', return_value=None):
            body, _ = extract_main_text('<html><main>A full article body.</main></html>',
                                        'https://example.org/news/1')
        self.assertEqual('A full article body.', body)
        self.assertIs(extractor.call_args.kwargs['favor_precision'], True)

    def test_actual_detail_heading_wins_over_listing_teaser(self):
        html = '<html><body><main><h1>Decision on unlawful online tracking</h1></main></body></html>'
        metadata = type('Metadata', (), {'title': 'SEO title'})()
        self.assertEqual('Decision on unlawful online tracking', detail_title(html, metadata, 'Card title plus teaser'))

    def test_navigation_heading_does_not_replace_article_title(self):
        html = '''<html><head><title>Children's data decision | Authority</title></head>
          <body><main><h1>Main navigation</h1><article><h1>Decision on children's data</h1></article></main></body></html>'''
        metadata = type('Metadata', (), {'title': "Children's data decision | Authority"})()
        self.assertEqual("Decision on children's data", detail_title(html, metadata, 'Listing teaser'))

    def test_generic_heading_falls_back_to_metadata_then_listing_title(self):
        html = '<html><body><h1>News release</h1></body></html>'
        metadata = type('Metadata', (), {'title': 'Data protection enforcement decision | Agency'})()
        self.assertEqual('Data protection enforcement decision', detail_title(html, metadata, 'Listing teaser'))
        no_metadata = type('Metadata', (), {'title': 'Search'})()
        self.assertEqual('Listing title from feed', detail_title(html, no_metadata, 'Listing title from feed'))

    def test_privacy_terms_are_signals_not_an_automatic_relevance_verdict(self):
        self.assertIn('personal data', privacy_signals('Commission publishes decision', 'The ruling concerns personal data.'))
        self.assertEqual([], privacy_signals('Quarterly schedule', 'The committee meets on Tuesday.'))

    def test_listing_filter_rejects_navigation_and_non_topic_items(self):
        source = {'id': 'nist', 'topic_terms': ['privacy', 'personal data']}
        rows = [
            {'url': 'https://www.nist.gov/news-events/news/2026/11/cybersecurity-small-business', 'title': 'NIST Has a Cybersecurity Guide Just for You'},
            {'url': 'https://www.nist.gov/news-events/news/2026/11/privacy-framework', 'title': 'NIST updates privacy framework'},
            {'url': 'https://www.nist.gov/about', 'title': 'About NIST'},
        ]
        rejected = {}
        self.assertEqual([rows[1]], filter_listing_rows(rows, source, rejected))
        self.assertEqual({'no_topic_term_match': 2}, rejected)

    def test_official_topic_scoped_listing_does_not_require_keyword_in_every_title(self):
        source = {'id': 'ftc', 'topic_terms': ['privacy'], 'listing_is_topic_scoped': True}
        rows = [{'url': 'https://www.ftc.gov/news-events/news/press-releases/2026/11/example',
                 'title': 'Commission announces settlement'}]
        self.assertEqual(rows, filter_listing_rows(rows, source))

    def test_only_host_wide_transport_denials_stop_same_host_detail_retries(self):
        for reason in ('http_401', 'http_403', 'http_429', 'http_503'):
            self.assertTrue(host_wide_access_failure(reason))
        for reason in ('http_404', 'http_410', 'detail_fetched_but_main_text_not_extracted:text/html', 'robots_disallowed'):
            self.assertFalse(host_wide_access_failure(reason))

    def test_aepd_compound_card_selector_supplies_real_title_and_date(self):
        from scripts.collector import expansion
        fixture = Path(__file__).parent / 'fixtures' / 'collector-expansion' / 'es-aepd-listing.html'
        route = expansion.ROUTES['es-aepd']
        rows, _ = expansion.discover('es-aepd', fixture.read_text(encoding='utf-8'), route['listing'])
        self.assertEqual(1, len(rows))
        self.assertIn('Agencia y la autoridad de Luxemburgo', rows[0]['title'])
        self.assertNotEqual('Leer más', rows[0]['title'])
        self.assertEqual('2026-10-19T12:00:00Z', rows[0]['date_observations'][0]['value'])


if __name__ == '__main__':
    unittest.main()
