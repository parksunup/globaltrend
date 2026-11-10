import datetime as dt
import json
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from scripts.collector import cloud_step


ROOT = Path(__file__).resolve().parents[1]


class NPCOfficialRSSCloudTests(unittest.TestCase):
    def test_cloud_backlog_resolves_from_full_official_feed_without_article_request(self):
        config = next(row for row in json.loads((ROOT / 'config/trend-collector.json').read_text())['sources']
                      if row['source'] == 'npc-ph')
        self.assertTrue(config['enabled'])
        self.assertEqual(config['executor'], 'cloud-python')
        article = 'https://privacy.gov.ph/npc-statement/'
        listing = config['listing']
        feed = b'''<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>
        <title>NPC statement on reported data leaks</title><link>https://privacy.gov.ph/npc-statement/</link>
        <pubDate>Fri, 06 Nov 2026 04:25:05 +0000</pubDate><description><![CDATA[Short teaser.]]></description>
        <content:encoded><![CDATA[<p>QUEZON CITY, 06 November 2026 - The National Privacy Commission issued a statement on reported leaks.</p>
        <p>The Commission described the confirmed access, response measures, and obligations for affected agencies.</p>]]></content:encoded>
        </item></channel></rss>'''

        class Client:
            def __init__(self, *args, **kwargs):
                self.budget = {'requests': 0, 'bytes': 0}
                self.calls = []

            def get(self, url):
                self.calls.append(url)
                self.budget['requests'] += 1
                self.budget['bytes'] += len(feed)
                if url != listing:
                    raise AssertionError('the blocked article detail URL must not be fetched')
                return feed, listing, 'application/rss+xml'

            def close(self):
                pass

        claim = {
            'slug': 'npc-ph', 'source_id': config['source_id'],
            'worker': 'npc-rss-regression', 'lease_token': str(uuid.uuid4()),
            'lease_until': (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)).isoformat(),
            'msg_id': 1, 'read_ct': 1, 'since': '2026-11-06', 'until': '2026-11-06',
            'cursor': None,
            'detail': {'url': article, 'title': 'NPC statement on reported data leaks', 'date_observations': []},
        }
        with patch.object(cloud_step, 'HttpClient', Client):
            bundle = cloud_step.prepare(claim)

        self.assertEqual(bundle['result']['status'], 'partial')
        self.assertEqual(len(bundle['operations']), 1)
        operation = bundle['operations'][0]
        self.assertEqual(operation['p_canonical_url'], article)
        self.assertEqual(operation['p_published_at'], '2026-11-06T00:00:00Z')
        self.assertIn('confirmed access', operation['p_content_text'])
        self.assertEqual(operation['p_metadata']['extraction_method'], 'rss_content_encoded')
        self.assertTrue(operation['p_metadata']['requires_review'])
        self.assertFalse(operation['p_metadata']['ai_ready'])

    def test_netherlands_ap_route_remains_held_pending_reuse_review(self):
        config = next(row for row in json.loads((ROOT / 'config/trend-collector.json').read_text())['sources']
                      if row['source'] == 'nl-ap')
        self.assertFalse(config['enabled'])
        self.assertEqual(config['hold_reason'], 'separate_source_terms_and_reuse_review_pending')
        self.assertEqual(config['executor'], 'cloud-python')
        class Client:
            def __init__(self, *args, **kwargs):
                self.budget = {'requests': 0, 'bytes': 0}
            def get(self, url):
                self.budget['requests'] += 1
                raise AssertionError('held AP route must not make a network request')
        claim = {'slug':'nl-ap','source_id':config['source_id'],'since':'2026-10-30','until':'2026-10-30',
                 'cursor':None,'lease_until':'2099-01-01T00:00:00+00:00'}
        with patch.object(cloud_step, 'HttpClient', Client):
            with self.assertRaisesRegex(ValueError, 'cloud_source_not_assigned'):
                cloud_step.prepare(claim)

        from scripts.collector.extraction import extract_official_rss_summary
        item = extract_official_rss_summary({
            'rss_source':'nl-ap','url':'https://autoriteitpersoonsgegevens.nl/actueel/handhavingsbeleid-ap-gepubliceerd',
            'title':'Handhavingsbeleid AP gepubliceerd',
            'feed_text':'De Autoriteit Persoonsgegevens heeft het handhavingsbeleid openbaar gemaakt.',
            'date_observations':[{'meaning':'listing_published_rfc822','locator':'rss item pubDate',
                                  'value':'Fri, 30 Oct 2026 00:07:29 +0100'}],
        })
        self.assertEqual(item['published_date'], '2026-10-30')
        self.assertEqual(item['metadata']['read_scope'], 'official_rss_summary_only')
        self.assertEqual(item['metadata']['source_body_completeness'], 'summary_only')
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])


if __name__ == '__main__':
    unittest.main()
