import json
import datetime as dt
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.collector import parsers, expansion
from scripts.collector.core import HttpClient, FetchError
from scripts.collector.cloud_step import validate_claim

ROOT=Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests/fixtures/collector-expansion'

class ExpansionTests(unittest.TestCase):
    def test_tc260_attachment_outside_body_is_not_silently_ignored(self):
        manifest=json.loads((FIXTURES/'manifest.json').read_text())['cn-tc260']
        item=parsers.extract_document('cn-tc260',(FIXTURES/'cn-tc260-detail.html').read_bytes(),manifest['url'],'text/html')
        self.assertTrue(any(url.endswith('.pdf.pdf') for url in item['metadata']['unread_attachments']))
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])
    def test_tc260_follows_observed_pagination_and_unknown_dates_never_shorten_a_scan(self):
        rows,nxt=expansion.discover('cn-tc260',(FIXTURES/'cn-tc260-listing.html').read_text(),expansion.ROUTES['cn-tc260']['listing'])
        self.assertEqual(nxt,'https://www.tc260.org.cn/tc260/tzgg/list_2.shtml')
        self.assertEqual(expansion.next_within_window('oaic',[{'url':'https://www.oaic.gov.au/news/media-centre/test','title':'unknown'}],'https://www.oaic.gov.au/news/media-centre?page=2','2026-10-24'),'https://www.oaic.gov.au/news/media-centre?page=2')
    def test_only_assigned_cloud_sources_and_matching_source_ids_are_claimable(self):
        configs=json.loads((ROOT/'config/trend-collector.json').read_text())['sources']
        for c in configs:
            if not c.get('expansion_phase'):continue
            claim={'slug':c['source'],'source_id':c['source_id'],'lease_until':(dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5)).isoformat()}
            if c.get('enabled') and c.get('executor')=='cloud-python':validate_claim(claim)
            else:
                with self.assertRaisesRegex(ValueError,'cloud_source_not_assigned'):validate_claim(claim)
    def test_all_observed_routes_extract_official_body_and_publication_date(self):
        manifest=json.loads((FIXTURES/'manifest.json').read_text())
        for source,c in expansion.ROUTES.items():
            with self.subTest(source=source):
                ext='json' if source=='ec' else 'xml' if c.get('feed') else 'html'
                rows,nxt=parsers.discover_listing(source,(FIXTURES/f'{source}-listing.{ext}').read_text(),c['listing'],None)
                self.assertTrue(rows)
                m=manifest[source]
                item=parsers.extract_document(source,(FIXTURES/f'{source}-detail.{"json" if source=="ec" else "html"}').read_bytes(),m['url'],'application/json' if source=='ec' else 'text/html')
                self.assertEqual(item['published_date'],m['published_date'])
                self.assertGreater(len(item['content_text']),100)
                self.assertEqual(item['metadata']['ai_ready'],not item['metadata']['requires_review'])
    def test_robots_4xx_unavailable_is_allowed_but_server_failure_remains_blocked(self):
        for code in ('http_403','http_404','http_410'):
            c=HttpClient(['example.org'])
            with patch.object(c,'request',side_effect=FetchError(code)):
                self.assertEqual(c.check_robots('https://example.org/news'),'https://example.org/news')
        for code in ('http_500',):
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
    def test_ca_opc_advice_to_parliament_is_an_approved_paginated_listing(self):
        route=expansion.ROUTES['ca-opc'];listing=route['additional_listings'][0]
        html='<main><section aria-label="Main content"><div class="entry"><time datetime="2026-11-02">November 2, 2026</time><h2><a href="/en/opc-actions-and-decisions/advice-to-parliament/2026/parl_261102/">Statement by the Privacy Commissioner of Canada on Bill C-22</a></h2></div><div class="entry"><time datetime="2026-10-07">October 7, 2026</time><h2><a href="/en/opc-actions-and-decisions/advice-to-parliament/2026/parl_261007/">Statement by the Privacy Commissioner of Canada on security screening</a></h2></div><ul><li class="next"><a rel="next" href="?o=d&amp;Page=2&amp;Filter=True">Next</a></li></ul></section></main>'
        rows,nxt=expansion.discover('ca-opc',html,listing)
        self.assertEqual(len(rows),2)
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-02')
        self.assertTrue(rows[0]['url'].endswith('/parl_261102/'))
        self.assertIn('Page=2',nxt)
    def test_modified_date_and_cookie_challenge_never_become_valid_articles(self):
        html=(FIXTURES/'ca-opc-detail.html').read_text().replace('name="dcterms.issued"','name="dcterms.modified"')
        self.assertIsNone(expansion.extract('ca-opc',html,json.loads((FIXTURES/'manifest.json').read_text())['ca-opc']['url'])['published_date'])
        with self.assertRaises(ValueError):expansion.discover('oaic',"<script>document.cookie='EO_Bot_Ssid=1'</script>",expansion.ROUTES['oaic']['listing'])
    def test_redirect_wrapper_cannot_escape_approved_host(self):
        html=(FIXTURES/'oaic-listing.html').read_text().replace('https%3A%2F%2Fwww.oaic.gov.au','https%3A%2F%2Fevil.example')
        with self.assertRaises(ValueError):expansion.discover('oaic',html,expansion.ROUTES['oaic']['listing'])

if __name__=='__main__':unittest.main()
