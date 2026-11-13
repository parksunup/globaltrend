import json
import datetime as dt
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.collector import parsers, expansion
from scripts.collector.core import HttpClient, FetchError, fetch_listing
from scripts.collector.cloud_step import validate_claim

ROOT=Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests/fixtures/collector-expansion'

class ExpansionTests(unittest.TestCase):
    def test_global_cbpr_follows_official_wordpress_next_page(self):
        listing='''<main><article class="elementor-post">
          <h2 class="elementor-post__title"><a href="/sample-release/">Sample release</a></h2>
          <div class="elementor-post-date">November 1, 2026</div>
        </article><nav class="elementor-pagination">
          <a class="page-numbers next" href="/news/page/2/">Next »</a>
        </nav></main>'''
        rows,next_page=parsers.discover_listing('global-cbpr',listing,expansion.ROUTES['global-cbpr']['listing'],None)
        self.assertEqual(len(rows),1)
        self.assertEqual(next_page,'https://www.globalcbpr.org/news/page/2/')

    def test_edpb_listing_is_filtered_to_requested_publication_years(self):
        from urllib.parse import parse_qs,urlsplit
        single=expansion.listing_request_url('edpb','https://www.edpb.europa.eu/news_en','2026-10-16','2026-11-13')
        self.assertEqual(parse_qs(urlsplit(single).query),{'date':['2026']})
        page=expansion.listing_request_url('edpb','https://www.edpb.europa.eu/news_en?date=2025&page=2','2025-12-30','2026-01-03')
        self.assertEqual(parse_qs(urlsplit(page).query),{'date':['2025-2026'],'page':['2']})

    def test_curia_listing_uses_official_year_filter_and_all_results_mode(self):
        from urllib.parse import parse_qs,urlsplit
        scoped=expansion.listing_request_url('curia','https://curia.europa.eu/site/jcms/d2_5158/en/press-releases','2025-10-01','2025-10-31')
        params=parse_qs(urlsplit(scoped).query)
        self.assertEqual(params['year'],['2025'])
        self.assertEqual(params['PortalAction_d6_1000000371_pagerAll'],['true'])
        self.assertEqual(params['PortalAction_d6_1000000371_pageSize'],['500'])
        unbounded='https://curia.europa.eu/site/jcms/d2_5158/en/press-releases'
        self.assertEqual(expansion.listing_request_url('curia',unbounded,'2025-12-31','2026-01-02'),unbounded)

    def test_netherlands_ap_uses_official_rss_for_discovery_and_preserves_evidence(self):
        route=expansion.ROUTES['nl-ap']
        feed='''<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><item>
          <title>Handhavingsbeleid AP gepubliceerd</title>
          <link>https://autoriteitpersoonsgegevens.nl/actueel/handhavingsbeleid-ap-gepubliceerd</link>
          <description><![CDATA[De Autoriteit Persoonsgegevens heeft het handhavingsbeleid gepubliceerd.]]></description>
          <pubDate>Fri, 30 Oct 2026 00:07:29 +0100</pubDate>
        </item></channel></rss>'''
        def unexpected_fetch(*args,**kwargs):
            self.fail('RSS discovery must not fetch article detail')
        rows,next_page=parsers.discover_listing('nl-ap',feed,route['listing'],unexpected_fetch)
        self.assertIsNone(next_page)
        self.assertEqual(len(rows),1)
        row=rows[0]
        self.assertEqual(row['url'],'https://autoriteitpersoonsgegevens.nl/actueel/handhavingsbeleid-ap-gepubliceerd')
        self.assertEqual(row['rss_source'],'nl-ap')
        self.assertEqual(row['feed_text'],'De Autoriteit Persoonsgegevens heeft het handhavingsbeleid gepubliceerd.')
        self.assertEqual(row['feed_body_source'],'rss_content_or_description')
        self.assertEqual(row['date_observations'],[{
            'meaning':'listing_published_rfc822',
            'locator':'rss item pubDate',
            'value':'Fri, 30 Oct 2026 00:07:29 +0100',
            'raw':'Fri, 30 Oct 2026 00:07:29 +0100',
        }])

    def test_netherlands_ap_rejects_non_rss_listing_response_explicitly(self):
        route=expansion.ROUTES['nl-ap']
        with self.assertRaisesRegex(ValueError,'nl_ap_official_rss_expected'):
            expansion.discover('nl-ap','<html><main>not the official feed</main></html>',route['listing'])

    def test_ppc_accepts_only_the_same_article_with_canonical_trailing_slash(self):
        requested='https://www.ppc.go.jp/news/press/2026/261028_houdou'
        received=requested+'/'
        expansion.verify_detail_response('ppc',requested,received)
        with self.assertRaisesRegex(ValueError,'detail_redirect_identity_mismatch'):
            expansion.verify_detail_response('ppc',requested,requested.replace('261028','261027')+'/')

    def test_tc260_follows_observed_pagination_and_unknown_dates_never_shorten_a_scan(self):
        rows,nxt=expansion.discover('cn-tc260',(FIXTURES/'cn-tc260-listing.html').read_text(),expansion.ROUTES['cn-tc260']['listing'])
        self.assertEqual(nxt,'https://www.tc260.org.cn/tc260/tzgg/list_2.shtml')
        self.assertEqual(expansion.next_within_window('oaic',[{'url':'https://www.oaic.gov.au/news/media-centre/test','title':'unknown'}],'https://www.oaic.gov.au/news/media-centre?page=2','2026-10-24'),'https://www.oaic.gov.au/news/media-centre?page=2')

    def test_tc260_stops_after_a_fully_dated_newest_first_page_crosses_since(self):
        rows=[{'date_observations':[{'meaning':'expansion_listing_published','value':value}]}
              for value in ('2026-11-13','2026-10-13','2026-09-18','2026-09-15')]
        nxt='https://www.tc260.org.cn/tc260/tzgg/list_2.shtml'
        self.assertIsNone(expansion.next_within_window('cn-tc260',rows,nxt,'2026-10-01'))
        self.assertEqual(expansion.listing_date_boundary('cn-tc260',rows,'2026-10-01'),
                         {'kind':'official_listing_date_order_boundary','first_date':'2026-11-13',
                          'last_date':'2026-09-15','since':'2026-10-01','rows':4})

    def test_tc260_boundary_requires_every_card_date_and_newest_first_order(self):
        nxt='https://www.tc260.org.cn/tc260/tzgg/list_2.shtml'
        missing=[{'date_observations':[{'meaning':'expansion_listing_published','value':'2026-09-15'}]},
                 {'url':'https://www.tc260.org.cn/tc260/tzgg/item.shtml'}]
        unsorted=[{'date_observations':[{'meaning':'expansion_listing_published','value':value}]}
                  for value in ('2026-09-15','2026-11-13')]
        for rows in (missing,unsorted):
            self.assertEqual(expansion.next_within_window('cn-tc260',rows,nxt,'2026-10-01'),nxt)
            self.assertIsNone(expansion.listing_date_boundary('cn-tc260',rows,'2026-10-01'))
    def test_only_assigned_cloud_sources_and_matching_source_ids_are_claimable(self):
        configs=json.loads((ROOT/'config/trend-collector.json').read_text())['sources']
        for c in configs:
            if not c.get('expansion_phase'):continue
            claim={'slug':c['source'],'source_id':c['source_id'],'lease_until':(dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5)).isoformat()}
            if c.get('enabled') and c.get('executor')=='cloud-python':validate_claim(claim)
            else:
                with self.assertRaisesRegex(ValueError,'cloud_source_not_assigned'):validate_claim(claim)
    def test_nist_actual_config_passes_collect_gate_and_ingests_verified_detail(self):
        from scripts.collector.core import collect
        config=next(row for row in json.loads((ROOT/'config/trend-collector.json').read_text())['sources']
                   if row['source']=='nist')
        class Client:
            def get(self,url):
                if url==config['listing']:
                    return (FIXTURES/'nist-listing.html').read_bytes(),url,'text/html'
                return (FIXTURES/'nist-detail.html').read_bytes(),url,'text/html'
        class Store:
            def __init__(self): self.items=[];self.cursors=[];self.checkpoints=[]
            def resume(self,*args): return None
            def ingest(self,config,url,item): self.items.append((url,item))
            def progress(self,config,since,until,cursor): self.cursors.append(cursor)
            def checkpoint(self,config,until): self.checkpoints.append(until)
            def discovery_failure(self,*args): self.failures=args
        store=Store()
        result=collect(config,Client(),store,'2026-10-27','2026-10-29')
        self.assertNotEqual('held',result['status'],result['reason'])
        self.assertEqual(2,len(store.items))
        self.assertEqual(2,result['discovered'])
        self.assertEqual({'2026-10-29',None},{item['published_date'] for _,item in store.items})
        dated_item=next(item for _,item in store.items if item['published_date']=='2026-10-29')
        self.assertEqual('trafilatura',dated_item['metadata']['extraction_method'])
        self.assertTrue(dated_item['metadata']['requires_review'])
    def test_vietnam_policy_route_extracts_detail_date_and_keeps_topic_review(self):
        route=expansion.ROUTES['vn-gov']
        rows,nxt=parsers.discover_listing('vn-gov',(FIXTURES/'vn-gov-listing.html').read_text(),'https://en.baochinhphu.vn/policies.htm',None)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'],'https://en.baochinhphu.vn/new-policies-take-effect-in-viet-nam-in-november-2026-111261102100407268.htm')
        self.assertEqual(nxt,'https://en.baochinhphu.vn/timelinelist/11151/2.htm')
        manifest=json.loads((FIXTURES/'manifest.json').read_text())['vn-gov']
        from scripts.collector.extraction import extract_document
        item=extract_document('vn-gov',(FIXTURES/'vn-gov-detail.html').read_bytes(),manifest['url'],'text/html',rows[0])
        self.assertEqual(item['published_date'],'2026-11-02')
        self.assertIn('Decree No. 363/2026/ND-CP',item['content_text'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertIn('personal data protection',item['content_text'])
    def test_all_observed_routes_extract_official_body_and_publication_date(self):
        manifest=json.loads((FIXTURES/'manifest.json').read_text())
        for source,c in expansion.ROUTES.items():
            # These source routes have their own tested listing/PDF pipeline;
            # treating the listing row URL as an HTML article here would skip
            # the evidence-backed PDF attachment step.
            if source in ('jpdp-my','global-cbpr','iso-iec-sc27',
                          'iapp','fpf','gpa','noyb','freevacy','overview-legal',
                          'ico','hk-pcpd','g7-dpa','vn-gov','eu-council','nl-ap','ppc',
                          'calprivacy','cn-cac','ftc','ripd'):
                continue
            with self.subTest(source=source):
                ext='json' if source in ('ec','anpd-br') else 'xml' if c.get('feed') else 'html'
                rows,nxt=parsers.discover_listing(source,(FIXTURES/f'{source}-listing.{ext}').read_text(),c['listing'],None)
                self.assertTrue(rows)
                m=manifest[source]
                json_source=source in ('ec','anpd-br')
                item=parsers.extract_document(source,(FIXTURES/f'{source}-detail.{"json" if json_source else "html"}').read_bytes(),m['url'],'application/json' if json_source else 'text/html')
                self.assertEqual(item['published_date'],m['published_date'])
                self.assertGreater(len(item['content_text']),100)
                self.assertEqual(item['metadata']['ai_ready'],not item['metadata']['requires_review'])
    def test_robots_403_404_410_are_unavailable_but_server_failure_remains_blocked(self):
        for code in ('http_404','http_410'):
            c=HttpClient(['example.org'])
            with patch.object(c,'request',side_effect=FetchError(code)):
                self.assertEqual(c.check_robots('https://example.org/news'),'https://example.org/news')
        c=HttpClient(['example.org'])
        with patch.object(c,'request',side_effect=FetchError('http_403')):
            self.assertEqual(c.check_robots('https://example.org/news'),'https://example.org/news')
        self.assertEqual(c.robots_unavailable,[{'url':'https://example.org/robots.txt','reason':'http_403'}])
        for code in ('http_500','http_429'):
            with patch.object(HttpClient,'request',side_effect=FetchError(code)):
                with self.assertRaises(FetchError):HttpClient(['example.org']).check_robots('https://example.org/news')
    def test_ec_detail_reference_uses_official_api_and_matches_identity(self):
        url='https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2274'
        self.assertEqual(expansion.detail_request_url('ec',url),'https://ec.europa.eu/commission/presscorner/api/documents?language=en&reference=IP%2F26%2F2274')
        with self.assertRaises(ValueError):expansion.extract('ec',(FIXTURES/'ec-detail.json').read_text(),url.replace('2274','9999'))
        item=expansion.extract('ec',(FIXTURES/'ec-detail.json').read_text(),url)
        self.assertIn('Roxana Mînzatu',item['content_text'])
        self.assertIn('We can see from the findings',item['content_text'])
    def test_ec_accepts_observed_zero_based_response_page_and_keeps_event_date(self):
        data=json.loads((FIXTURES/'ec-listing.json').read_text())
        data['pageNumber']=0
        data['docuLanguageListResources'][0]['eventDate']='2026-10-28T09:00:00+02:00'
        rows,nxt=expansion.discover('ec',json.dumps(data),expansion.ROUTES['ec']['listing'])
        self.assertEqual(len(rows),data['totalNumber'])
        self.assertEqual(expansion.listing_date(rows[0]),'2026-10-28')
        data['pageNumber']=7
        with self.assertRaisesRegex(ValueError,'ec_listing_schema_or_page_changed'):
            expansion.discover('ec',json.dumps(data),expansion.ROUTES['ec']['listing'])

    def test_ec_accepts_live_statement_and_speech_reference_classes(self):
        for reference in ('STATEMENT/26/2431','SPEECH/26/2428'):
            payload={'totalNumber':1,'pageNumber':1,'pageSize':10,
                     'docuLanguageListResources':[{'refCode':reference,'title':'Official release','eventDate':'2026-11-13'}]}
            rows,next_page=expansion.discover('ec',json.dumps(payload),expansion.ROUTES['ec']['listing'])
            self.assertIsNone(next_page)
            self.assertEqual(rows[0]['url'],'https://ec.europa.eu/commission/presscorner/detail/en/'+reference.lower().replace('/','_'))
    def test_ca_opc_advice_to_parliament_is_an_approved_paginated_listing(self):
        route=expansion.ROUTES['ca-opc'];listing=route['additional_listings'][1]
        html='<main><section aria-label="Main content"><div class="entry"><time datetime="2026-11-02">November 2, 2026</time><h2><a href="/en/opc-actions-and-decisions/advice-to-parliament/2026/parl_261102/">Statement by the Privacy Commissioner of Canada on Bill C-22</a></h2></div><div class="entry"><time datetime="2026-10-07">October 7, 2026</time><h2><a href="/en/opc-actions-and-decisions/advice-to-parliament/2026/parl_261007/">Statement by the Privacy Commissioner of Canada on security screening</a></h2></div><ul><li class="next"><a rel="next" href="?o=d&amp;Page=2&amp;Filter=True">Next</a></li></ul></section></main>'
        rows,nxt=expansion.discover('ca-opc',html,listing)
        self.assertEqual(len(rows),2)
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-02')
        self.assertTrue(rows[0]['url'].endswith('/parl_261102/'))
        self.assertIn('Page=2',nxt)

    def test_ca_opc_includes_speeches_and_statements_listing(self):
        route=expansion.ROUTES['ca-opc']
        listing=route['additional_listings'][0]
        self.assertEqual(listing,'https://www.priv.gc.ca/en/opc-news/speeches-and-statements/?o=d&Page=1&Filter=True')
        html='<main><section aria-label="Main content"><div class="entry"><time datetime="2026-11-10">November 10, 2026</time><h2><a href="/en/opc-news/speeches-and-statements/2026/speech_261110/">Speech on privacy and AI</a></h2></div><ul><li class="next"><a rel="next" href="?o=d&amp;Page=2&amp;Filter=True">Next</a></li></ul></section></main>'
        rows,nxt=expansion.discover('ca-opc',html,listing)
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-10')
        self.assertIn('Page=2',nxt)
    def test_modified_date_and_cookie_challenge_never_become_valid_articles(self):
        html=(FIXTURES/'ca-opc-detail.html').read_text().replace('name="dcterms.issued"','name="dcterms.modified"')
        self.assertIsNone(expansion.extract('ca-opc',html,json.loads((FIXTURES/'manifest.json').read_text())['ca-opc']['url'])['published_date'])
        with self.assertRaises(ValueError):expansion.discover('oaic',"<script>document.cookie='EO_Bot_Ssid=1'</script>",expansion.ROUTES['oaic']['listing'])
    def test_redirect_wrapper_cannot_escape_approved_host(self):
        html=(FIXTURES/'oaic-listing.html').read_text().replace('https%3A%2F%2Fwww.oaic.gov.au','https%3A%2F%2Fevil.example')
        with self.assertRaises(ValueError):expansion.discover('oaic',html,expansion.ROUTES['oaic']['listing'])

if __name__=='__main__':unittest.main()
