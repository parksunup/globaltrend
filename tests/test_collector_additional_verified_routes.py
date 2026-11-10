import unittest
from unittest.mock import patch
from scripts.collector import expansion
from scripts.collector.core import FetchError, HttpClient


class AdditionalVerifiedRouteTests(unittest.TestCase):
    def test_nl_ap_robots_allow_specificity_uses_upstream_protego_rules(self):
        client = HttpClient(['autoriteitpersoonsgegevens.nl'])
        rules = 'User-agent: *\nDisallow: /actueel\nAllow: /actueel/*\n'
        client.request = lambda url, *args, **kwargs: (rules.encode(), url, 'text/plain')
        article = 'https://autoriteitpersoonsgegevens.nl/actueel/handhavingsbeleid-ap-gepubliceerd'
        self.assertEqual(client.check_robots(article), article)
        with self.assertRaisesRegex(FetchError, 'robots_disallowed'):
            client.check_robots('https://autoriteitpersoonsgegevens.nl/actueel')

    def test_ico_uses_wiredgov_latest_index_filters_attribution_and_keeps_article_url(self):
        html='''<html><body>
        <a class="link-past-week" href="/wg/news.nsf/articles/Solar+firm+made+almost+500+nuisance+calls+every+day+for+a+year+05112026152000?open">
          <span class="newsArticleTitle">Solar firm made almost 500 nuisance calls every day for a year</span>
          <span class="newsArticleChannel">Information Commissioner's Office</span>
          <span class="newsArticleDate">Thursday 05 November 2026 @ 15:20</span></a>
        <a class="link-past-week" href="/wg/news.nsf/articles/Other+story+05112026152000?open">
          <span class="newsArticleTitle">Other story</span><span class="newsArticleChannel">Other organisation</span>
          <span class="newsArticleDate">Thursday 05 November 2026 @ 15:20</span></a>
        </body></html>'''
        rows,nxt=expansion.discover('ico',html,expansion.ROUTES['ico']['listing'])
        self.assertEqual(len(rows),1)
        self.assertIn('Solar+firm',rows[0]['url'])
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-05')
        self.assertIsNone(nxt)

    def test_g7_opc_membership_hub_finds_g7_communique_without_claiming_pagination(self):
        listing=expansion.ROUTES['g7-dpa']['listing']
        html='''<main>
        <a href="/en/opc-news/speeches-and-statements/2026/communique-g7-260626/">G7 Data Protection Authorities Communiqué</a>
        <a href="/en/opc-news/speeches-and-statements/2026/other-update/">Office update</a>
        </main>'''
        rows,nxt=expansion.discover('g7-dpa',html,listing)
        self.assertEqual(len(rows),1)
        self.assertIn('communique-g7-260626',rows[0]['url'])
        self.assertIsNone(expansion.listing_date(rows[0]))
        self.assertIsNone(nxt)

    def test_cppa_press_release_category_parses_cards_and_page_two(self):
        listing=expansion.ROUTES['calprivacy']['listing']
        html='''<article class="post"><a class="thumbnail-link" href="/2026/11/privacy-enforcement/"></a>
          <div class="cat-info"><h2>Privacy enforcement announcement</h2></div>
          <div class="post-meta"><span class="published">November 6, 2026</span></div></article>
          <a class="next page-numbers" href="/category/content-types/news/press-release/page/2/">Older</a>'''
        rows,nxt=expansion.discover('calprivacy',html,listing)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'],'https://privacy.ca.gov/2026/11/privacy-enforcement/')
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-06')
        self.assertTrue(nxt.endswith('/page/2/'))

    def test_cac_uses_observed_current_privacy_list_and_does_not_guess_page_two(self):
        listing=expansion.ROUTES['cn-cac']['listing']
        html='''<div id="loadingInfoPage"><ul><li><h5><a href="/2026-11/08/c_123456.htm">个人信息保护通报</a></h5><span class="times">2026-11-08</span></li></ul></div>'''
        rows,nxt=expansion.discover('cn-cac',html,listing)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'],'https://www.cac.gov.cn/2026-11/08/c_123456.htm')
        self.assertEqual(expansion.listing_date(rows[0]),'2026-11-08')
        self.assertIsNone(nxt)

    def test_ripd_official_rss_discovers_detail_url_and_publication_date(self):
        listing=expansion.ROUTES['ripd']['listing']
        xml='''<?xml version="1.0"?><rss version="2.0"><channel><item>
          <title>La protección de datos personales</title><link>https://www.redipd.org/noticias/proteccion-datos</link>
          <pubDate>Mon, 09 Nov 2026 12:00:00 +0000</pubDate><description>Resumen oficial</description>
          </item></channel></rss>'''
        rows,nxt=expansion.discover('ripd',xml,listing)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'],'https://www.redipd.org/noticias/proteccion-datos')
        self.assertEqual(expansion.date(rows[0]['date_observations'][0]['value']),'2026-11-09')
        self.assertIsNone(nxt)

    def test_ftc_privacy_search_filter_keeps_detail_date_and_pagination(self):
        listing=expansion.ROUTES['ftc']['listing']
        html='''<main><article><h2><a href="/news-events/news/press-releases/2026/07/privacy-action">Privacy action</a></h2>
          <time datetime="2026-07-29">July 29, 2026</time></article>
          <nav class="pager"><a rel="next" href="?search=privacy&amp;items_per_page=50&amp;field_mission%5B29%5D=29&amp;page=1">Next</a></nav></main>'''
        rows,nxt=expansion.discover('ftc',html,listing)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['url'],'https://search.ftc.gov/news-events/news/press-releases/2026/07/privacy-action')
        self.assertEqual(__import__('scripts.collector.parsers',fromlist=['ftc_listing_date']).ftc_listing_date(rows[0]),'2026-07-29')
        self.assertIn('page=1',nxt)

    def test_vietnam_observed_timeline_pages_and_empty_end(self):
        listing='''<html><input id="hdZoneId" value="11151"><script>timeline.url='/timelinelist/{0}/{1}.htm'; timeline.init()</script>
        <div class="box-category-item-sub" data-id="111261102100407268"><h3 class="box-category-content"><a class="box-category-link-title" data-linktype="newsdetail" href="/new-policies-take-effect-in-viet-nam-in-november-2026-111261102100407268.htm">New policies take effect in Viet Nam in November 2026</a></h3></div></html>'''
        rows,nxt=expansion.discover('vn-gov',listing,'https://en.baochinhphu.vn/policies.htm')
        self.assertEqual(len(rows),1)
        self.assertEqual(nxt,'https://en.baochinhphu.vn/timelinelist/11151/2.htm')
        page2='''<div class="box-category-item-sub"><h3 class="box-category-content"><a class="box-category-link-title" data-linktype="newsdetail" href="/law-on-drug-prevention-and-control-111261027112720379.htm">New law</a></h3><span class="time-ago">27 October 2026</span></div>'''
        page_url='https://en.baochinhphu.vn/timelinelist/11151/2.htm'
        rows,nxt=expansion.discover('vn-gov',page2,page_url)
        self.assertEqual(rows[0]['title'],'New law')
        self.assertEqual(nxt,'https://en.baochinhphu.vn/timelinelist/11151/3.htm')
        self.assertEqual(expansion.discover('vn-gov','',nxt),( [],None))

    def test_vietnam_homepage_discovers_focus_story_before_policy_timeline(self):
        html='''<a class="box-focus-link-title" data-type="title" data-linktype="newsdetail" href="/unrelated.htm">Unrelated</a>
        <a class="box-focus-link-title" data-type="title" data-linktype="newsdetail" data-id="111261102100407268"
        href="/new-policies-take-effect-in-viet-nam-in-november-2026-111261102100407268.htm"
        title="New policies take effect in Viet Nam in November 2026">New policies take effect in Viet Nam in November 2026</a>'''
        rows,nxt=expansion.discover('vn-gov',html,'https://en.baochinhphu.vn/')
        self.assertEqual(len(rows),1)
        self.assertIn('111261102100407268.htm',rows[0]['url'])
        self.assertEqual(nxt,'https://en.baochinhphu.vn/policies.htm')

    def test_hk_pcpd_uses_date_archive_and_filters_official_mentions(self):
        source='https://www.info.gov.hk/gia/general/today.htm'
        self.assertEqual(expansion.listing_request_url('hk-pcpd',source,'2026-01-25','2026-01-27'),
                         'https://www.info.gov.hk/gia/general/202601/27.htm')
        html='''<ul><li><a class="NEW" href="/gia/general/202601/27/P2026012600522.htm">HKMA and PCPD strengthen collaboration to combat fraud and safeguard personal data (with photo)</a></li>
        <li><a href="/gia/general/202601/27/P2026012600523.htm">Other government release</a></li></ul>'''
        rows,nxt=expansion.discover('hk-pcpd',html,'https://www.info.gov.hk/gia/general/202601/27.htm')
        self.assertEqual(len(rows),1)
        self.assertIn('P2026012600522.htm',rows[0]['url'])
        self.assertEqual(rows[0]['date_observations'][0]['meaning'],'listing_archive_day')
        self.assertEqual(nxt,'https://www.info.gov.hk/gia/general/202601/26.htm')
        self.assertIsNone(expansion.listing_request_url('hk-pcpd',nxt,'2026-01-27','2026-01-27'))

    def test_hk_pcpd_scans_each_archive_day_in_requested_window(self):
        class Store:
            def __init__(self): self.pages=[]
            def resume(self,*args): return {}
            def progress(self,config,since,until,value): self.pages.append(value)
            def checkpoint(self,*args): pass
        store=Store(); seen=[]
        def fetch(source,client,url):
            seen.append(url)
            return [],None
        config={'source':'hk-pcpd','listing':expansion.ROUTES['hk-pcpd']['listing']}
        with patch('scripts.collector.core.fetch_listing',side_effect=fetch):
            result=expansion.collect_frozen(config,object(),store,'2026-01-25','2026-01-27')
        self.assertEqual(seen,[
            'https://www.info.gov.hk/gia/general/202601/27.htm',
            'https://www.info.gov.hk/gia/general/202601/26.htm',
            'https://www.info.gov.hk/gia/general/202601/25.htm',
        ])
        self.assertEqual(result['pages'],3)
        self.assertTrue(result['listing_scan_complete'])

    def test_eu_council_official_rss_is_summary_only_and_topic_filtered(self):
        xml='''<?xml version="1.0"?><rss version="2.0"><channel><item>
        <title>Data protection in the Council</title><link>https://www.consilium.europa.eu/en/press/press-releases/2026/11/08/data-protection/</link>
        <pubDate>2026-11-08T10:00:00+01:00</pubDate><description><![CDATA[Ministers discussed personal data protection.]]></description>
        </item><item><title>Other topic</title><link>https://www.consilium.europa.eu/en/press/press-releases/2026/11/08/other/</link>
        <pubDate>2026-11-08T09:00:00+01:00</pubDate><description><![CDATA[Transport ministers met.]]></description></item></channel></rss>'''
        rows,nxt=expansion.discover('eu-council',xml,expansion.ROUTES['eu-council']['listing'])
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['rss_source'],'eu-council')
        from scripts.collector.extraction import extract_official_rss_summary
        item=extract_official_rss_summary(rows[0])
        self.assertEqual(item['metadata']['read_scope'],'official_rss_summary_only')
        self.assertEqual(item['published_date'],'2026-11-08')
        self.assertEqual(item['metadata']['source_body_completeness'],'summary_only')
        self.assertIsNone(nxt)

    def test_ppc_uses_year_archive_and_preserves_archive_publication_date(self):
        self.assertEqual(expansion.listing_request_url(
            'ppc','https://www.ppc.go.jp/news/press/','2026-10-07','2026-10-10'),
            'https://www.ppc.go.jp/news/press/2026/')
        html='''<main><div class="news-list"><div class="news-text">
          <a href="/news/press/2026/261007_houdou/">大規模な漏えい等事案を踏まえた対応について</a>
          <time datetime="2026-10-09">2026年10月9日</time>
        </div></div></main>'''
        rows,nxt=expansion.discover('ppc',html,'https://www.ppc.go.jp/news/press/2026/')
        self.assertIsNone(nxt)
        self.assertEqual(rows[0]['url'],'https://www.ppc.go.jp/news/press/2026/261007_houdou/')
        self.assertEqual(expansion.listing_date(rows[0]),'2026-10-09')


if __name__=='__main__':
    unittest.main()
