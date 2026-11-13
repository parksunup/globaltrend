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
        return next(c for c in json.loads((ROOT/'config/trend-collector.json').read_text())['sources'] if c['source']==slug)

    def claim(self,slug):
        return dict(slug=slug,source_id=self.config(slug)['source_id'],since='2026-10-26',until='2026-10-28',cursor=None,lease_until='2099-01-01T00:00:00+00:00')

    def test_mutating_parliament_listing_keeps_exact_committed_url_order(self):
        claim=self.claim('eu-parliament');urls=[f'https://www.europarl.europa.eu/news/en/press-room/2026102{i}IPR4831{i}/' for i in range(3)]
        listings=[];details=[]
        class Client(HttpClient):
            def get(self,url):
                if url.endswith('.xml'):
                    listings.append(url)
                    text='<rss><channel>'+''.join(f'<item><title>Release {i} revision {len(listings) if i==2 else 0}</title><link>{u}</link></item>' for i,u in enumerate(urls))+'</channel></rss>'
                    return text.encode(),url,'application/rss+xml'
                details.append(url)
                return (FIXTURES/'eu-parliament-detail.html').read_bytes().replace(b'2026-10-23',b'2026-10-27'),url,'text/html'
        bundles=[]
        with patch('scripts.collector.cloud_step.HttpClient',Client):
            for _ in urls:
                bundle=prepare(claim);bundles.append(bundle);claim['cursor']=bundle['cursor']
        self.assertEqual(details,urls)
        self.assertEqual(len(listings),1)
        self.assertTrue(bundles[-1]['result']['listing_scan_complete'])
        self.assertTrue(all(len(b['operations'])==1 for b in bundles))
        self.assertEqual(details,urls)

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
            expansion.collect_frozen(config,type('Client',(),{'get':lambda *_:(b'<html/>',url,'text/html')})(),
                                     store,'2026-07-01','2026-07-31')
        self.assertEqual(extract.call_args.args[4],row)
        self.assertEqual(store.items[0][1]['published_date'],'2026-07-08')

    def test_ec_listing_is_explicitly_scoped_to_the_three_day_window(self):
        url=expansion.listing_request_url('ec',self.config('ec')['listing'],'2026-10-26','2026-10-28')
        from urllib.parse import urlsplit,parse_qs
        parsed=urlsplit(url);query=parse_qs(parsed.query)
        self.assertEqual(parsed.path,'/commission/presscorner/api/search')
        self.assertEqual(query['datefrom'],['26102026'])
        self.assertEqual(query['dateto'],['29102026'])
        self.assertEqual(query['pagesize'],['10'])

    def test_parliament_redirect_allows_same_id_slug_only(self):
        requested='https://www.europarl.europa.eu/news/en/press-room/20261020IPR48312/'
        expansion.verify_detail_response('eu-parliament',requested,requested+'legitimate-title-slug')
        with self.assertRaisesRegex(ValueError,'detail_redirect_identity_mismatch'):
            expansion.verify_detail_response('eu-parliament',requested,requested.replace('IPR48312','IPR99999'))

    def test_backlog_does_not_resolve_a_different_redirected_article(self):
        claim=self.claim('eu-parliament');target='https://www.europarl.europa.eu/news/en/press-room/20261020IPR48312/'
        claim.update(backlog_id='synthetic-backlog',detail={'url':target,'title':'Original release'})
        class Client(HttpClient):
            def get(self,url):return (FIXTURES/'eu-parliament-detail.html').read_bytes(),target.replace('IPR48312','IPR99999'),'text/html'
        with patch('scripts.collector.cloud_step.HttpClient',Client):bundle=prepare(claim)
        self.assertEqual(bundle['operations'],[])
        self.assertFalse(bundle['backlog_resolved'])
        self.assertEqual(bundle['result']['reason'],'detail_redirect_identity_mismatch')

if __name__=='__main__':unittest.main()
