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
        self.assertIsNone(self.parsers.parse_date('令和0年10月7日'))
        self.assertIsNone(self.parsers.parse_date('2026-02-30'))

    def test_empty_dynamic_and_bad_pdf_are_failures(self):
        with self.assertRaises(ValueError): self.parsers.extract('pdpc','<h1>A</h1><main></main>','https://www.pdpc.gov.sg/a')
        with self.assertRaises(ValueError): self.parsers.extract_pdf(b'bad pdf','https://curia.europa.eu/a.pdf')

    def test_ftc_rss_is_discovery_not_body(self):
        rows,next_page=self.parsers.discover('ftc','<rss><channel><item><title>A</title><link>https://www.ftc.gov/a</link><description>Short text</description></item></channel></rss>','https://www.ftc.gov/feed')
        self.assertEqual(rows[0]['url'],'https://www.ftc.gov/a'); self.assertNotIn('content_text',rows[0]); self.assertIsNone(next_page)

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
