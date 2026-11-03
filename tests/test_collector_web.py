import unittest
from scripts.collector.web import normalize_document

class WebTests(unittest.TestCase):
    def document(self):
        return dict(url='https://www.consilium.europa.eu/en/press/press-releases/2026/10/28/test/',title='Official announcement',published_date='2026-10-28',body='The Council announces safeguards for processing personal data. '*12,read_scope='official_full_article',evidence=dict(method='web_open',ref='observed-page-reference',publication_locator='press release header',body_locator='article paragraphs',complete_body=True,accessed_at='2026-10-29T01:00:00Z'))
    def test_valid_body_preserves_evidence_and_hash(self):
        r=normalize_document('eu-council',self.document(),'2026-10-27','2026-10-29')
        self.assertEqual(r['p_metadata']['collector_executor'],'chatgpt-web')
        self.assertTrue(r['p_metadata']['ai_ready'])
        self.assertEqual(len(r['p_content_hash']),64)
    def test_rejects_snippet_challenge_bad_dates_and_external_host(self):
        for key,value in [('url','https://evil.example/article'),('url','https://www.consilium.europa.eu@evil.example/a'),('url','https://www.consilium.europa.eu/en/press/press-releases/%2e%2e/legal'),('published_date','2026-10-26'),('published_date','2026-02-30'),('read_scope','search_snippet'),('body',"In order to continue, we need to verify that you're not a robot. "+'x'*300)]:
            d=self.document();d[key]=value
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):normalize_document('eu-council',d,'2026-10-27','2026-10-29')
    def test_incomplete_evidence_cannot_enter_writing_queue(self):
        d=self.document();d['evidence']['complete_body']=False
        with self.assertRaises(ValueError):normalize_document('eu-council',d,'2026-10-27','2026-10-29')
    def test_edps_rss_is_only_a_brief_notice_with_linked_text_unverified(self):
        d=self.document();d.update(url='https://www.edps.europa.eu/press-publications/press-news/news/2026/test',read_scope='official_rss_notice')
        d['evidence'].update(method='official_rss_body',linked_content_verified=False)
        with self.assertRaises(ValueError):normalize_document('edps',d,'2026-10-27','2026-10-29')
    def test_no_legal_full_text_or_wrong_source_fallback(self):
        d=self.document();d['url']='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679'
        with self.assertRaises(ValueError):normalize_document('eur-lex',d,'2026-10-27','2026-10-29')
    def test_window_must_be_three_days(self):
        with self.assertRaises(ValueError):normalize_document('eu-council',self.document(),'2026-10-20','2026-10-29')

    def test_captcha_topic_is_not_mistaken_for_a_challenge(self):
        d=self.document();d['body']='The Council discusses CAPTCHA privacy safeguards. '*12
        self.assertTrue(normalize_document('eu-council',d,'2026-10-27','2026-10-29')['p_metadata']['ai_ready'])
    def test_government_article_requires_pcpd_issuer_evidence(self):
        d=self.document();d['url']='https://www.info.gov.hk/gia/general/202610/28/P2026102800001.htm'
        with self.assertRaisesRegex(ValueError,'pcpd_issuer'):normalize_document('hk-pcpd',d,'2026-10-27','2026-10-29')
        d['evidence'].update(issuer='Office of the Privacy Commissioner for Personal Data',issuer_locator='article issuer paragraph')
        d['body']='The Privacy Commissioner for Personal Data (PCPD) announces safeguards. '*12
        self.assertTrue(normalize_document('hk-pcpd',d,'2026-10-27','2026-10-29')['p_metadata']['ai_ready'])
