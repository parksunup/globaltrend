import unittest
from unittest.mock import patch
from scripts.collector.core import FetchError
from scripts.collector import parsers


class CloudStepTests(unittest.TestCase):
    def test_oecd_discovers_related_press_release_on_topic_page(self):
        rows, _ = parsers.discover_listing('oecd', '<main><a href="/en/about/news/press-releases/2026/10/privacy.html">Privacy announcement</a></main>', 'https://www.oecd.org/en/topics/privacy-and-data-protection.html', None)
        self.assertEqual([r['url'] for r in rows], ['https://www.oecd.org/en/about/news/press-releases/2026/10/privacy.html'])

    def test_prepared_store_preserves_cursor_and_queues_ingest_without_db(self):
        from scripts.collector.cloud_step import PreparedStore
        store = PreparedStore({'page':'https://www.ftc.gov/feed','offset':6})
        self.assertEqual(store.resume({}, '2026-10-16', '2026-10-22')['offset'], 6)
        item = {'title_original':'test','published_date':'2026-10-21','content_text':'long enough source text', 'content_hash':'abc', 'metadata':{'ai_ready':True}}
        store.ingest({'source_id':'source','language':'en'}, 'https://www.ftc.gov/news', item)
        store.progress({}, '2026-10-16','2026-10-22', {'offset':7})
        self.assertEqual(store.operations[0]['p_title_original'], 'test')
        self.assertEqual(store.cursor, {'offset':7})
        with self.assertRaisesRegex(ValueError, 'one_document'):
            store.ingest({'source_id':'source'}, 'https://www.ftc.gov/other', item)

    def test_expired_claim_rejected_before_network(self):
        from scripts.collector.cloud_step import validate_claim
        with self.assertRaisesRegex(ValueError, 'lease_expired'):
            validate_claim({'slug':'ftc','lease_until':'2000-01-01T00:00:00+00:00'})

    def test_failed_detail_is_parked_before_next_cursor(self):
        from scripts.collector.cloud_step import prepare
        from scripts.collector.core import HttpClient
        class Client(HttpClient):
            def get(self, url):
                if url.endswith('.xml'):
                    return b'<rss><channel><item><title>Bad document</title><link>https://www.ftc.gov/news-events/news/press-releases/bad</link></item></channel></rss>',url,'application/rss+xml'
                raise FetchError('http_503')
        claim={'slug':'ftc','source_id':'430bd32d-19b1-4752-8280-7b2d2acbda88','since':'2026-10-16','until':'2026-10-22','cursor':None,'lease_until':'2099-01-01T00:00:00+00:00'}
        with patch('scripts.collector.cloud_step.HttpClient', Client):
            bundle=prepare(claim)
        self.assertEqual(bundle['failure']['reason'], 'http_503')
        self.assertEqual(bundle['cursor']['offset'], 1)
        self.assertEqual(bundle['result']['reason'], 'detail_failure_parked')

    def test_backlog_retries_exact_saved_url_without_listing(self):
        from scripts.collector.cloud_step import prepare
        from scripts.collector.core import HttpClient
        class Client(HttpClient):
            def get(self, url):
                self.requested=url
                raise FetchError('http_503')
        target='https://www.ftc.gov/news-events/news/press-releases/known-failed'
        claim={'slug':'ftc','source_id':'430bd32d-19b1-4752-8280-7b2d2acbda88','since':'2026-10-16','until':'2026-10-22','cursor':None,'backlog_id':'saved-backlog','detail':{'url':target,'title':'Known failed'},'lease_until':'2099-01-01T00:00:00+00:00'}
        with patch('scripts.collector.cloud_step.HttpClient', Client):
            bundle=prepare(claim)
        self.assertEqual(bundle['result']['failed_url'], target)
        self.assertEqual(bundle['result']['reason'], 'http_503')
        self.assertFalse(bundle['backlog_resolved'])


if __name__ == '__main__':
    unittest.main()
