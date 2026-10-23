import unittest
from scripts.collector import core, parsers

LISTING='https://www.cnil.fr/fr/actualites'
OBS={'meaning':'listing_published_display','locator':'listing .list-inner .attributes p.date','value':'27 mars 2024'}
def card(path,date):
    return f'<div class="list-inner"><h3 class="ctn-gen-liste-titre"><a href="/fr/{path}">{path}</a></h3><div class="attributes"><p class="date">{date}</p></div></div>'
class CnilRangeTests(unittest.TestCase):
    def test_card_dates_and_detail_conflict(self):
        rows,_=parsers.discover('cnil','<main>'+card('old','27 mars 2024')+card('unknown','')+'</main>',LISTING)
        self.assertEqual(rows[0].get('date_observations'),[OBS])
        self.assertIsNone(parsers.cnil_listing_date(rows[1]))
        html='<main><h1>A</h1><div class="ctn-gen-auteur">20 octobre 2026</div><div class="ctn-gen-body">Personal data protection evidence.</div></main>'
        item=parsers.extract_document('cnil',html.encode(),LISTING,'text/html',rows[0])
        self.assertIsNone(item['published_date'])
        self.assertTrue(item['metadata']['requires_review'])
    def test_old_page_never_stops_scan_before_later_new_card(self):
        cfg={'source':'cnil','enabled':True,'listing':LISTING,'hosts':['www.cnil.fr'],'permissions':dict(collect=True,store=True,ai=True)}
        pages={LISTING:'<main>'+card('old','27 mars 2024')+'<a rel="next" href="?page=1">Next</a></main>',
            LISTING+'?page=1':'<main>'+card('new','20 octobre 2026')+'</main>',
            'https://www.cnil.fr/fr/new':'<main><h1>New</h1><div class="ctn-gen-auteur">20 octobre 2026</div><div class="ctn-gen-body">Personal data protection evidence.</div></main>'}
        class Client:
            calls=[]
            def get(self,url):
                self.calls.append(url)
                if url not in pages: raise AssertionError('unexpected detail read: '+url)
                return pages[url].encode(),url,'text/html'
        class Store:
            def ingest(self,*args): return {'item_created':True}
            def checkpoint(self,*args): raise AssertionError('unverified coverage')
        client=Client();r=core.collect(cfg,client,Store(),'2026-09-21','2026-10-23',max_items=1)
        self.assertEqual(client.calls,[LISTING,LISTING+'?page=1','https://www.cnil.fr/fr/new'])
        self.assertEqual(r.get('listing_date_excluded'),1)
        self.assertEqual(r['new'],1)
        self.assertTrue(r.get('listing_scan_complete'))
        self.assertFalse(r['coverage_complete'])
    def test_ambiguous_card_date_is_not_filtered(self):
        self.assertIsNone(parsers.cnil_listing_date({'date_observations':[OBS,{**OBS,'value':'20 octobre 2026'}]}))
        self.assertIsNone(parsers.cnil_listing_date({'date_observations':[{**OBS,'value':'31 février 2024'}]}))
