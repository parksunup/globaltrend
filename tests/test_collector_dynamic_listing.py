"""Verify ICO's observed public-site search protocol, not a supported API."""
import json
import unittest

from scripts.collector import parsers
from scripts.collector.core import HttpClient, FetchError


class DynamicListingTests(unittest.TestCase):
    def test_dpc_listing_preserves_single_teaser_date_and_rejects_ambiguous_dates(self):
        html = '''<main>
          <article class="node--view-mode-teaser"><h2><a href="/en/news-media/latest-news/a">A</a></h2><p class="date">01st October 2026</p></article>
          <article class="node--view-mode-teaser"><h2><a href="/en/news-media/latest-news/b">B</a></h2><p class="date">28th September 2026</p><p class="date">27th September 2026</p></article>
        </main>'''
        rows, _ = parsers.discover('dpc', html, 'https://www.dataprotection.ie/en/news-media/latest-news')
        self.assertEqual(rows[0]['date_observations'], [{
            'meaning': 'listing_published_display',
            'locator': 'listing article.node--view-mode-teaser p.date',
            'value': '01st October 2026',
        }])
        self.assertEqual(parsers.dpc_listing_date(rows[0]), '2026-10-01')
        self.assertEqual(len(rows[1]['date_observations']), 2)
        self.assertIsNone(parsers.dpc_listing_date(rows[1]))
        self.assertIsNone(parsers.dpc_listing_date({'date_observations': [
            {'meaning': 'listing_published_display', 'locator': 'other', 'value': '01st October 2026'}]}))
        self.assertIsNone(parsers.dpc_listing_date({'date_observations': [
            {'meaning': 'listing_published_display', 'locator': 'listing article.node--view-mode-teaser p.date', 'value': '31st February 2026'}]}))

    def test_dpc_detail_date_wins_over_conflicting_teaser_with_review(self):
        html='<h1>Privacy notice</h1><main><p class="date">12 October 2026</p><div class="field--name-body"><p>A sufficiently detailed DPC publication body.</p></div></main>'
        row={'date_observations':[{'meaning':'listing_published_display','locator':'listing article.node--view-mode-teaser p.date','value':'11th October 2026'}]}
        item=parsers.extract_document('dpc',html.encode(),'https://www.dataprotection.ie/en/news-media/latest-news/example','text/html',row)
        self.assertEqual(item['published_date'],'2026-10-12')
        self.assertTrue(item['metadata']['date_conflict'])
        self.assertTrue(item['metadata']['requires_review'])

    def test_pdpc_embedded_body_excludes_footer_and_nonarticle_payloads(self):
        content = '<p>The complete embedded advisory body.</p><a href="/assets/advisory.pdf">Advisory PDF</a>'
        article = ['$', 'main', None, {'className': 'layout layout--standard', 'children': [
            ['$', 'article', None, {'className': 'container container--narrow', 'children': [
                ['$', '$L26', None, {'data': {'content': content}}],
                ['$', 'div', None, {'className': 'article-footer', 'children': 'Share'}]]}]]}]
        footer = ['$', 'footer', None, {'data': {'content': '<p>Cookie footer content must stay out.</p>'}}]
        flight = '24:' + json.dumps(article) + '\n25:' + json.dumps(footer) + '\n'
        html = '<main><h1>Advisory</h1><span class="page-banner__date">Published on 30 Sep 2026</span><main class="layout layout--standard"><article><div class="rte"></div></article></main></main><script>self.__next_f.push(' + json.dumps([1, flight]) + ')</script>'
        item = parsers.extract('pdpc', html, 'https://www.pdpc.gov.sg/media-events/advisory')
        self.assertEqual(item['content_text'], 'The complete embedded advisory body. Advisory PDF')
        self.assertEqual(item['published_date'], '2026-09-30')
        self.assertEqual(item['metadata']['read_scope'], 'news_html_from_embedded_rsc')
        self.assertEqual(item['metadata']['unread_attachments'], ['https://www.pdpc.gov.sg/assets/advisory.pdf'])
        item = parsers.extract_document('pdpc', html.encode(), 'https://www.pdpc.gov.sg/media-events/advisory', 'text/html',
            {'date_observations': [{'meaning': 'listing_published_display', 'locator': 'card', 'value': '29 Sep 2026'}]})
        self.assertEqual(item['published_date'], '2026-09-30')
        self.assertEqual(len(item['metadata']['date_observations']), 2)
        self.assertTrue(item['metadata']['date_conflict'])
        self.assertTrue(item['metadata']['requires_review'])

    def test_pdpc_ambiguous_detail_date_label_does_not_override_listing(self):
        content='<p>The complete embedded advisory body.</p>'
        article=['$', 'main', None, {'className':'layout layout--standard','children':[
            ['$', 'article', None, {'children':[['$', '$L26', None, {'data':{'content':content}}]]}]]}]
        html='<main><h1>Advisory</h1><span class="page-banner__date">Updated on 30 Sep 2026</span><main class="layout layout--standard"><article></article></main></main><script>self.__next_f.push(' + json.dumps([1,'24:'+json.dumps(article)+'\n']) + ')</script>'
        item=parsers.extract_document('pdpc',html.encode(),'https://www.pdpc.gov.sg/media-events/advisory','text/html',
            {'date_observations':[{'meaning':'listing_published_display','locator':'card','value':'29 Sep 2026'}]})
        self.assertIsNone(item['published_date'])
        self.assertTrue(item['metadata']['date_conflict'])
        self.assertTrue(item['metadata']['requires_review'])

    def test_ico_uses_explicit_dublin_core_published_date(self):
        html='<html><head><meta name="DC.Date" content="Monday, October 12, 2026"></head><body><h1>Privacy notice</h1><main><div class="rich-text"><div class="prose"><p>A sufficiently complete official privacy notice.</p></div></div></main></body></html>'
        item=parsers.extract('ico',html,'https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/example/')
        self.assertEqual(item['published_date'],'2026-10-12')
        self.assertEqual(item['metadata']['date_observations'][-1],{
            'meaning':'official_published_attribute','locator':'meta[name="DC.Date"]@content',
            'value':'Monday, October 12, 2026'})

    def test_cnil_detail_publication_date_wins_over_archive_card_with_review(self):
        html='<main><h1>Article</h1><div class="ctn-gen-auteur">20 octobre 2026</div><div class="ctn-gen-body">A sufficiently complete privacy article body.</div></main>'
        item=parsers.extract_document('cnil',html.encode(),'https://www.cnil.fr/fr/a','text/html',{
            'date_observations':[{'meaning':'listing_published_display','locator':'listing .list-inner .attributes p.date','value':'27 mars 2024'}]})
        self.assertEqual(item['published_date'],'2026-10-20')
        self.assertTrue(item['metadata']['date_conflict'])
        self.assertTrue(item['metadata']['requires_review'])

    def test_pdpc_empty_or_unresolved_embedded_body_fails_closed(self):
        for content in ['', '$2a']:
            record = ['$', 'main', None, {'className': 'layout layout--standard', 'children': [
                ['$', 'article', None, {'children': [['$', '$L26', None, {'data': {'content': content}}]]}]]}]
            html = '<main><h1>Advisory</h1></main><script>self.__next_f.push(' + json.dumps([1, '24:' + json.dumps(record) + '\n']) + ')</script>'
            with self.assertRaises(ValueError):
                parsers.extract('pdpc', html, 'https://www.pdpc.gov.sg/media-events/a')

    def test_pdpc_length_delimited_rsc_text_uses_utf8_bytes_and_not_record_like_body_lines(self):
        content = '<p>개인정보 보호 advisory.</p>\n<p>24: is body text, not a record.</p>'
        record = ['$', 'main', None, {'className': 'layout layout--standard', 'children': [
            ['$', 'article', None, {'children': [['$', '$L26', None, {'data': {'content': '$27'}}]]}]]}]
        flight = '27:T' + format(len(content.encode()), 'x') + ',' + content + '24:' + json.dumps(record) + '\n'
        html = '<main><h1>Advisory</h1></main><script>self.__next_f.push(' + json.dumps([1, flight[:30]]) + ')</script><script>self.__next_f.push(' + json.dumps([1, flight[30:]]) + ')</script>'
        item = parsers.extract('pdpc', html, 'https://www.pdpc.gov.sg/media-events/a')
        self.assertEqual(item['content_text'], '개인정보 보호 advisory. 24: is body text, not a record.')

    def test_pdpc_truncated_length_delimited_text_is_not_partial_success(self):
        html = '<main><h1>A</h1></main><script>self.__next_f.push(' + json.dumps([1, '27:Tffff,<p>Truncated text</p>']) + ')</script>'
        with self.assertRaises(ValueError):
            parsers.extract('pdpc', html, 'https://www.pdpc.gov.sg/media-events/a')

    def test_pdpc_listing_uses_dom_marker_and_observed_ten_item_protocol(self):
        endpoint = parsers.pdpc_listing_request('<section data-listing-type="media_events"></section>',
            'https://www.pdpc.gov.sg/media-events?page=2')
        from urllib.parse import urlsplit, parse_qs
        query = parse_qs(urlsplit(endpoint).query)
        self.assertEqual(query, {'listingtype': ['media_events'], 'itemsperpage': ['10'],
                                'pathname': ['/media-events'], 'page': ['2']})

    def test_pdpc_listing_rejects_unknown_shape_and_invalid_total(self):
        for response in [None, {'data': [], 'totalItems': '20'}, {'data': [], 'totalItems': 20}]:
            with self.assertRaises(ValueError):
                parsers.discover_pdpc_listing(json.dumps(response), 'https://www.pdpc.gov.sg/media-events', 1)

    def test_pdpc_listing_keeps_published_display_and_next_range(self):
        response = {'data': [{'href': '/media-events/a', 'title': 'Advisory', 'date': '30 Sep 2026'}] * 10, 'totalItems': 11}
        rows, nxt = parsers.discover_pdpc_listing(json.dumps(response), 'https://www.pdpc.gov.sg/media-events', 1)
        self.assertEqual(rows[0]['url'], 'https://www.pdpc.gov.sg/media-events/a')
        self.assertEqual(rows[0]['date_observations'][0]['value'], '30 Sep 2026')
        self.assertEqual(nxt, 'https://www.pdpc.gov.sg/media-events?page=2')

    def test_ico_period_filters_follow_official_form_protocol(self):
        html = '<div id="filter-page-container" data-node-id="2816"></div><select id="filter-page-order"><option selected value="newest">Latest</option></select>'
        payload = parsers.ico_search_request(html, 'https://ico.org.uk/news/?from=2026-09-21&to=2026-10-23&page=2')
        self.assertEqual(payload['filters'], [{'key': 'from', 'values': ['2026-09-21']}, {'key': 'to', 'values': ['2026-10-23']}])
        self.assertEqual(payload['pageNumber'], 2)

    def test_ico_rejects_partial_and_empty_pages_despite_has_more(self):
        for page, size in [(12, 20), (13, 0)]:
            response = {'results': [{'url': '/news/a/', 'title': 'A'}] * size,
                        'pagination': {'showingPageNumber': page, 'hasMore': True, 'totalPages': 17,
                                       'totalResults': 421, 'perPage': 25}}
            with self.assertRaisesRegex(ValueError, 'ico_listing_page_incomplete'):
                parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/', page)

    def test_ico_next_page_preserves_period(self):
        response = {'results': [{'url': '/news/a/', 'title': 'A'}] * 25,
                    'pagination': {'showingPageNumber': 1, 'hasMore': True, 'totalPages': 2,
                                   'totalResults': 26, 'perPage': 25}}
        _, nxt = parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/?from=2026-09-21&to=2026-10-23', 1)
        self.assertEqual(nxt, 'https://ico.org.uk/news/?from=2026-09-21&to=2026-10-23&page=2')

    def test_ico_legacy_page_restarts_in_range_and_scoped_cursor_resumes(self):
        from scripts.collector.core import collect
        class Store:
            def __init__(self, page): self.page = page
            def resume(self, *args): return {'page': self.page, 'offset': 20, 'failures': 2}
        class Client:
            def __init__(self): self.pages = []
            def get(self, url):
                self.pages.append(url)
                raise FetchError('stop_after_request')
        cfg = {'source': 'ico', 'hosts': ['ico.org.uk'], 'listing': 'https://ico.org.uk/news/',
               'enabled': True, 'permissions': dict(collect=True, store=True, ai=True)}
        for old, expected in [('https://ico.org.uk/news/?page=13', 'https://ico.org.uk/news/?from=2026-09-21&to=2026-10-23'),
                              ('https://ico.org.uk/news/?from=2026-09-21&to=2026-10-23&page=2', 'https://ico.org.uk/news/?from=2026-09-21&page=2&to=2026-10-23')]:
            client = Client()
            result = collect(cfg, client, Store(old), '2026-09-21', '2026-10-23')
            self.assertEqual(client.pages, [expected])
            self.assertFalse(result['coverage_complete'])

    def test_ico_range_rejects_invalid_or_reversed_dates(self):
        for since, until in [('2026-02-30', '2026-10-23'), ('2026-10-24', '2026-10-23')]:
            with self.assertRaisesRegex(ValueError, 'invalid_ico_listing_range'):
                parsers.ico_range_url('https://ico.org.uk/news/', since, until)

    def test_ico_request_uses_current_dom_id_and_selected_order(self):
        html = '<div id="filter-page-container" data-node-id="2816"></div><select id="filter-page-order"><option selected value="newest">Latest</option></select>'
        payload = parsers.ico_search_request(html, 'https://ico.org.uk/news/?page=2')
        self.assertEqual(payload, {'rootPageId': 2816, 'filters': [], 'pageNumber': 2, 'order': 'newest'})

    def test_ico_request_rejects_unknown_filter_or_changed_dom(self):
        with self.assertRaises(ValueError):
            parsers.ico_search_request('<main></main>', 'https://ico.org.uk/news/')
        with self.assertRaises(ValueError):
            parsers.ico_search_request('<div id="filter-page-container" data-node-id="2816"></div>', 'https://ico.org.uk/news/?page=bad')

    def test_ico_json_follows_explicit_pagination_and_ignores_creation_date(self):
        response = {'results': [{'url': '/news/a/', 'title': 'Data rights', 'createdDateTime': '2026-01-01'}],
                    'pagination': {'showingPageNumber': 1, 'hasMore': True, 'totalPages': 2, 'totalResults': 2, 'perPage': 1}}
        rows, nxt = parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/', 1)
        self.assertEqual(rows, [{'url': 'https://ico.org.uk/news/a/', 'title': 'Data rights'}])
        self.assertEqual(nxt, 'https://ico.org.uk/news/?page=2')

    def test_ico_json_rejects_stale_page_and_null_response(self):
        for response in [None, {'results': [], 'pagination': {'showingPageNumber': 1, 'hasMore': False, 'totalPages': 2, 'totalResults': 2, 'perPage': 1}}]:
            with self.assertRaises(ValueError):
                parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/?page=2', 2)

    def test_ico_last_page_has_no_next_url(self):
        response = {'results': [{'url': '/news/a/', 'title': 'A'}],
                    'pagination': {'showingPageNumber': 2, 'hasMore': False, 'totalPages': 2, 'totalResults': 2, 'perPage': 1}}
        _, nxt = parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/?page=2', 2)
        self.assertIsNone(nxt)

    def test_post_cannot_skip_robots_gate(self):
        class Client(HttpClient):
            def __init__(self):
                super().__init__(['ico.org.uk'], interval=0)
                self.called = []
            def request(self, url, method='GET', payload=None, headers=None):
                self.called.append(url)
                if url.endswith('/robots.txt'):
                    return b'User-agent: *\nDisallow: /api/\n', url, 'text/plain'
                raise AssertionError('robots disallowed POST must not reach endpoint')
        client = Client()
        with self.assertRaisesRegex(FetchError, 'robots_disallowed'):
            client.post('https://ico.org.uk/api/search', b'{}', {'Content-Type': 'application/json'})
        self.assertEqual(client.called, ['https://ico.org.uk/robots.txt'])

    def test_listing_and_probe_use_current_ico_endpoint_without_body_from_snippet(self):
        from scripts.collector.run import probe_source
        class Client:
            def __init__(self): self.post_payload = None
            def get(self, url):
                html = '<div id="filter-page-container" data-node-id="2816"></div><select id="filter-page-order"><option selected value="newest">Latest</option></select>' if url.endswith('/news/') else '<h1>Data rights</h1><span>Date</span><strong>9 October 2026</strong><main><div class="rich-text"><div class="prose">The actual detailed news body.</div></div></main>'
                return html.encode(), url, 'text/html'
            def post(self, url, payload, headers):
                self.post_payload = json.loads(payload)
                response = {'results': [{'url': '/news/a/', 'title': 'Data rights', 'description': 'Never use this snippet as full text'}],
                    'pagination': {'showingPageNumber': 1, 'hasMore': False, 'totalPages': 1, 'totalResults': 1, 'perPage': 25}}
                return json.dumps(response).encode(), url, 'application/json'
        client = Client()
        record, failed = probe_source({'source': 'ico', 'listing': 'https://ico.org.uk/news/'}, client, [])
        self.assertFalse(failed)
        self.assertEqual(record['listing']['discovered'], 1)
        self.assertEqual(record['detail']['sample_origin'], 'current_listing')
        self.assertEqual(record['detail']['content_characters'], len('The actual detailed news body.'))
        self.assertEqual(client.post_payload['rootPageId'], 2816)

    def test_repeated_pdpc_page_cannot_advance_checkpoint(self):
        from scripts.collector.core import collect
        response = {'data': [{'href': '/media-events/a' + str(i), 'title': 'A', 'date': '30 Sep 2026'} for i in range(10)], 'totalItems': 20}
        content = ['$', 'main', None, {'className': 'layout layout--standard', 'children': [
            ['$', 'article', None, {'children': [['$', '$L26', None, {'data': {'content': '<p>Data protection advisory body.</p>'}}]]}]]}]
        detail = '<main><h1>A</h1><span class="page-banner__date">Published on 30 Sep 2026</span></main><script>self.__next_f.push(' + json.dumps([1, '24:' + json.dumps(content) + '\n']) + ')</script>'
        class Client:
            def get(self, url):
                if '/api/' in url: return json.dumps(response).encode(), url, 'text/plain'
                html = '<section data-listing-type="media_events"></section>' if url.split('?')[0].endswith('/media-events') else detail
                return html.encode(), url, 'text/html'
        class Store:
            checkpointed = False
            def ingest(self, *args): return {'item_created': True}
            def checkpoint(self, *args): self.checkpointed = True
        cfg = {'source': 'pdpc', 'hosts': ['www.pdpc.gov.sg'], 'listing': 'https://www.pdpc.gov.sg/media-events',
            'enabled': True, 'permissions': dict(collect=True, store=True, ai=True)}
        store = Store()
        result = collect(cfg, Client(), store, '2026-09-01', '2026-10-13')
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['reason'], 'listing_repeated_or_duplicate_items')
        self.assertFalse(result['coverage_complete'])
        self.assertFalse(store.checkpointed)
