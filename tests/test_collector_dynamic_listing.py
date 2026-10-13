"""Verify ICO's observed public-site search protocol, not a supported API."""
import json
import unittest

from scripts.collector import parsers
from scripts.collector.core import HttpClient, FetchError


class DynamicListingTests(unittest.TestCase):
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
        self.assertIsNone(item['published_date'])
        self.assertEqual(len(item['metadata']['date_observations']), 2)
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
                    'pagination': {'showingPageNumber': 1, 'hasMore': True, 'totalPages': 2}}
        rows, nxt = parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/', 1)
        self.assertEqual(rows, [{'url': 'https://ico.org.uk/news/a/', 'title': 'Data rights'}])
        self.assertEqual(nxt, 'https://ico.org.uk/news/?page=2')

    def test_ico_json_rejects_stale_page_and_null_response(self):
        for response in [None, {'results': [], 'pagination': {'showingPageNumber': 1, 'hasMore': False, 'totalPages': 2}}]:
            with self.assertRaises(ValueError):
                parsers.discover_ico_search(json.dumps(response), 'https://ico.org.uk/news/?page=2', 2)

    def test_ico_last_page_has_no_next_url(self):
        response = {'results': [{'url': '/news/a/', 'title': 'A'}],
                    'pagination': {'showingPageNumber': 2, 'hasMore': False, 'totalPages': 2}}
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
                    'pagination': {'showingPageNumber': 1, 'hasMore': False, 'totalPages': 1}}
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
