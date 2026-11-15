import json
import unittest
from urllib.parse import parse_qs, urlsplit

from scripts.collector import expansion
from scripts.collector.core import collect


class FpfApiTests(unittest.TestCase):
    def entry(self, index, date='2026-11-12T15:02:55', category=15, url=None):
        return {'id': index, 'date': date, 'date_gmt': date+'Z',
                'link': url or f'https://fpf.org/blog/story-{index:03d}/',
                'title': {'rendered': f'<b>Story {index}</b>'}, 'categories': [category]}

    def api_url(self, page=1):
        return expansion.listing_request_url('fpf','https://fpf.org/blog/','2026-10-01','2026-11-30') if page==1 else \
            expansion.listing_request_url('fpf',f'https://fpf.org/wp-json/wp/v2/posts?page={page}','2026-10-01','2026-11-30')

    def test_listing_url_uses_blog_category_and_padded_date_bounds(self):
        url=self.api_url()
        params=parse_qs(urlsplit(url).query)
        self.assertEqual(urlsplit(url).path,'/wp-json/wp/v2/posts')
        self.assertEqual(params['categories'],['15'])
        self.assertEqual(params['page'],['1'])
        self.assertEqual(params['per_page'],['100'])
        self.assertEqual(params['after'],['2026-09-29T00:00:00'])
        self.assertEqual(params['before'],['2026-12-02T00:00:00'])

    def test_api_discovers_and_validates_all_pages_from_wp_headers(self):
        headers={'X-WP-Total':'101','X-WP-TotalPages':'2'}
        url=self.api_url()
        rows,next_page=expansion.discover('fpf',json.dumps([self.entry(i) for i in range(100)]),url,headers)
        self.assertEqual(len(rows),100)
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-12')
        self.assertEqual(parse_qs(urlsplit(next_page).query)['page'],['2'])
        last_url=self.api_url(2)
        last,last_next=expansion.discover('fpf',json.dumps([self.entry(101)]),last_url,headers)
        self.assertEqual(len(last),1)
        self.assertIsNone(last_next)

    def test_api_fails_closed_on_category_permalink_or_pagination_mismatch(self):
        headers={'X-WP-Total':'1','X-WP-TotalPages':'1'}
        url=self.api_url()
        cases=[(self.entry(1,category=69),'fpf_blog_record_schema_changed'),
               (self.entry(1,url='https://fpf.org/press-releases/not-a-blog-post/'),
                'fpf_blog_permalink_outside_approved_path')]
        for row,reason in cases:
            with self.subTest(reason=reason),self.assertRaisesRegex(ValueError,reason):
                expansion.discover('fpf',json.dumps([row]),url,headers)
        with self.assertRaisesRegex(ValueError,'fpf_pagination_headers_missing'):
            expansion.discover('fpf',json.dumps([self.entry(1)]),url,{})
        with self.assertRaisesRegex(ValueError,'fpf_listing_page_count_mismatch'):
            expansion.discover('fpf',json.dumps([self.entry(1)]),url,{'X-WP-Total':'2','X-WP-TotalPages':'1'})

    def test_api_preflight_rejects_a_changed_blog_category_identity(self):
        from scripts.collector.core import fetch_listing
        class Client:
            def get(self,url,headers=None):
                return b'[{"id":69,"name":"Press Release","slug":"press-releases","count":174}]',url,'application/json'
        with self.assertRaisesRegex(ValueError,'fpf_blog_category_identity_unverified'):
            fetch_listing('fpf',Client(),self.api_url())

    def test_multi_page_date_window_resumes_and_completes_only_after_last_page(self):
        config={'source':'fpf','enabled':True,'listing':'https://fpf.org/blog/',
                'hosts':['fpf.org'],'permissions':{'collect':True,'store':True,'ai':True}}
        page1=[self.entry(i,date='2026-12-01T12:00:00') for i in range(1,101)]
        page2=[self.entry(101,date='2026-11-20T12:00:00')]
        class Client:
            fpf_blog_category_verified=False
            def __init__(self):self.fpf_listing_response_headers={}
            def get(self,url,headers=None):
                return (b'[{"id":15,"name":"Blog","slug":"blog","count":1969}]',url,'application/json')
            def get_with_headers(self,url,headers=None):
                page=int(parse_qs(urlsplit(url).query)['page'][0])
                data=page1 if page==1 else page2
                self.fpf_listing_response_headers={'X-WP-Total':'101','X-WP-TotalPages':'2'}
                return json.dumps(data).encode(),url,'application/json',self.fpf_listing_response_headers
            def get(self,url,headers=None):
                if '/wp-json/' in url:
                    return b'[{"id":15,"name":"Blog","slug":"blog","count":1969}]',url,'application/json'
                return ('<html><head><meta property="article:published_time" content="2026-11-20T12:00:00Z"></head>'
                        '<body><main><article><h1>Story 101</h1><div class="entry-content"><p>'
                        +'A sufficiently detailed privacy analysis describing the regulatory development and its implications. '*4
                        +'</p></div></article></main></body></html>').encode(),url,'text/html'
        class Store:
            def __init__(self,resume=None):self.saved=[];self.cursors=[];self.resume_value=resume;self.checkpoints=[]
            def resume(self,*args):return self.resume_value
            def progress(self,config,since,until,cursor):self.cursors.append(cursor)
            def checkpoint(self,config,until):self.checkpoints.append(until)
            def ingest(self,config,url,item):self.saved.append((url,item));return {'item_created':True,'content_changed':False}
            def discovery_failure(self,*args):raise AssertionError(args)

        store=Store();client=Client()
        first=collect(config,client,store,'2026-10-01','2026-11-30',max_pages=1)
        self.assertFalse(first['coverage_complete'])
        self.assertEqual(first['status'],'partial')
        self.assertEqual(first['out_of_range'],100)
        resume=next(cursor for cursor in reversed(store.cursors)
                    if cursor and parse_qs(urlsplit(cursor.get('page','')).query).get('page')==['2'])
        self.assertEqual(resume['fpf_completed_pages'],[1])
        final_store=Store(resume);final=collect(config,Client(),final_store,'2026-10-01','2026-11-30')
        self.assertTrue(final['coverage_complete'],final)
        self.assertEqual(final['status'],'complete')
        self.assertEqual(final['fpf_api_total'],101)
        self.assertEqual(final['fpf_api_total_pages'],2)
        self.assertEqual(final['out_of_range'],0)
        self.assertEqual(len(final_store.saved),1)
        self.assertEqual(final_store.checkpoints,['2026-11-30'])

    def test_resume_fails_closed_if_wordpress_total_changes_between_pages(self):
        config={'source':'fpf','enabled':True,'listing':'https://fpf.org/blog/',
                'hosts':['fpf.org'],'permissions':{'collect':True,'store':True,'ai':True}}
        resume={'page':self.api_url(2),'offset':0,'fpf_completed_pages':[1],
                'fpf_expected_total':101,'fpf_expected_pages':2}
        class Client:
            fpf_blog_category_verified=True
            def get_with_headers(self,url,headers=None):
                entries=[FpfApiTests().entry(101),FpfApiTests().entry(102)]
                headers={'X-WP-Total':'102','X-WP-TotalPages':'2'}
                self.fpf_listing_response_headers=headers
                return json.dumps(entries).encode(),url,'application/json',headers
            def get(self,url,headers=None):raise AssertionError(url)
        class Store:
            def resume(self,*args):return resume
            def progress(self,*args):pass
            def checkpoint(self,*args):raise AssertionError('must not checkpoint')
            def discovery_failure(self,*args):pass
        result=collect(config,Client(),Store(),'2026-10-01','2026-11-30')
        self.assertEqual(result['status'],'failed')
        self.assertEqual(result['reason'],'fpf_pagination_totals_changed')
        self.assertFalse(result['coverage_complete'])


if __name__=='__main__':unittest.main()
