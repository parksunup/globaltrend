"""Small synthetic fragments model structures observed on 2026-10-13.

Removing the source-specific selectors, base resolution, PDF adapter, or
probe parsing must fail these tests. No network or production database used.
"""
import io
import unittest

from scripts.collector import parsers
from scripts.collector.core import collect


def press_pdf(text):
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
                             NameObject('/Subtype'): NameObject('/Type1'),
                             NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):
        DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(('BT /F1 12 Tf 40 700 Td (' + text + ') Tj ET').encode())
    page[NameObject('/Contents')] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


class LiveAdapterTests(unittest.TestCase):
    def test_ppc_discovers_notices_without_year_navigation(self):
        html = '<main><div class="tab-nav"><a href="/news/press/2026">Archive</a></div><ul class="news-list"><li><div class="news-text"><a href="/news/press/2026/261007_houdou">Notice</a></div></li></ul></main>'
        rows, next_page = parsers.discover('ppc', html, 'https://www.ppc.go.jp/news/press/')
        self.assertEqual(rows, [{'url': 'https://www.ppc.go.jp/news/press/2026/261007_houdou', 'title': 'Notice'}])
        self.assertIsNone(next_page)

    def test_edpb_card_overlay_gets_visible_title(self):
        html = '<main><article class="node-article-card"><h3 class="node-article-card__title">Data rights</h3><a class="node-article-card__link" href="/news/a_en"></a></article></main>'
        rows, _ = parsers.discover('edpb', html, 'https://www.edpb.europa.eu/news_en')
        self.assertEqual(rows[0]['title'], 'Data rights')

    def test_curia_english_title_link_respects_base_and_deduplicates_language_links(self):
        html = '<base href="https://curia.europa.eu/site/"><main><li class="curia-itemlist-item"><time datetime="08/10/2026">08 Oct 2026</time><div class="curia-itemlist-item-title"><a href="upload/press-en.pdf"><h3>Opinion in Case C-222/25</h3></a></div><div class="linguistic-versions"><a href="upload/press-en.pdf">EN</a><a href="upload/press-fr.pdf">FR</a></div></li></main>'
        rows, nxt = parsers.discover('curia', html, 'https://curia.europa.eu/site/jcms/d2_5158/en/press-releases')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['url'], 'https://curia.europa.eu/site/upload/press-en.pdf')
        self.assertEqual(rows[0]['title'], 'Opinion in Case C-222/25')
        self.assertEqual(rows[0]['date_observations'][0]['value'], '08 Oct 2026')
        self.assertIsNone(nxt)

    def test_curia_pdf_is_press_release_with_page_evidence_and_agreed_date(self):
        row = {'title': 'Opinion in Case C-222/25', 'date_observations': [
            {'meaning': 'published_display', 'locator': 'listing time', 'value': '08 Oct 2026'}]}
        item = parsers.extract_document('curia', press_pdf('Press release No 145/26. Luxembourg, 8 October 2026. Data protection safeguards.'),
            'https://curia.europa.eu/site/upload/press-en.pdf', 'application/pdf', row)
        self.assertEqual(item['published_date'], '2026-10-08')
        self.assertIn('Data protection safeguards.', item['content_text'])
        self.assertEqual(item['metadata']['read_scope'], 'press_release_pdf_not_judgment')
        self.assertEqual(item['metadata']['pdf_pages'][0]['page'], 1)
        self.assertEqual(item['metadata']['case_numbers'], ['C-222/25'])
        self.assertTrue(item['metadata']['requires_review'])

    def test_curia_pdf_conflicting_listing_and_pdf_dates_stay_null(self):
        row = {'title': 'Opinion', 'date_observations': [
            {'meaning': 'published_display', 'locator': 'listing time', 'value': '09 Oct 2026'}]}
        item = parsers.extract_document('curia', press_pdf('Press release. Luxembourg, 8 October 2026. Data protection rights.'),
            'https://curia.europa.eu/site/upload/press-en.pdf', 'application/pdf', row)
        self.assertIsNone(item['published_date'])

    def test_other_sources_cannot_ingest_pdf_as_verified_curia_press_release(self):
        with self.assertRaisesRegex(ValueError, 'unsupported_document_type'):
            parsers.extract_document('edpb', b'%PDF', 'https://www.edpb.europa.eu/a.pdf', 'application/pdf', {'title': 'A'})

    def test_curia_base_cannot_retarget_discovered_documents(self):
        with self.assertRaisesRegex(ValueError, 'listing_base_outside_official_host'):
            parsers.discover('curia', '<base href="https://evil.test/"><main></main>', 'https://curia.europa.eu/site/list')

    def test_pdf_attachment_links_are_unread_and_keep_page_location(self):
        from pypdf import PdfReader, PdfWriter
        from pypdf.annotations import Link
        writer = PdfWriter()
        writer.append(PdfReader(io.BytesIO(press_pdf('Luxembourg, 8 October 2026. Data protection safeguards.'))))
        writer.add_annotation(0, Link(rect=(0, 0, 10, 10), url='https://curia.europa.eu/juris/document.jsf?docid=1'))
        output = io.BytesIO(); writer.write(output)
        item = parsers.extract_document('curia', output.getvalue(), 'https://curia.europa.eu/press-en.pdf',
            'application/pdf', {'title': 'Opinion in Case C-222/25'})
        self.assertEqual(item['metadata']['related_documents'][0]['page'], 1)
        self.assertFalse(item['metadata']['related_documents'][0]['read'])
        self.assertEqual(item['metadata']['unread_attachments'], ['https://curia.europa.eu/juris/document.jsf?docid=1'])

    def test_curia_item_is_stored_as_press_release_not_judgment(self):
        from scripts.collector.store import SupabaseStore
        class Store(SupabaseStore):
            def __init__(self): pass
            def rpc(self, name, payload):
                if name == 'collector_capacity': return {'can_write': True}
                if name == 'collector_source_allowed': return True
                self.payload = payload
                return [{'item_created': True}]
        store = Store()
        item = parsers.extract_document('curia', press_pdf('Luxembourg, 8 October 2026. Data protection rights.'),
            'https://curia.europa.eu/press-en.pdf', 'application/pdf', {'title': 'Opinion in Case C-222/25'})
        store.ingest({'source_id': 'test'}, 'https://curia.europa.eu/press-en.pdf', item)
        self.assertEqual(store.payload['p_document_type'], 'press_release')

    def test_probe_reports_parser_failure_even_when_http_succeeds(self):
        from scripts.collector.run import probe_source
        class Client:
            def get(self, url):
                html = '<main><a href="/news/a_en">A</a></main>' if url.endswith('news_en') else '<main>Changed template</main>'
                return html.encode(), url, 'text/html'
        cfg = {'source': 'edpb', 'listing': 'https://www.edpb.europa.eu/news_en'}
        result, failed = probe_source(cfg, Client(), [])
        self.assertTrue(failed)
        self.assertEqual(result['listing']['discovered'], 1)
        self.assertEqual(result['detail']['status'], 'failed')
        self.assertEqual(result['detail']['reason'], 'title_or_body_missing')
        self.assertEqual(result['status'], 'held')
        self.assertFalse(result['coverage_complete'])

    def test_probe_retains_failed_request_and_continues_with_research_sample(self):
        from scripts.collector.run import probe_source
        from scripts.collector.core import FetchError
        class Client:
            def get(self, url):
                if url.endswith('news_en'): raise FetchError('network_policy_denied_403')
                html = '<h2 class="node-article-full__title">A</h2><div class="node-article-full__body">Data protection policy.</div>'
                return html.encode(), url, 'text/html'
        result, failed = probe_source({'source': 'edpb', 'listing': 'https://www.edpb.europa.eu/news_en'},
            Client(), ['https://www.edpb.europa.eu/news/a_en'])
        self.assertTrue(failed)
        self.assertEqual(result['requests'][0]['status'], 'failed')
        self.assertEqual(result['requests'][0]['reason'], 'network_policy_denied_403')
        self.assertEqual(result['detail']['sample_origin'], 'research_sample')

    def test_curia_collect_uses_pdf_adapter_but_single_listing_is_not_complete(self):
        listing = 'https://curia.europa.eu/site/list'
        html = '<base href="https://curia.europa.eu/site/"><main><li class="curia-itemlist-item"><time>08 Oct 2026</time><div class="curia-itemlist-item-title"><a href="upload/press-en.pdf"><h3>Opinion in Case C-222/25</h3></a></div></li></main>'
        pdf = press_pdf('Press release. Luxembourg, 8 October 2026. Data protection rights.')
        class Client:
            def get(self, url):
                return (html.encode(), url, 'text/html') if url == listing else (pdf, url, 'application/pdf')
        class Store:
            def ingest(self, cfg, url, item):
                self.item = item
                return {'item_created': True}
            def checkpoint(self, *args):
                raise AssertionError('unverified full range must not advance checkpoint')
        cfg = {'source': 'curia', 'listing': listing, 'hosts': ['curia.europa.eu'],
               'enabled': True, 'permissions': dict(collect=True, store=True, ai=True)}
        store = Store()
        result = collect(cfg, Client(), store, '2026-10-01', '2026-10-13')
        self.assertEqual(result['new'], 1)
        self.assertEqual(result['status'], 'partial')
        self.assertFalse(result['coverage_complete'])


if __name__ == '__main__':
    unittest.main()
