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

class MutableFeedResumeTests(unittest.TestCase):
    def test_ftc_resumes_by_processed_urls_when_listing_titles_change(self):
        from scripts.collector.core import collect
        from scripts.collector.cloud_step import PreparedStore
        urls = ['https://www.ftc.gov/news-events/news/press-releases/a',
                'https://www.ftc.gov/news-events/news/press-releases/b',
                'https://www.ftc.gov/news-events/news/press-releases/c']
        config = {'source':'ftc','source_id':'source','language':'en',
                  'listing':'https://www.ftc.gov/feed.xml','hosts':['www.ftc.gov'],
                  'enabled':True,'permissions':{'collect':True,'store':True,'ai':True}}
        item = {'title_original':'Privacy action','published_date':'2026-10-22',
                'content_text':'Complete official article content.', 'content_hash':'abc',
                'metadata':{'requires_review':False}}
        class Client:
            def get(self, url):
                return b'body', url, 'text/html'
        rows = lambda title: [{'url':urls[0],'title':title},{'url':urls[1],'title':'B'},{'url':urls[2],'title':'C'}]
        first = PreparedStore(None)
        second = PreparedStore(None)
        third = PreparedStore(None)
        with patch('scripts.collector.core.fetch_listing', side_effect=[
                (rows('A'),None),(rows('A updated'),None),(rows('A changed again'),None)]), \
             patch('scripts.collector.core.parsers.extract_document', return_value=item):
            collect(config,Client(),first,'2026-10-16','2026-10-23',max_pages=1,max_items=1)
            second.cursor=first.cursor
            collect(config,Client(),second,'2026-10-16','2026-10-23',max_pages=1,max_items=1)
            self.assertEqual(second.operations[0]['p_canonical_url'],urls[1])
            third.cursor=second.cursor
            collect(config,Client(),third,'2026-10-16','2026-10-23',max_pages=1,max_items=1)
        self.assertEqual(third.operations[0]['p_canonical_url'],urls[2])
        self.assertIsNone(third.cursor)
        self.assertFalse(third.complete)

class OECDOverviewTests(unittest.TestCase):
    def test_publication_overview_without_abstract_preserves_limited_scope(self):
        html = '''<main><h1 class="cmp-report-header__title">Regulatory Policy Outlook</h1>
        <div class="cmp-two-column-container"><h2 class="cmp-title__text">Introduction</h2>
        <div class="cmp-text"><p>Official introduction about regulatory governance and public policy.</p></div></div>
        <div class="cmp-text"><p>Related publication must not become report body.</p></div></main>'''
        item=parsers.extract('oecd',html,'https://www.oecd.org/en/publications/report.html')
        self.assertEqual(item['metadata']['read_scope'],'official_overview')
        self.assertTrue(item['metadata']['requires_review'])
        self.assertNotIn('Related publication',item['content_text'])
        self.assertIn('Official introduction',item['content_text'])


if __name__ == '__main__':
    unittest.main()
