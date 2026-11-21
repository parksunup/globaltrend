import json
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.collector import expansion
from scripts.collector.cloud_step import prepare
from scripts.collector.core import HttpClient

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'tests/fixtures/collector-expansion'

class ExpandedCloudResumeTests(unittest.TestCase):
    def config(self, slug):
        return next(c for c in json.loads((ROOT/'config/trend-collector.json').read_text(encoding='utf-8'))['sources'] if c['source']==slug)

    def claim(self,slug):
        return dict(slug=slug,source_id=self.config(slug)['source_id'],since='2026-10-26',until='2026-10-28',cursor=None,lease_until='2099-01-01T00:00:00+00:00')

    def test_parliament_route_is_assigned_to_the_cloud_python_worker(self):
        from scripts.collector.cloud_worker import eligible_sources
        enabled={source['source'] for source in eligible_sources()}
        self.assertTrue({'ec','ec-news','eu-parliament'}<=enabled)

    def test_parliament_topic_screen_requires_privacy_or_personal_data_evidence(self):
        screen=expansion.eu_parliament_topic_screen
        self.assertEqual(screen('AI Act implementation and cybersecurity strategy')['status'],'excluded')
        self.assertEqual(screen('Digital identity and biometric innovation')['status'],'excluded')
        candidate=screen('AI surveillance and safeguards for personal data')
        self.assertEqual(candidate['status'],'candidate')
        self.assertIn('personal data',candidate['matched_terms'])
        self.assertEqual(screen('Protección de datos personales y privacidad')['status'],'candidate')

    def test_parliament_collector_does_not_ingest_broad_digital_policy_items(self):
        from scripts.collector import extraction
        url='https://data.europarl.europa.eu/api/v2/documents/2026-002'
        row={'url':url,'date_observations':[{'meaning':'listing_updated_not_publication_date',
              'value':'2026-11-18T10:00:00Z'}]}
        class Store:
            def __init__(self):self.cursor=None;self.items=[]
            def resume(self,*args):return None
            def progress(self,config,since,until,cursor):self.cursor=cursor
            def checkpoint(self,*args):pass
            def ingest(self,config,item_url,item):self.items.append((item_url,item))
            def discovery_failure(self,*args):raise AssertionError(args)
        store=Store();config={'source':'eu-parliament','listing':expansion.ROUTES['eu-parliament']['listing']}
        item={'published_date':'2026-11-18','metadata':{},'title_original':'AI Act implementation',
              'content_text':'A cybersecurity and digital identity strategy.', 'content_hash':'irrelevant'}
        with patch('scripts.collector.core.fetch_listing',return_value=([row],None)), \
             patch('scripts.collector.expansion.verify_detail_response'), \
             patch.object(extraction,'extract_document',return_value=item):
            result=expansion.collect_frozen(config,
                type('Client',(),{'get':lambda *_,**__:(b'{}',url,'application/ld+json')})(),
                store,'2026-11-18','2026-11-20')
        self.assertEqual(store.items,[])
        self.assertEqual(result['topic_excluded'],1)

    def test_parliament_collector_records_explicit_privacy_candidate_for_review(self):
        from scripts.collector import extraction
        url='https://data.europarl.europa.eu/api/v2/documents/2026-003'
        row={'url':url,'date_observations':[{'meaning':'listing_updated_not_publication_date',
              'value':'2026-11-18T10:00:00Z'}]}
        class Store:
            def __init__(self):self.cursor=None;self.items=[]
            def resume(self,*args):return None
            def progress(self,config,since,until,cursor):self.cursor=cursor
            def checkpoint(self,*args):pass
            def ingest(self,config,item_url,item):self.items.append((item_url,item))
            def discovery_failure(self,*args):raise AssertionError(args)
        store=Store();config={'source':'eu-parliament','listing':expansion.ROUTES['eu-parliament']['listing']}
        item={'published_date':'2026-11-18','metadata':{'ai_ready':False},
              'title_original':'Personal data protection in cross-border services',
              'content_text':'The amendment adds safeguards for personal data and privacy.',
              'content_hash':'privacy-candidate'}
        with patch('scripts.collector.core.fetch_listing',return_value=([row],None)), \
             patch('scripts.collector.expansion.verify_detail_response'), \
             patch.object(extraction,'extract_document',return_value=item):
            result=expansion.collect_frozen(config,
                type('Client',(),{'get':lambda *_,**__:(b'{}',url,'application/ld+json')})(),
                store,'2026-11-18','2026-11-20')
        self.assertEqual(result.get('topic_excluded',0),0)
        self.assertEqual(len(store.items),1)
        metadata=store.items[0][1]['metadata']
        self.assertEqual(metadata['topic_screen']['status'],'candidate')
        self.assertEqual(metadata['relevance_reason'],
                         'eu_parliament_privacy_candidate_requires_editorial_review')

    def test_parliament_atom_feed_selects_the_api_document_link(self):
        xml='''<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
          <entry><id>https://data.europarl.europa.eu/api/v2/documents/2026-001</id>
            <title>Privacy safeguards in digital services</title><updated>2026-10-28T10:00:00Z</updated>
            <link rel="self" href="https://data.europarl.europa.eu/api/v2/documents/2026-001"/>
            <link rel="alternate" href="https://www.europarl.europa.eu/news/en/press-room/20261028IPR00001/"/>
          </entry></feed>'''
        from scripts.collector.core import fetch_listing
        rows,nxt=fetch_listing('eu-parliament',type('Client',(),{
            'get':lambda self,url:(xml.encode(),url,'application/atom+xml')})(),
            expansion.ROUTES['eu-parliament']['listing']+'?format=application%2Fatom%2Bxml')
        self.assertEqual(nxt,None)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'],'https://data.europarl.europa.eu/api/v2/documents/2026-001')
        self.assertEqual(rows[0]['date_observations'][0]['meaning'],'listing_updated_not_publication_date')

    def test_commission_news_rss_article_route_uses_observed_date_and_url_shape(self):
        from scripts.collector.core import fetch_listing
        xml='''<?xml version="1.0"?><rss version="2.0"><channel><item>
          <title>EU and Kenya advance towards data adequacy arrangement</title>
          <link>https://commission.europa.eu/news-and-media/news/joint-press-statement-michael-mcgrath-commissioner-democracy-justice-rule-law-and-consumer-2026-11-16_en</link>
          <pubDate>Mon, 16 Nov 2026 00:00:00 +0100</pubDate>
          <description>Safe data flows and stronger digital trade.</description>
        </item></channel></rss>'''
        rows,nxt=fetch_listing('ec-news',type('Client',(),{
            'get':lambda self,url:(xml.encode(),url,'application/rss+xml')})(),
            self.config('ec-news')['listing'])
        self.assertIsNone(nxt)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'].rsplit('/',1)[-1],
            'joint-press-statement-michael-mcgrath-commissioner-democracy-justice-rule-law-and-consumer-2026-11-16_en')
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-16')

    def test_commission_feeds_skip_off_route_syndicated_and_non_english_entries(self):
        from scripts.collector.core import fetch_listing
        ec_xml='''<?xml version="1.0"?><rss version="2.0"><channel>
          <item><title>English privacy statement</title>
            <link>https://ec.europa.eu/commission/presscorner/detail/en/statement_26_2057</link>
            <pubDate>Mon, 16 Nov 2026 12:00:00 GMT</pubDate></item>
          <item><title>Portuguese speech</title>
            <link>https://ec.europa.eu/commission/presscorner/detail/pt/speech_26_2462</link>
            <pubDate>Mon, 16 Nov 2026 15:17:37 GMT</pubDate></item>
        </channel></rss>'''
        client=lambda xml:type('Client',(),{
            'get':lambda self,url:(xml.encode(),url,'application/rss+xml')})()
        ec_rows,_=fetch_listing('ec',client(ec_xml),self.config('ec')['listing'])
        self.assertEqual([row['url'] for row in ec_rows],[
            'https://ec.europa.eu/commission/presscorner/detail/en/statement_26_2057'
        ])

        news_xml='''<?xml version="1.0"?><rss version="2.0"><channel>
          <item><title>Commission privacy news</title>
            <link>https://commission.europa.eu/news-and-media/news/example-privacy-news-2026-11-16_en</link>
            <pubDate>Mon, 16 Nov 2026 00:00:00 +0100</pubDate></item>
          <item><title>Related Press Corner item</title>
            <link>https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2361</link>
            <pubDate>Mon, 16 Nov 2026 12:00:00 GMT</pubDate></item>
        </channel></rss>'''
        news_rows,_=fetch_listing('ec-news',client(news_xml),self.config('ec-news')['listing'])
        self.assertEqual([row['url'] for row in news_rows],[
            'https://commission.europa.eu/news-and-media/news/example-privacy-news-2026-11-16_en'
        ])

    def test_commission_news_detail_requires_real_body_and_reconciles_feed_date(self):
        url='https://commission.europa.eu/news-and-media/news/joint-press-statement-michael-mcgrath-commissioner-democracy-justice-rule-law-and-consumer-2026-11-16_en'
        row={'url':url,'title':'EU data adequacy statement','date_observations':[
            {'meaning':'expansion_feed_publication_rfc822','locator':'RSS pubDate','value':'Mon, 16 Nov 2026 00:00:00 +0100'}]}
        html='''<html><head><meta property="article:published_time" content="2026-11-16T00:00:00+01:00"></head>
          <main><h1>EU and Kenya data adequacy arrangement</h1><article><div class="field--name-body">
          <p>Full official article text describing the agreement and safeguards for cross-border personal data flows.</p>
          </div></article></main></html>'''
        item=expansion.extract('ec-news',html,url,row)
        self.assertEqual(item['published_date'],'2026-11-16')
        self.assertTrue(item['metadata']['ai_ready'])
        self.assertIn('Full official article text',item['content_text'])

    def test_parliament_full_text_without_exact_publication_date_is_held(self):
        body='Substantive official document text about privacy and safeguards. '*3
        data={'data':{'id':'https://data.europarl.europa.eu/api/v2/documents/2026-001',
            'title':'Privacy safeguards','description':body}}
        item=expansion.extract('eu-parliament',json.dumps(data),
            'https://data.europarl.europa.eu/api/v2/documents/2026-001')
        self.assertIsNone(item['published_date'])
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertEqual(item['metadata']['license'],'CC BY 4.0')
        self.assertTrue(item['metadata']['attribution_required'])

    def test_parliament_api_jsonld_uses_actual_title_and_publication_date_fields(self):
        data={'@context':[{'@base':'https://data.europarl.europa.eu/'},
                          'https://data.europarl.europa.eu/api/v2/context.jsonld'],
            'data':[{'id':'eli/dl/doc/2026-001','title_dcterms':{'en':'Privacy safeguards'},
                'document_date':'2026-11-12','description':'Official document text about privacy safeguards and data protection.'}]}
        item=expansion.extract('eu-parliament',json.dumps(data),
            'https://data.europarl.europa.eu/api/v2/documents/2026-001')
        self.assertEqual(item['title_original'],'Privacy safeguards')
        self.assertEqual(item['published_date'],'2026-11-12')
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertTrue(item['metadata']['requires_review'])

    def test_parliament_linked_pdf_resolves_only_declared_official_jsonld_base(self):
        from scripts.collector import extraction
        from scripts.collector.core import FetchError
        data={'@context':[{'@base':'https://data.europarl.europa.eu/'},
                          'https://data.europarl.europa.eu/api/v2/context.jsonld'],
            'data':[{'id':'eli/dl/doc/2026-001','title_dcterms':{'en':'Privacy safeguards'},
                'is_realized_by':[{'is_embodied_by':[{'is_exemplified_by':
                    'distribution/records/2026-001_en.pdf'}]}]}]}
        class Client:
            def __init__(self):self.requested=None
            def get(self,url):
                self.requested=url
                raise FetchError('http_404')
        client=Client()
        with self.assertRaisesRegex(ValueError,'eu_parliament_manifestation_unavailable'):
            extraction.extract_eu_parliament_linked_pdf(json.dumps(data),
                'https://data.europarl.europa.eu/api/v2/documents/2026-001',{},client)
        self.assertEqual(client.requested,
            'https://data.europarl.europa.eu/distribution/records/2026-001_en.pdf')
        self.assertIn('redmapl3.europarl.europa.eu',
                      expansion.ROUTES['eu-parliament']['hosts'])

    def test_parliament_pdf_cover_date_is_used_only_after_matching_document_id(self):
        from scripts.collector import extraction
        from unittest.mock import patch
        data={'@context':[{'@base':'https://data.europarl.europa.eu/'},
                          'https://data.europarl.europa.eu/api/v2/context.jsonld'],
            'data':[{'id':'eli/dl/doc/A-10-2026-0278','title_dcterms':{'en':'Privacy safeguards'},
                'is_realized_by':[{'is_embodied_by':[{'is_exemplified_by':
                    'distribution/records/A-10-2026-0278_en.pdf'}]}]}]}
        class Client:
            def get(self,url):
                self.requested=url
                return b'%PDF-1.7 sample','https://redmapl3.europarl.europa.eu/distribution/records/A-10-2026-0278_en.pdf','application/pdf'
        parsed={'pages':[{'text':'A10-0278/2026\n21.10.2026\nREPORT\n'+'Official text. '*30}],
                'ocr_pages':[],'related_documents':[],'extraction_method':'pymupdf'}
        with patch('scripts.collector.parsers.extract_pdf',return_value=parsed):
            item=extraction.extract_eu_parliament_linked_pdf(json.dumps(data),
                'https://data.europarl.europa.eu/api/v2/documents/A-10-2026-0278',{},Client())
        self.assertEqual(item['published_date'],'2026-10-21')
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertEqual(item['metadata']['pdf_page_count'],1)
        self.assertNotIn('pdf_pages',item['metadata'])
        self.assertEqual(item['metadata']['date_observations'][-2]['locator'],
                         'European Parliament PDF cover date following the matching document identifier')

    def test_parliament_api_and_cover_date_conflict_is_held(self):
        from scripts.collector import extraction
        from unittest.mock import patch
        data={'@context':[{'@base':'https://data.europarl.europa.eu/'},
                          'https://data.europarl.europa.eu/api/v2/context.jsonld'],
            'data':[{'id':'eli/dl/doc/A-10-2026-0278','title_dcterms':{'en':'Privacy safeguards'},
                'document_date':'2026-10-20','is_realized_by':[{'is_embodied_by':[{'is_exemplified_by':
                    'distribution/records/A-10-2026-0278_en.pdf'}]}]}]}
        class Client:
            def get(self,url):
                return b'%PDF-1.7 sample','https://redmapl3.europarl.europa.eu/distribution/records/A-10-2026-0278_en.pdf','application/pdf'
        parsed={'pages':[{'text':'A10-0278/2026\n21.10.2026\nREPORT\n'+'Official text. '*30}],
                'ocr_pages':[],'related_documents':[],'extraction_method':'pymupdf'}
        with patch('scripts.collector.parsers.extract_pdf',return_value=parsed):
            item=extraction.extract_eu_parliament_linked_pdf(json.dumps(data),
                'https://data.europarl.europa.eu/api/v2/documents/A-10-2026-0278',{},Client())
        self.assertIsNone(item['published_date'])
        self.assertTrue(item['metadata']['date_conflict'])
        self.assertFalse(item['metadata']['ai_ready'])

    def test_parliament_detail_negotiates_jsonld(self):
        self.assertEqual(expansion.detail_request_headers('eu-parliament'),
                         {'Accept':'application/ld+json'})
        self.assertIsNone(expansion.detail_request_headers('ec'))

    def test_frozen_listing_keeps_date_observations_for_detail_extraction(self):
        from scripts.collector import extraction
        url='https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2026/communique-g7-260626/'
        row={'url':url,'title':'G7 data protection communiqué','date_observations':[
            {'meaning':'official_published_attribute','locator':'time','value':'2026-07-08'}]}
        class Store:
            def __init__(self):self.cursor=None;self.items=[]
            def resume(self,*args):return None
            def progress(self,config,since,until,cursor):self.cursor=cursor
            def checkpoint(self,*args):pass
            def ingest(self,config,item_url,item):self.items.append((item_url,item))
            def discovery_failure(self,*args):self.fail(args)
        store=Store();config={'source':'g7-dpa','listing':expansion.ROUTES['g7-dpa']['listing']}
        item={'published_date':'2026-07-08','metadata':{},'title_original':'G7 communiqué','content_text':'Official text','content_hash':'hash'}
        with patch('scripts.collector.core.fetch_listing',return_value=([row],None)), \
             patch('scripts.collector.expansion.verify_detail_response'), \
             patch.object(extraction,'extract_document',return_value=item) as extract:
            result=expansion.collect_frozen(config,type('Client',(),{'get':lambda *_:(b'<html/>',url,'text/html')})(),
                                            store,'2026-07-01','2026-07-31')
        self.assertEqual(result['status'],'complete')
        self.assertTrue(result['collection_complete'])
        self.assertFalse(result['coverage_complete'])
        self.assertEqual(extract.call_args.args[4],row)
        self.assertEqual(store.items[0][1]['published_date'],'2026-07-08')

    def test_ec_listing_is_explicitly_scoped_to_the_three_day_window(self):
        url=expansion.listing_request_url('ec',self.config('ec')['listing'],'2026-10-26','2026-10-28')
        from urllib.parse import urlsplit,parse_qs
        parsed=urlsplit(url);query=parse_qs(parsed.query)
        self.assertEqual(parsed.path,'/commission/presscorner/api/rss')
        self.assertEqual(query['language'],['en'])

    def test_parliament_api_detail_redirect_must_keep_document_identity(self):
        requested='https://data.europarl.europa.eu/api/v2/documents/2026-001'
        expected=expansion.detail_request_url('eu-parliament',requested)
        expansion.verify_detail_response('eu-parliament',requested,expected)
        with self.assertRaisesRegex(ValueError,'detail_redirect_identity_mismatch'):
            expansion.verify_detail_response('eu-parliament',requested,expected.replace('2026-001','2026-002'))

    def test_backlog_does_not_resolve_a_different_redirected_article(self):
        claim=self.claim('eu-parliament');target='https://data.europarl.europa.eu/api/v2/documents/2026-001'
        claim.update(backlog_id='synthetic-backlog',detail={'url':target,'title':'Original release'})
        class Client(HttpClient):
            def get(self,url,headers=None):return b'{"data":[]}',target.replace('2026-001','2026-002')+'?format=application%2Fld%2Bjson&language=en','application/ld+json'
        with patch('scripts.collector.cloud_step.validate_claim'), patch('scripts.collector.cloud_step.HttpClient',Client):bundle=prepare(claim)
        self.assertEqual(bundle['operations'],[])
        self.assertFalse(bundle['backlog_resolved'])
        self.assertEqual(bundle['result']['reason'],'detail_redirect_identity_mismatch')

if __name__=='__main__':unittest.main()
