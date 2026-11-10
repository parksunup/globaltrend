import unittest

from scripts.collector.pdf_source_routes import discover_pdf_links


class PdfSourceRouteTests(unittest.TestCase):
    def test_jpdp_discovery_keeps_listing_title_and_date_and_deduplicates_download_button(self):
        page_url = (
            "https://www.pdp.gov.my/en/public-consultation-paper-no-1-2026-"
            "artificial-intelligence-ai-and-personal-data-protection-framework/"
        )
        pdf_url = (
            "https://www.pdp.gov.my/wp-content/uploads/2026/10/"
            "Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework.pdf"
        )
        html = f"""
        <main class="entry-content">
          <a href="{pdf_url}">Public Consultation Paper No. 1/2026: AI and Personal Data Protection Framework</a>
          <a class="wp-block-file__button" href="{pdf_url}">Download</a>
          <a href="https://evil.example/{pdf_url.rsplit('/', 1)[-1]}">External PDF</a>
          <a href="/wp-content/uploads/2026/10/unrelated.pdf">Unrelated PDF</a>
        </main>
        """
        row = {
            "url": page_url,
            "title": "PUBLIC CONSULTATION PAPER NO. 1/2026",
            "date_observations": [{
                "meaning": "expansion_listing_published",
                "locator": "jpdp-my listing .elementor-post-date",
                "value": "October 29, 2026",
            }],
        }

        result = discover_pdf_links("jpdp-my", html, page_url, row)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["url"], pdf_url)
        self.assertIn("Personal Data Protection Framework", result[0]["title"])
        self.assertEqual(result[0]["date_observations"], row["date_observations"])
        self.assertEqual(result[0]["discovered_from"], page_url)

    def test_jpdp_does_not_treat_detail_update_time_as_listing_publication_date(self):
        page_url = (
            "https://www.pdp.gov.my/en/public-consultation-paper-no-1-2026-"
            "artificial-intelligence-ai-and-personal-data-protection-framework/"
        )
        pdf_url = (
            "https://www.pdp.gov.my/wp-content/uploads/2026/10/"
            "Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework.pdf"
        )
        html = f'<meta property="og:updated_time" content="2026-10-29T12:13:47+08:00"><a href="{pdf_url}">Consultation paper</a>'

        result = discover_pdf_links("jpdp-my", html, page_url)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["date_observations"], [])

    def test_global_cbpr_finds_only_observed_annual_report_and_work_program_pdfs(self):
        page_url = (
            "https://www.globalcbpr.org/the-forum-releases-its-annual-report-"
            "2025-2026-and-annual-work-program-for-2026-2027/"
        )
        html = """
        <main>
          <a href="/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf">GlobalCBPRForum Annual Report 2025-2026</a>
          <a href="/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf">Download</a>
          <a href="/wp-content/uploads/Global-CBPR-Forum-Work-Program-2026-2027.pdf">Global CBPR Forum Work Program 2026-2027</a>
          <a href="/wp-content/uploads/other-report.pdf">Unrelated report</a>
          <a href="//files.globalcbpr.org/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf">Other host</a>
        </main>
        """
        listing_dates = [{
            "meaning": "expansion_listing_published",
            "locator": "global-cbpr listing .elementor-post-date",
            "value": "June 10, 2026",
        }]

        result = discover_pdf_links(
            "global-cbpr", html, page_url,
            {"url": page_url, "date_observations": listing_dates},
        )

        self.assertEqual(
            [item["url"] for item in result],
            [
                "https://www.globalcbpr.org/wp-content/uploads/GlobalCBPRForum-Annual-Report-2025-2026.pdf",
                "https://www.globalcbpr.org/wp-content/uploads/Global-CBPR-Forum-Work-Program-2026-2027.pdf",
            ],
        )
        self.assertEqual(result[0]["title"], "GlobalCBPRForum Annual Report 2025-2026")
        self.assertEqual(result[0]["date_observations"], listing_dates)

    def test_iso_sc27_finds_only_observed_privacy_standard_pdf_and_listing_month(self):
        page_url = "https://committee.iso.org/sites/jtc1sc27/home/news.html"
        html = """
        <table><tbody>
          <tr><td><a href="/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf">ISO/IEC TS 27560-2023 now freely available</a></td><td class="text-right">2025-05</td></tr>
          <tr><td><a href="/files/live/sites/jtc1sc27/files/resources/Compass_of_Standardization_award">Extensionless award asset</a></td><td>2025-05</td></tr>
          <tr><td><a href="/files/live/sites/jtc1sc27/files/news/IEC%201906%20Award.pdf">Unrelated award PDF</a></td><td>2021-07</td></tr>
          <tr><td><a href="https://outside.example/ISOIEC_TS_27560_2023.pdf">External PDF</a></td><td>2025-05</td></tr>
        </tbody></table>
        """

        result = discover_pdf_links("iso-iec-sc27", html, page_url)

        self.assertEqual(len(result), 1)
        self.assertEqual(
            result[0]["url"],
            "https://committee.iso.org/files/live/sites/jtc1sc27/files/news/ISOIEC_TS_27560_2023.pdf",
        )
        self.assertEqual(result[0]["title"], "ISO/IEC TS 27560-2023 now freely available")
        self.assertEqual(result[0]["date_observations"], [{
            "meaning": "expansion_listing_published",
            "locator": "ISO/IEC SC27 listing table row date cell",
            "value": "2025-05",
        }])

    def test_unapproved_page_source_and_hosts_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "pdf_source_not_supported"):
            discover_pdf_links("unknown", "<a href='/a.pdf'>PDF</a>", "https://example.org/")
        with self.assertRaisesRegex(ValueError, "pdf_page_not_evidence_backed"):
            discover_pdf_links(
                "jpdp-my", "<a href='/wp-content/uploads/2026/10/Public_Consultation_Paper_No_1_2026_Personal_Data_Protection_Framework.pdf'>PDF</a>",
                "https://evil.example/en/public-consultation-paper-no-1-2026-artificial-intelligence-ai-and-personal-data-protection-framework/",
            )
        with self.assertRaisesRegex(ValueError, "pdf_page_not_evidence_backed"):
            discover_pdf_links("iso-iec-sc27", "", "https://committee.iso.org/other/page.html")

    def test_ppc_only_discovers_the_verified_official_notice_pdf(self):
        page = "https://www.ppc.go.jp/news/press/2026/261007_houdou/"
        html = '''<main class="l-main"><div class="l-article">
          <a href="/files/pdf/261007_houdou.pdf">大規모한 누출 사건 대응</a>
          <a href="/files/pdf/other.pdf">Other attachment</a>
        </div></main>'''
        row = {'title': 'Large-scale breach response notice',
               'date_observations': [{'meaning':'expansion_listing_published',
                   'locator':'PPC press archive row time@datetime','value':'2026-10-09'}]}
        links = discover_pdf_links('ppc', html, page, row)
        self.assertEqual([item['url'] for item in links],
                         ['https://www.ppc.go.jp/files/pdf/261007_houdou.pdf'])
        self.assertEqual(links[0]['date_observations'], row['date_observations'])

    def test_ppc_october_28_notice_discovers_its_exact_official_pdf(self):
        page = "https://www.ppc.go.jp/news/press/2026/261028_houdou/"
        pdf = "https://www.ppc.go.jp/files/pdf/261028housei_press_kenkyukai.pdf"
        html = f'<main><a href="{pdf}">研究会の開催について（PDF : 130KB）</a></main>'
        result = discover_pdf_links("ppc", html, page, {"title": "研究会", "date_observations": []})
        self.assertEqual([row["url"] for row in result], [pdf])

    def test_tc260_discovers_only_pdf_under_the_matching_article_id(self):
        page = "https://www.tc260.org.cn/tc260/tzgg/202610/2ac025d624a046199d8895fd6eeee5aa.shtml"
        pdf = "https://www.tc260.org.cn/tc260/tzgg/202610/2ac025d624a046199d8895fd6eeee5aa/files/notice.pdf.pdf"
        html = f'<div class="list content plr30"><a href="{pdf}">通知附件</a><a href="/tc260/tzgg/202610/another/files/wrong.pdf">Other</a></div>'
        result = discover_pdf_links("cn-tc260", html, page, {"title": "标准计划通知", "date_observations": []})
        self.assertEqual([row["url"] for row in result], [pdf])

    def test_tc260_rejects_pdf_beneath_a_different_article_identity(self):
        page = "https://www.tc260.org.cn/tc260/tzgg/202610/2ac025d624a046199d8895fd6eeee5aa.shtml"
        html = '<a href="/tc260/tzgg/202610/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/files/notice.pdf">wrong article</a>'
        self.assertEqual(discover_pdf_links("cn-tc260", html, page), [])


if __name__ == "__main__":
    unittest.main()
