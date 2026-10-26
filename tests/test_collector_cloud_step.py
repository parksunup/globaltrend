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
    def test_ftc_out_of_range_pubdate_skips_only_detail_request(self):
        from scripts.collector.core import collect
        from scripts.collector.cloud_step import PreparedStore
        listing='https://www.ftc.gov/feeds/press-release-consumer-protection.xml'
        url='https://www.ftc.gov/news-events/news/press-releases/outside-range'
        class Client:
            def __init__(self): self.requests=[]
            def get(self,target):
                self.requests.append(target)
                if target==listing:
                    return ('<rss><channel><item><title>Old release</title><link>'+url+
                            '</link><pubDate>Sun, 18 Oct 2026 14:00:00 +0000</pubDate></item></channel></rss>').encode(),target,'application/rss+xml'
                raise AssertionError('out-of-range detail page should not be fetched')
        config={'source':'ftc','source_id':'source','language':'en','listing':listing,
                'hosts':['www.ftc.gov'],'enabled':True,'permissions':{'collect':True,'store':True,'ai':True}}
        client=Client(); store=PreparedStore(None)
        result=collect(config,client,store,'2026-10-19','2026-10-25',max_pages=1,max_items=1)
        self.assertEqual(client.requests,[listing])
        self.assertEqual(result['out_of_range'],1)
        self.assertEqual(result['listing_date_excluded'],1)
        self.assertEqual(result['range_filter_read_scope'],'listing_date_only')
        self.assertEqual(result['listing_date_evidence']['date'],'2026-10-18')
        self.assertFalse(result['coverage_complete'])

    def test_ftc_missing_or_untrusted_pubdate_falls_back_to_detail(self):
        from scripts.collector.core import collect
        from scripts.collector.cloud_step import PreparedStore
        listing='https://www.ftc.gov/feed.xml'; url='https://www.ftc.gov/news-events/news/press-releases/item'
        config={'source':'ftc','source_id':'source','language':'en','listing':listing,
                'hosts':['www.ftc.gov'],'enabled':True,'permissions':{'collect':True,'store':True,'ai':True}}
        for tags in ('', '<pubDate>19 Oct 2026 00:00:00</pubDate>',
                     '<pubDate>Mon, 19 Oct 2026 00:00:00 +0000</pubDate><pubDate>Tue, 20 Oct 2026 00:00:00 +0000</pubDate>'):
            class Client:
                def __init__(self): self.requests=[]
                def get(self,target):
                    self.requests.append(target)
                    if target==listing:
                        return ('<rss><channel><item><title>Release</title><link>'+url+'</link>'+tags+'</item></channel></rss>').encode(),target,'application/rss+xml'
                    return b'body',target,'text/html'
            config_row={'title_original':'Release','published_date':'2026-10-20','content_text':'Complete source text.','content_hash':'hash','metadata':{'requires_review':False,'date_observations':[]}}
            client=Client(); store=PreparedStore(None)
            with patch('scripts.collector.core.parsers.extract_document',return_value=config_row):
                collect(config,client,store,'2026-10-19','2026-10-25',max_pages=1,max_items=1)
            self.assertEqual(client.requests,[listing,url])

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
        self.assertIsNotNone(third.cursor)
        self.assertEqual(len(third.cursor['processed_url_hashes']),len(urls))
        self.assertEqual(third.cursor['offset'],0)
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


class OECDPressReleaseTests(unittest.TestCase):
    url='https://www.oecd.org/en/about/news/press-releases/2022/12/privacy.html'
    html='''<main><div itemtype="https://schema.org/Article" itemscope>
      <h1 class="cmp-article-header__title" itemprop="headline">Privacy agreement</h1>
      <div class="cmp-article-header__date"><time datetime="2022-12-14" itemprop="datePublished">14 December 2022</time></div>
      <div itemprop="articleBody"><div class="text"><div class="cmp-text"><p>Official statement on privacy and government access.
      <a href="/en/publications/report.html">Related report</a></p></div></div></div>
      <div class="cmp-text"><p>Related content outside article must be excluded.</p></div>
    </div></main>'''

    def test_press_release_extracts_only_observed_article_body(self):
        item=parsers.extract('oecd',self.html,self.url)
        self.assertEqual(item['title_original'],'Privacy agreement')
        self.assertEqual(item['published_date'],'2022-12-14')
        self.assertNotIn('outside article',item['content_text'])
        self.assertEqual(item['metadata']['read_scope'],'press_release_html_not_report')
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertEqual(item['metadata']['related_documents'][0]['read'],False)
        self.assertIn('https://www.oecd.org/en/publications/report.html',item['metadata']['unread_attachments'])

    def test_press_release_conflicting_dates_remain_unresolved(self):
        item=parsers.extract('oecd',self.html.replace('datetime="2022-12-14"','datetime="2022-12-13"'),self.url)
        self.assertIsNone(item['published_date'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertEqual(len(item['metadata']['date_observations']),2)

    def test_unverified_article_template_does_not_broaden_publication_parser(self):
        with self.assertRaisesRegex(ValueError,'title_or_body_missing'):
            parsers.extract('oecd',self.html,'https://www.oecd.org/en/publications/report.html')


class FTCBoundedResumeTests(unittest.TestCase):
    def run_feed(self,count):
        import json
        from scripts.collector.core import collect
        from scripts.collector.cloud_step import PreparedStore
        urls=['https://www.ftc.gov/news-events/news/press-releases/item-'+str(i) for i in range(count)]
        config={'source':'ftc','source_id':'source','language':'en','listing':'https://www.ftc.gov/feed.xml',
                'hosts':['www.ftc.gov'],'enabled':True,'permissions':{'collect':True,'store':True,'ai':True}}
        class Client:
            turn=0
            fetched=[]
            def get(self,url):
                if url==config['listing']:
                    self.turn+=1
                    order=urls[self.turn%count:]+urls[:self.turn%count]
                    rss='<rss><channel>'+''.join('<item><title>Changed '+str(self.turn)+'</title><link>'+u+'</link></item>' for u in order)+'</channel></rss>'
                    return rss.encode(),url,'application/rss+xml'
                self.fetched.append(url)
                html='<h1>Privacy action</h1><article class="node--view-mode-banner"><time datetime="2026-10-22">22 October 2026</time></article><main><article class="node--view-mode-full"><div class="field--name-body"><p>Complete official privacy action statement.</p></div></article></main>'
                return html.encode(),url,'text/html'
        client=Client();cursor=None;results=[]
        for _ in range(count+1):
            store=PreparedStore(cursor)
            result=collect(config,client,store,'2026-10-16','2026-10-23',max_pages=1,max_items=1)
            results.append(result);cursor=store.cursor
            if cursor is not None:
                self.assertLessEqual(len(json.dumps(cursor,ensure_ascii=False).encode()),4000)
            if cursor is None or result['reason']=='ftc_resume_cursor_capacity_exceeded':break
        self.assertEqual(len(client.fetched),len(set(client.fetched)))
        self.assertTrue(all(not r['coverage_complete'] for r in results))
        return client,cursor,results,config

    def test_full_thirty_item_mutable_feed_finishes_without_false_coverage(self):
        client,cursor,results,_=self.run_feed(30)
        self.assertEqual(len(client.fetched),30)
        self.assertIsNotNone(cursor)
        self.assertEqual(len(cursor['processed_url_hashes']),30)
        self.assertTrue(results[-1]['listing_scan_complete'])
        self.assertFalse(results[-1]['coverage_complete'])

    def test_completed_feed_scan_persists_seen_urls_for_next_scheduled_run(self):
        import hashlib, json
        from scripts.collector.core import collect
        from scripts.collector.cloud_step import PreparedStore
        urls=['https://www.ftc.gov/news-events/news/press-releases/persist-'+str(i) for i in range(30)]
        config={'source':'ftc','source_id':'source','language':'en','listing':'https://www.ftc.gov/feed.xml',
                'hosts':['www.ftc.gov'],'enabled':True,'permissions':{'collect':True,'store':True,'ai':True}}

        class Client:
            turn=0
            fetched=[]
            def get(self,url):
                if url==config['listing']:
                    self.turn+=1
                    # Mutate both titles and order between one-item cloud claims.
                    order=urls[self.turn%len(urls):]+urls[:self.turn%len(urls)]
                    rss='<rss><channel>'+''.join('<item><title>Changed '+str(self.turn)+' '+str(i)+'</title><link>'+u+'</link></item>' for i,u in enumerate(order))+'</channel></rss>'
                    return rss.encode(),url,'application/rss+xml'
                self.fetched.append(url)
                html='<h1>Privacy action</h1><article class="node--view-mode-banner"><time datetime="2026-10-22">22 October 2026</time></article><main><article class="node--view-mode-full"><div class="field--name-body"><p>Complete official privacy action statement.</p></div></article></main>'
                return html.encode(),url,'text/html'

        client=Client(); cursor=None; result=None
        for _ in range(len(urls)+2):
            store=PreparedStore(cursor)
            result=collect(config,client,store,'2026-10-16','2026-10-23',max_pages=1,max_items=1)
            cursor=store.cursor
            if result.get('listing_scan_complete'): break
        self.assertTrue(result and result.get('listing_scan_complete'))
        self.assertEqual(set(client.fetched),set(urls))
        expected=sorted(hashlib.sha256(url.encode()).hexdigest() for url in urls)
        self.assertIsNotNone(cursor)
        self.assertEqual(cursor.get('processed_url_hashes'),expected)
        self.assertLessEqual(len(json.dumps(cursor,ensure_ascii=False).encode()),4000)
        self.assertFalse(result['coverage_complete'])

        fetched_before=list(client.fetched)
        # A new scheduled scan sees the same URLs in a different order and with
        # changed titles; it should skip detail requests by stable URL identity.
        next_store=PreparedStore(cursor)
        next_result=collect(config,client,next_store,'2026-10-16','2026-10-24',max_pages=1,max_items=1)
        self.assertTrue(next_result.get('listing_scan_complete'))
        self.assertEqual(client.fetched,fetched_before)
        self.assertEqual(next_store.cursor.get('processed_url_hashes'),expected)
        self.assertFalse(next_result['coverage_complete'])

    def test_large_mutable_feed_stops_before_cursor_overflow_without_forgetting_urls(self):
        import hashlib
        client,cursor,results,config=self.run_feed(65)
        self.assertEqual(results[-1]['reason'],'ftc_resume_cursor_capacity_exceeded')
        self.assertIsNotNone(cursor)
        self.assertGreater(len(client.fetched),30)
        self.assertLess(len(client.fetched),65)
        self.assertEqual(len(cursor['processed_url_hashes']),len(client.fetched))
        self.assertEqual(set(cursor['processed_url_hashes']),
                         {hashlib.sha256(url.encode()).hexdigest() for url in client.fetched})
        self.assertFalse(results[-1]['coverage_complete'])
        from scripts.collector.core import collect
        from scripts.collector.cloud_step import PreparedStore
        saved_cursor=dict(cursor)
        fetched=list(client.fetched)
        retry=PreparedStore(cursor)
        result=collect(config,client,retry,'2026-10-16','2026-10-23',max_pages=1,max_items=1)
        self.assertEqual(result['reason'],'ftc_resume_cursor_capacity_exceeded')
        self.assertEqual(retry.cursor,saved_cursor)
        self.assertEqual(client.fetched,fetched)
        self.assertEqual(retry.operations,[])
        self.assertIsNone(retry.failure)


if __name__ == '__main__':
    unittest.main()
