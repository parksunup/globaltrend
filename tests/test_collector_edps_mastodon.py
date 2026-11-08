import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from collector import parsers


FEED = '''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><item>
  <guid>https://social.edps.europa.eu/@EDPS/117523506944514368</guid>
  <link>https://social.edps.europa.eu/@EDPS/117523506944514368</link>
  <pubDate>Thu, 30 Oct 2026 09:00:00 +0000</pubDate>
  <description><![CDATA[<p>EDPS Press Release</p><p>EU-US border information exchange: effective safeguards are essential.</p><p>A new EDPS Opinion addresses the safeguards required for sharing traveler data.</p><p><a href="https://www.edps.europa.eu/example">Read the Opinion</a></p>]]></description>
  <category>privacy</category>
</item></channel></rss>'''
STATUS = '''<!doctype html><html><head>
<meta property="og:title" content="EDPS (@EDPS@social.edps.europa.eu)">
<meta property="og:description" content="EDPS Press Release — EU-US border information exchange. A new EDPS Opinion addresses safeguards for sharing traveler data.">
</head><body></body></html>'''


class EdpsMastodonTests(unittest.TestCase):
    def test_official_rss_discovers_public_status_full_text_and_date(self):
        rows, next_page = parsers.discover(
            'edps', FEED, 'https://social.edps.europa.eu/@EDPS.rss'
        )
        self.assertIsNone(next_page)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['url'], 'https://social.edps.europa.eu/@EDPS/117523506944514368')
        self.assertEqual(row['title'], 'EDPS Press Release')
        self.assertIn('effective safeguards', row['summary'])
        self.assertEqual(row['categories'], ['privacy'])
        self.assertEqual(row['related_documents'][0]['url'], 'https://www.edps.europa.eu/example')
        self.assertEqual(parsers.ftc_listing_date(row), '2026-10-30')

    def test_status_page_body_is_saved_as_official_post_not_linked_report(self):
        rows, _ = parsers.discover('edps', FEED, 'https://social.edps.europa.eu/@EDPS.rss')
        item = parsers.extract_document(
            'edps', STATUS.encode(), rows[0]['url'], 'text/html', rows[0]
        )
        self.assertEqual(item['title_original'], 'EDPS Press Release')
        self.assertIn('sharing traveler data', item['content_text'])
        self.assertEqual(item['published_date'], '2026-10-30')
        self.assertEqual(item['metadata']['read_scope'], 'official_social_post_not_linked_report')
        self.assertEqual(item['metadata']['related_documents'][0]['url'], 'https://www.edps.europa.eu/example')
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])

    def test_mastodon_feed_rejects_non_edps_status_hosts_and_accounts(self):
        foreign_host = FEED.replace('social.edps.europa.eu', 'social.example.org')
        with self.assertRaisesRegex(ValueError, 'edps_status_outside_official_mastodon'):
            parsers.discover('edps', foreign_host, 'https://social.edps.europa.eu/@EDPS.rss')
        foreign_account = FEED.replace('/@EDPS/117523506944514368', '/@other/117523506944514368')
        with self.assertRaisesRegex(ValueError, 'edps_status_outside_official_mastodon'):
            parsers.discover('edps', foreign_account, 'https://social.edps.europa.eu/@EDPS.rss')

    def test_edps_status_parser_rejects_noncanonical_post_paths(self):
        with self.assertRaisesRegex(ValueError, 'edps_status_outside_official_mastodon'):
            parsers.extract_document('edps', STATUS.encode(),
                'https://social.edps.europa.eu/@other/117523506944514368', 'text/html')


if __name__ == '__main__':
    unittest.main()
