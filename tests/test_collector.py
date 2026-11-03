import unittest, sys, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

class CollectorTests(unittest.TestCase):
    def setUp(self):
        from collector import core, parsers
        self.core, self.parsers = core, parsers

    def test_canonical_keeps_semantic_query_and_refuses_other_hosts(self):
        self.assertEqual(self.core.canonical_url('https://www.ftc.gov/a?utm_source=x&page=2#b', {'www.ftc.gov'}), 'https://www.ftc.gov/a?page=2')
        with self.assertRaises(ValueError): self.core.canonical_url('https://evil.test/a', {'www.ftc.gov'})
        with self.assertRaises(ValueError): self.core.canonical_url('https://user:pass@www.ftc.gov/a', {'www.ftc.gov'})

    def test_edpb_body_hash_ignores_footer_and_date_is_displayed(self):
        h='<h2 class="node-article-full__title">Guidelines</h2><time class="node-article-full__date">7 October 2026</time><div class="node-article-full__body"><p>Personal data and rights.</p><a href="/guidance">Full guidelines</a></div><footer>cookie 1</footer>'
        a=self.parsers.extract('edpb',h,'https://www.edpb.europa.eu/news/a')
        b=self.parsers.extract('edpb',h.replace('cookie 1','cookie 2'),'https://www.edpb.europa.eu/news/a')
        self.assertEqual(a['content_hash'], b['content_hash']); self.assertEqual(a['published_date'],'2026-10-07')
        self.assertEqual(a['metadata']['related_documents'][0]['read'],False)

    def test_missing_date_never_uses_url_year(self):
        a=self.parsers.extract('edpb','<h2 class="node-article-full__title">A</h2><div class="node-article-full__body">Data protection policy.</div>','https://www.edpb.europa.eu/news/2026/a')
        self.assertIsNone(a['published_date']); self.assertTrue(a['metadata']['requires_review'])

    def test_oecd_disagreeing_dates_leave_null(self):
        a=self.parsers.extract('oecd','<h1 class="cmp-report-header__title">Report</h1><time datetime="2025-06-16">17 June 2025</time><div class="cmp-two-column-container"><h2 class="cmp-title__text">Abstract</h2><div class="cmp-text"><p>Privacy technologies.</p></div></div>','https://www.oecd.org/en/publications/a')
        self.assertIsNone(a['published_date']); self.assertEqual(a['metadata']['read_scope'],'official_abstract')

    def test_cnil_collapsed_faq_is_preserved(self):
        a=self.parsers.extract('cnil','<main><h1>A</h1><div class="ctn-gen-auteur">9 septembre 2026</div><div class="ctn-gen-body">Personal data</div><div class="ctn-gen-after"><div class="ctn-gen-ascenseur">Important FAQ exception</div><div>related cookie junk</div></div></main>','https://www.cnil.fr/fr/a')
        self.assertIn('Important FAQ exception',a['content_text']); self.assertNotIn('related cookie junk',a['content_text'])

    def test_ppc_era_and_other_dates_are_not_conflated(self):
        self.assertEqual(self.parsers.parse_date('令和8年10月7日'),'2026-10-07')
        self.assertEqual(self.parsers.parse_date('令和８年10月７日'),'2026-10-07')
        self.assertIsNone(self.parsers.parse_date('令和0年10月7日'))
        self.assertIsNone(self.parsers.parse_date('2026-02-30'))

    def test_ppc_explicit_publication_date_in_title_wins_over_added_notice_date(self):
        html='''<html><head><title>漏えい対応の公表（令和８年10月７日） ｜個人情報保護委員会</title></head>
        <body><h1 class="page-ttl">漏えい対応の公表</h1><main class="l-main">
        令和８年10月７日 個人情報保護委員会 公表資料 ※令和８年10月９日追加
        <a href="/news/press/2026/example.pdf">説明資料</a>
        </main></body></html>'''
        item=self.parsers.extract('ppc',html,'https://www.ppc.go.jp/news/press/2026/example/')
        self.assertEqual(item['published_date'],'2026-10-07')
        self.assertIn({'meaning':'published_title','locator':'document_title','value':'令和８年10月７日'},item['metadata']['date_observations'])
        self.assertEqual([o['value'] for o in item['metadata']['date_observations'] if o['meaning']=='notice_date_candidate'],['令和８年10月７日','令和８年10月９日'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])

    def test_ppc_unread_pdf_is_not_marked_ai_ready_by_collector(self):
        listing='https://www.ppc.go.jp/news/press/'
        listing_html='<main><ul class="news-list"><li><div class="news-text"><a href="/news/press/2026/example">Advisory</a></div></li></ul></main>'
        article='''<html><head><title>公表（令和８年10月７日） ｜個人情報保護委員会</title></head>
        <body><h1 class="page-ttl">大規模な漏えいへの注意喚起</h1><main class="l-main">
        令和８年10月７日 公表資料 <a href="/assets/advisory.pdf">説明資料</a>
        </main></body></html>'''
        class Client:
            def get(self,url):
                return (listing_html.encode(),listing,'text/html') if url==listing else (article.encode(),url,'text/html')
        class Store:
            def resume(self,*args): return None
            def ingest(self,cfg,url,item): self.item=item; return {'item_created':True,'content_changed':False}
        config={'source':'ppc','enabled':True,'listing':listing,'hosts':['www.ppc.go.jp'],
                'permissions':{'collect':True,'store':True,'ai':True}}
        store=Store()
        self.core.collect(config,Client(),store,'2026-10-01','2026-10-31')
        self.assertEqual(store.item['published_date'],'2026-10-07')
        self.assertTrue(store.item['metadata']['requires_review'])
        self.assertFalse(store.item['metadata']['ai_ready'])

    def test_ppc_opening_datelines_set_publication_date_and_ai_ready_on_recollection(self):
        listing='https://www.ppc.go.jp/news/press/'
        articles=[
            ('https://www.ppc.go.jp/news/press/2026/260601', 'Poster contest',
             '<title>Poster contest</title><h1 class="page-ttl">Poster contest</h1><main class="l-main"><div class="l-article"><p>令和８年6月１日</p><p>個人情報保護委員会</p><p>報道発表資料を掲載します。</p></div></main>', '2026-06-01'),
            ('https://www.ppc.go.jp/news/press/2026/26%20622', 'Privacy awareness week',
             '<title>Privacy awareness week</title><h1 class="page-ttl">Privacy awareness week</h1><main class="l-main"><div class="l-article"><p>令和８年６月22日</p><p>個人情報保護委員会</p><p>６月22日に報道発表を行いました。</p><a href="/news/privacy_awareness_week/">週間の案内</a></div></main>', '2026-06-22'),
        ]
        for url,title,article,published in articles:
            listing_html=f'<main><ul class="news-list"><li><div class="news-text"><a href="{url}">{title}</a></div></li></ul></main>'
            class Client:
                def get(self, requested):
                    return (listing_html.encode(),listing,'text/html') if requested==listing else (article.encode(),url,'text/html')
            class Store:
                def resume(self,*args): return None
                def ingest(self,cfg,canonical,item): self.item=item; return {'item_created':True,'content_changed':False}
            config={'source':'ppc','enabled':True,'listing':listing,'hosts':['www.ppc.go.jp'],
                    'permissions':{'collect':True,'store':True,'ai':True}}
            store=Store()
            self.core.collect(config,Client(),store,'2026-06-01','2026-06-30')
            self.assertEqual(store.item['published_date'],published)
            self.assertFalse(store.item['metadata']['ai_ready'])
            self.assertTrue(store.item['metadata']['requires_review'])
            out_of_range_store=Store()
            result=self.core.collect(config,Client(),out_of_range_store,'2026-10-16','2026-10-26')
            self.assertEqual(result['out_of_range'],1)
            self.assertFalse(hasattr(out_of_range_store,'item'))

    def test_empty_dynamic_and_bad_pdf_are_failures(self):
        with self.assertRaises(ValueError): self.parsers.extract('pdpc','<h1>A</h1><main></main>','https://www.pdpc.gov.sg/a')
        with self.assertRaises(ValueError): self.parsers.extract_pdf(b'bad pdf','https://curia.europa.eu/a.pdf')

    def test_ftc_rss_is_discovery_not_body(self):
        rows,next_page=self.parsers.discover('ftc','<rss><channel><item><title>A</title><link>https://www.ftc.gov/a</link><description>Short text</description></item></channel></rss>','https://www.ftc.gov/feed')
        self.assertEqual(rows[0]['url'],'https://www.ftc.gov/a'); self.assertNotIn('content_text',rows[0]); self.assertIsNone(next_page)

    def test_ftc_pubdate_requires_one_explicit_timezone_and_uses_korea_date(self):
        rss='<rss><channel><item><title>A</title><link>https://www.ftc.gov/a</link><pubDate>Mon, 19 Oct 2026 00:00:00 +0900</pubDate></item></channel></rss>'
        rows,_=self.parsers.discover('ftc',rss,'https://www.ftc.gov/feed')
        self.assertEqual(self.parsers.ftc_listing_date(rows[0]),'2026-10-19')
        self.assertEqual(rows[0]['date_observations'],[{
            'meaning':'listing_published_rfc822','locator':'rss item pubDate',
            'value':'Mon, 19 Oct 2026 00:00:00 +0900'}])
        for pubdate in ('19 Oct 2026 00:00:00','not a date'):
            bad=f'<rss><channel><item><title>A</title><link>https://www.ftc.gov/a</link><pubDate>{pubdate}</pubDate></item></channel></rss>'
            parsed,_=self.parsers.discover('ftc',bad,'https://www.ftc.gov/feed')
            self.assertIsNone(self.parsers.ftc_listing_date(parsed[0]))
        conflict='<rss><channel><item><title>A</title><link>https://www.ftc.gov/a</link><pubDate>Mon, 19 Oct 2026 00:00:00 +0000</pubDate><pubDate>Tue, 20 Oct 2026 00:00:00 +0000</pubDate></item></channel></rss>'
        parsed,_=self.parsers.discover('ftc',conflict,'https://www.ftc.gov/feed')
        self.assertIsNone(self.parsers.ftc_listing_date(parsed[0]))
        self.assertEqual(len(parsed[0]['date_observations']),2)

    def test_ftc_body_and_pubdate_conflict_remains_unconfirmed(self):
        row={'title':'Privacy action','date_observations':[{
            'meaning':'listing_published_rfc822','locator':'rss item pubDate',
            'value':'Mon, 19 Oct 2026 00:00:00 +0000'}]}
        html='<h1>Privacy action</h1><article class="node--view-mode-banner"><time datetime="2026-10-20">20 October 2026</time></article><main><article class="node--view-mode-full"><div class="field--name-body"><p>Complete official privacy action statement.</p></div></article></main>'
        item=self.parsers.extract_document('ftc',html.encode(),'https://www.ftc.gov/a','text/html',row)
        self.assertIsNone(item['published_date'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertEqual(len(item['metadata']['date_observations']),3)

    def test_pdpc_json_listing_pagination_preserves_api_parameters(self):
        rows,next_page=self.parsers.discover_pdpc_listing(
            b'{"totalItems":11,"data":[' + b','.join(
                (b'{"href":"/media-events/a","title":"A","date":"2026-10-20"}' if i==0 else
                 b'{"href":"/media-events/item%d","title":"Item %d","date":"2026-10-20"}'%(i,i))
                for i in range(10)) + b']}',
            'https://www.pdpc.gov.sg/api/listing-api?itemsperpage=10&listingtype=media_events&pathname=%2Fmedia-events',1)
        self.assertEqual(len(rows),10)
        self.assertEqual(rows[0]['url'],'https://www.pdpc.gov.sg/media-events/a')
        self.assertIn('itemsperpage=10',next_page)
        self.assertIn('listingtype=media_events',next_page)
        self.assertIn('pathname=%2Fmedia-events',next_page)
        self.assertIn('page=2',next_page)

    def test_pdpc_api_pagination_rejects_changed_scope(self):
        with self.assertRaisesRegex(ValueError,'pdpc_listing_query_changed'):
            self.parsers.pdpc_api_page_number('https://www.pdpc.gov.sg/api/listing-api?itemsperpage=100&listingtype=media_events&pathname=%2Fmedia-events')

    def test_pdpc_external_listing_link_is_skipped_and_coverage_stays_partial(self):
        import json
        from urllib.parse import urlencode
        from unittest.mock import patch
        cfg={'source':'pdpc','enabled':True,'permissions':dict(collect=True,store=True,ai=True),
             'listing':'https://www.pdpc.gov.sg/api/listing-api?'+urlencode({'itemsperpage':10,'listingtype':'media_events','pathname':'/media-events'}),
             'hosts':['www.pdpc.gov.sg'],'source_id':'x'}
        rows=[{'href':f'/media-events/item{i}','title':f'Item {i}','date':'2026-10-03'} for i in range(10)]
        rows[7]['href']='https://www.mddi.gov.sg/newsroom/speech'
        body=json.dumps({'totalItems':10,'data':rows}).encode()
        class Client:
            calls=[]
            def get(this,url):
                this.calls.append(url)
                if url==cfg['listing']: return body,url,'text/plain'
                if 'www.pdpc.gov.sg' not in url: raise AssertionError('unapproved hosts must not be fetched')
                return b'<html/>',url,'text/html'
        class Store:
            def resume(this,*args): return None
            def checkpoint(this,*args): raise AssertionError('incomplete listing cannot checkpoint')
            def ingest(this,*args): return {'item_created':True,'content_changed':False}
        client=Client()
        parsed={'published_date':'2026-10-03','content_text':'Body','metadata':{'relevance_reason':'test','ai_ready':True}}
        with patch.object(self.core.parsers,'extract_document',return_value=parsed):
            result=self.core.collect(cfg,client,Store(),'2026-10-01','2026-10-01')
        self.assertEqual(result['excluded_unapproved_host_count'],1)
        self.assertEqual(result['status'],'partial')
        self.assertFalse(result['coverage_complete'])
        self.assertEqual(result['reason'],'unapproved_external_listing_links')
        self.assertEqual(len(client.calls),10)

    def test_next_page_only_uses_real_link(self):
        rows,next_page=self.parsers.discover('edpb','<main><a href="/news/a_en">A</a><a rel="next" href="/news_en?page=1">Next</a></main>','https://www.edpb.europa.eu/news_en')
        self.assertEqual(next_page,'https://www.edpb.europa.eu/news_en?page=1'); self.assertEqual(len(rows),1)

    def test_terms_and_cost_gate_stops_before_fetch(self):
        cfg={'source':'edpb','enabled':False}
        result=self.core.collect(cfg,None,None,'2026-10-01','2026-10-13')
        self.assertEqual(result['status'],'held'); self.assertFalse(result['coverage_complete'])

    def test_retry_after_is_bounded_and_invalid_is_safe(self):
        self.assertEqual(self.core.retry_delay('99999'),60)
        self.assertEqual(self.core.retry_delay('garbage'),2)

    def test_proxy_policy_denial_is_distinct_from_site_http_denial(self):
        import urllib.error
        from unittest.mock import patch
        client=self.core.HttpClient(['www.ftc.gov'],interval=0)
        with patch.object(client.opener,'open',side_effect=urllib.error.URLError(OSError('Tunnel connection failed: 403 Forbidden'))):
            with self.assertRaisesRegex(self.core.FetchError,'^network_policy_denied_403$'):
                client.request('https://www.ftc.gov/robots.txt')
        with patch.object(client.opener,'open',side_effect=urllib.error.HTTPError('https://www.ftc.gov/a',403,'Forbidden',{},None)):
            with self.assertRaisesRegex(self.core.FetchError,'^http_403$'):
                client.request('https://www.ftc.gov/a')

    def test_timeout_retries_twice_before_returning_content(self):
        from io import BytesIO
        from unittest.mock import patch
        client=self.core.HttpClient(['www.ftc.gov'],interval=0)
        class Headers(dict):
            def get_content_type(self): return 'text/html'
        class Response(BytesIO):
            headers=Headers({'Content-Length':'2'})
            url='https://www.ftc.gov/a'
        response=Response(b'ok')
        with patch.object(client.opener,'open',side_effect=[TimeoutError(),response]) as opened, patch.object(self.core.time,'sleep'):
            data,final,ctype=client.request('https://www.ftc.gov/a')
        self.assertEqual((data,final,ctype),(b'ok','https://www.ftc.gov/a','text/html'))
        self.assertEqual(opened.call_count,2)

    def test_robots_access_failure_is_reported_at_robots_boundary(self):
        from unittest.mock import patch
        client=self.core.HttpClient(['www.ftc.gov'],interval=0)
        with patch.object(client,'request',side_effect=self.core.FetchError('http_403')):
            with self.assertRaisesRegex(self.core.FetchError,'^robots_fetch_failed:http_403$'):
                client.check_robots('https://www.ftc.gov/news')

    def test_size_limit_streaming_and_429_distinct(self):
        import io
        with self.assertRaises(self.core.FetchError): self.core.read_limited(io.BytesIO(b'123456'),5)
        self.assertEqual(self.core.read_limited(io.BytesIO(b'1234'),5),b'1234')

    def test_checkpoint_not_advanced_on_empty_listing_or_network_failure(self):
        cfg={'source':'edpb','enabled':True,'permissions':{'collect':True,'store':True,'ai':True},'listing':'https://www.edpb.europa.eu/news_en','hosts':['www.edpb.europa.eu'],'source_id':'x'}
        class Client:
            def get(self,url): return b'<main>empty</main>',url,'text/html'
        class Store:
            checkpointed=False
            def checkpoint(self,*args): self.checkpointed=True
        st=Store(); result=self.core.collect(cfg,Client(),st,'2026-10-01','2026-10-13')
        self.assertEqual(result['status'],'failed'); self.assertFalse(st.checkpointed)

    def test_paginated_scan_does_not_prove_period_coverage(self):
        from unittest.mock import patch
        cfg={'source':'edpb','enabled':True,'permissions':dict(collect=True,store=True,ai=True),
             'listing':'https://www.edpb.europa.eu/news_en','hosts':['www.edpb.europa.eu']}
        first=cfg['listing']; second=first+'?page=1'
        class Client:
            def get(self,url): return b'<html>article</html>',url,'text/html'
        class Store:
            checkpointed=False
            def ingest(self,*args): return {'item_created':True}
            def progress(self,*args): pass
            def checkpoint(self,*args): self.checkpointed=True
        rows=[
            ([{'url':'https://www.edpb.europa.eu/news/a_en','title':'A'}],second),
            ([{'url':'https://www.edpb.europa.eu/news/b_en','title':'B'}],None)]
        article={'published_date':'2026-10-07','metadata':{'requires_review':False}}
        store=Store()
        with patch.object(self.core,'fetch_listing',side_effect=rows), \
             patch.object(self.parsers,'extract_document',return_value=article):
            result=self.core.collect(cfg,Client(),store,'2026-10-01','2026-10-13')
        self.assertEqual(result['pages'],2)
        self.assertFalse(result['coverage_complete'])
        self.assertFalse(store.checkpointed)

    def test_database_storage_stop_does_not_attempt_another_write(self):
        cfg={'source':'edpb','enabled':True,'permissions':dict(collect=True,store=True,ai=True),'listing':'https://www.edpb.europa.eu/news_en','hosts':['www.edpb.europa.eu'],'source_id':'x'}
        class Client:
            def get(self,url):
                h='<main><a href="/news/a_en">A</a></main>' if url.endswith('news_en') else '<h2 class="node-article-full__title">A</h2><div class="node-article-full__body">Personal data policy statement.</div>'
                return h.encode(),url,'text/html'
        class Store:
            failures=0
            def ingest(this,*args): raise self.core.FetchError('database_storage_cap')
            def discovery_failure(this,*args): this.failures+=1
        st=Store();result=self.core.collect(cfg,Client(),st,'2026-10-01','2026-10-13')
        self.assertEqual(st.failures,0);self.assertEqual(result['status'],'failed')

    def test_page_limit_is_resumable_without_advancing_checkpoint(self):
        cfg={'source':'edpb','enabled':True,'permissions':dict(collect=True,store=True,ai=True),'listing':'https://www.edpb.europa.eu/news_en','hosts':['www.edpb.europa.eu'],'source_id':'x'}
        class Client:
            def get(this,url):
                h='<main><a href="/news/a_en">A</a><a rel="next" href="/news_en?page=1">Next</a></main>' if url.endswith('news_en') else '<h2 class="node-article-full__title">A</h2><time class="node-article-full__date">7 October 2026</time><div class="node-article-full__body">Personal data policy statement.</div>'
                return h.encode(),url,'text/html'
        class Store:
            cursor=None
            def progress(this,cfg,since,until,cursor): this.cursor=cursor
            def ingest(this,*args): return {'item_created':True}
            def checkpoint(this,*args): raise AssertionError('incomplete scope checkpointed')
        store=Store()
        result=self.core.collect(cfg,Client(),store,'2026-10-01','2026-10-13',max_pages=1)
        self.assertEqual(result['status'],'partial')
        self.assertEqual(result['reason'],'page_limit')
        self.assertEqual(store.cursor['page'],'https://www.edpb.europa.eu/news_en?page=1')

    def test_backfill_resumes_at_next_item_after_document_limit(self):
        cfg={'source':'edpb','enabled':True,'permissions':dict(collect=True,store=True,ai=True),'listing':'https://www.edpb.europa.eu/news_en','hosts':['www.edpb.europa.eu'],'source_id':'x'}
        class Client:
            fetched=[]
            def get(this,url):
                if url.endswith('news_en'): h='<main><a href="/news/a_en">A</a><a href="/news/b_en">B</a></main>'
                else:
                    this.fetched.append(url); h='<h2 class="node-article-full__title">A</h2><div class="node-article-full__body">Personal data policy statement.</div>'
                return h.encode(),url,'text/html'
        class Store:
            cursor=None
            def resume(this,*args): return this.cursor
            def progress(this,cfg,since,until,cursor): this.cursor=cursor
            def ingest(this,*args): return {'item_created':True}
            def discovery_failure(this,*args): pass
            def checkpoint(this,*args): pass
        st=Store();cl=Client()
        first=self.core.collect(cfg,cl,st,'2026-10-01','2026-10-13',max_items=1)
        self.assertEqual(first['status'],'partial')
        self.assertEqual(first['reason'],'document_limit')
        self.assertFalse(first['coverage_complete'])
        self.core.collect(cfg,cl,st,'2026-10-01','2026-10-13',max_items=1)
        self.assertEqual(cl.fetched,['https://www.edpb.europa.eu/news/a_en','https://www.edpb.europa.eu/news/b_en'])

if __name__=='__main__': unittest.main()
