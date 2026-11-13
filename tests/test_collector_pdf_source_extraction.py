import unittest
from unittest.mock import patch
from pathlib import Path

from scripts.collector import extraction, parsers, expansion

FIXTURES = Path(__file__).resolve().parent / 'fixtures' / 'collector-expansion'


class FakePdfClient:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def get(self, url):
        self.calls.append(url)
        return self.responses[url]


class PdfSourceExtractionTests(unittest.TestCase):
    def test_jpdp_and_cbpr_listing_fixtures_discover_official_article_dates(self):
        expected = {
            'jpdp-my': ('2026-10-29', 'https://www.pdp.gov.my/en/public-consultation-paper-no-1-2026-artificial-intelligence-ai-and-personal-data-protection-framework/'),
            'global-cbpr': ('2026-06-10', 'https://www.globalcbpr.org/the-forum-releases-its-annual-report-2025-2026-and-annual-work-program-for-2026-2027/'),
        }
        for source, (published, url) in expected.items():
            with self.subTest(source=source):
                html = (FIXTURES / f'{source}-listing.html').read_text()
                rows, next_page = expansion.discover(source, html, expansion.ROUTES[source]['listing'])
                self.assertIsNone(next_page)
                self.assertEqual([row['url'] for row in rows], [url])
                self.assertEqual(expansion.listing_date(rows[0]), published)

    def test_iso_listing_fixture_discovers_exact_pdf_and_preserves_month_only_date(self):
        source = 'iso-iec-sc27'
        html = (FIXTURES / f'{source}-listing.html').read_text()
        rows, next_page = expansion.discover(source, html, expansion.ROUTES[source]['listing'])
        self.assertIsNone(next_page)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['url'], 'https://committee.iso.org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf')
        self.assertEqual(rows[0]['date_observations'][0]['value'], '2025-05')
        self.assertIsNone(expansion.listing_date(rows[0]))

    def test_cbpr_tries_article_text_then_reads_both_allowlisted_pdfs_and_keeps_dates_distinct(self):
        page_url = 'https://www.globalcbpr.org/the-forum-releases-its-annual-report-2025-2026-and-annual-work-program-for-2026-2027/'
        annual = 'https://www.globalcbpr.org/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf'
        work_plan = 'https://www.globalcbpr.org/wp-content/uploads/Global-CBPR-Forum-Work-Program-2026-2027.pdf'
        row = {
            'url': page_url,
            'title': 'The Forum Releases its Annual Report 2025/2026 and Annual Work Program for 2026/2027',
            'date_observations': [{
                'meaning': 'expansion_listing_published',
                'locator': 'global-cbpr .elementor-post-date',
                'value': 'June 10, 2026',
            }],
        }
        client = FakePdfClient({
            annual: (b'%PDF-annual', annual, 'application/pdf'),
            work_plan: (b'%PDF-plan', work_plan, 'application/pdf'),
        })
        html = f'<main><a href="{annual}">Global CBPR Forum Annual Report 2025-2026</a><a href="{work_plan}">Global CBPR Forum Work Program 2026-2027</a></main>'
        with patch.object(extraction, '_trafilatura_item', return_value={'content_text': 'Short official HTML summary.'}) as trafilatura, \
             patch.object(parsers, 'extract_pdf', side_effect=[
                 {'pages': [{'page': 1, 'text': 'Dated May 26, 2026. Annual report.'}], 'related_documents': []},
                 {'pages': [{'page': 1, 'text': 'Dated May 26, 2026. Work program.'}], 'related_documents': []},
             ]):
            item = extraction.extract_verified_pdf_attachments('global-cbpr', html, page_url, 'text/html', row, client)

        trafilatura.assert_called_once()
        self.assertEqual(client.calls, [annual, work_plan])
        self.assertEqual(item['published_date'], '2026-06-10')
        self.assertIn('Annual report.', item['content_text'])
        self.assertIn('Work program.', item['content_text'])
        self.assertEqual(item['metadata']['trafilatura_first_attempt_characters'], len('Short official HTML summary.'))
        self.assertEqual(item['metadata']['read_scope'], 'official_source_pdf_attachment_text')
        self.assertEqual([document['url'] for document in item['metadata']['related_documents']], [annual, work_plan])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])

    def test_iso_month_listing_date_is_not_promoted_to_full_publication_date(self):
        url = 'https://committee.iso.org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf'
        page = 'https://committee.iso.org/sites/jtc1sc27/home/news.html'
        row = {
            'url': url,
            'title': 'ISO/IEC TS 27560-2023 now freely available',
            'discovered_from': page,
            'date_observations': [{
                'meaning': 'expansion_listing_published',
                'locator': 'ISO/IEC SC27 listing table row date cell',
                'value': '2025-05',
            }],
        }
        with patch.object(parsers, 'extract_pdf', return_value={
            'pages': [{'page': 1, 'text': 'Consent record information structure. Published September 2023.'}],
            'related_documents': [],
        }):
            item = parsers.extract_document('iso-iec-sc27', b'%PDF-sample', url, 'application/pdf', row)
        self.assertIsNone(item['published_date'])
        self.assertEqual(item['metadata']['date_observations'], row['date_observations'])
        self.assertTrue(item['metadata']['requires_review'])
        self.assertFalse(item['metadata']['ai_ready'])
        self.assertEqual(item['metadata']['source_page_url'], page)


    def test_ppc_notice_uses_listing_date_and_reads_verified_pdf_after_trafilatura(self):
        page = 'https://www.ppc.go.jp/news/press/2026/261007_houdou/'
        pdf_url = 'https://www.ppc.go.jp/files/pdf/261007_houdou.pdf'
        row = {'url': page, 'title':'Large-scale breach response notice',
               'date_observations':[{'meaning':'expansion_listing_published',
                   'locator':'PPC press archive row time@datetime','value':'2026-10-09'}]}
        client = FakePdfClient({pdf_url:(b'%PDF-ppc',pdf_url,'application/pdf')})
        html = f'<main><h1>Large-scale breach response notice</h1><p>Official PDF.</p><a href="{pdf_url}">Notice</a></main>'
        with patch.object(extraction, '_trafilatura_item', return_value={'content_text':'Short HTML notice.'}) as trafilatura, \
             patch.object(parsers, 'extract_pdf', return_value={
                 'pages':[{'page':1,'text':'Official notice published 2026-10-07; substantive privacy safeguards.'}],
                 'related_documents':[]}):
            item=extraction.extract_verified_pdf_attachments('ppc',html,page,'text/html',row,client)
        trafilatura.assert_called_once()
        self.assertEqual(client.calls,[pdf_url])
        self.assertEqual(item['published_date'],'2026-10-09')
        self.assertIn('2026-10-07',item['content_text'])
        self.assertEqual(item['metadata']['trafilatura_first_attempt_characters'],len('Short HTML notice.'))
        self.assertTrue(item['metadata']['requires_review'])


if __name__ == '__main__':
    unittest.main()
