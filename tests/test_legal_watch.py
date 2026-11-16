import base64
import importlib.util
import io
import json
from pathlib import Path
import unittest
import urllib.error
import zipfile
ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
w=module('law_watch',Path('scripts/legal-watch/watch.py'));artifacts=module('law_artifacts',Path('scripts/legal-watch/artifacts.py'))
SOURCE={'id':'appi','jurisdiction':'JP','name':'日本法','url':'https://laws.e-gov.go.jp/current','baselineUrl':'https://laws.e-gov.go.jp/previous','allowedHosts':['laws.e-gov.go.jp'],'identity':['個人情報'],'parser':'egov','scope':'本則','minimumArticles':1}
def snapshot(text='old words',number='1'):
 a={'main:'+number:{'label':'第'+number+'条','hash':w.digest(text)}};return {'articles':a,'metadata':{},'version':'v1','coverage':'article_text','digest':w.digest(a)}
class WatchTests(unittest.TestCase):
 def test_japanese_base64_xml_and_historical_revision(self):
  raw=json.dumps({'revision_info':{'law_title':'個人情報','current_revision_status':'CurrentEnforced'},'law_full_text':base64.b64encode('<Law><MainProvision><Article Num="1"><ArticleCaption>条文</ArticleCaption><Paragraph>条件と例外を保持する本文です。</Paragraph></Article></MainProvision></Law>'.encode()).decode()},ensure_ascii=False).encode()
  result=w.parse_source(SOURCE,raw);self.assertIn('main:1',result['articles']);self.assertNotIn('条件',json.dumps(result,ensure_ascii=False))
  old=raw.replace(b'CurrentEnforced',b'PreviousEnforced');self.assertIn('main:1',w.parse_source(SOURCE,old,historical=True)['articles'])
  with self.assertRaises(w.SourceError):w.parse_source(SOURCE,old)
 def test_first_run_compares_selected_original_not_korean_translation(self):
  def fetch(s,url=None):return snapshot('selected') if url else snapshot('latest')
  result,state=w.check_one(SOURCE,{},[],fetch);self.assertEqual(result['status'],'changed');self.assertEqual(result['baselineOrigin'],'selected_edition');self.assertEqual(result['changes']['modified'],['main:1']);self.assertNotIn('latest',json.dumps(state))
 def test_pending_changes_survive_unchanged_checks_and_errors(self):
  fetch=lambda s,url=None:snapshot('before' if url else 'after')
  first,state=w.check_one(SOURCE,{},[],fetch)
  unchanged,state2=w.check_one(SOURCE,state,[],lambda s,url=None:snapshot('after'));self.assertEqual(unchanged['status'],'unchanged');self.assertEqual(len(unchanged['events']),1);self.assertFalse(unchanged['events'][0]['reviewed'])
  def fail(*args):raise w.SourceError('http_403')
  error,preserved=w.check_one(SOURCE,state2,[],fail);self.assertEqual(error['status'],'error');self.assertEqual(preserved,state2);self.assertEqual(len(error['events']),1)
 def test_source_unavailable_is_not_unchanged_and_does_not_replace_baseline(self):
  def fail(*args):raise w.SourceError('empty_response')
  result,state=w.check_one(SOURCE,{},[],fail);self.assertEqual(result['status'],'error');self.assertNotIn('snapshot',state)
 def test_review_requires_matching_evidence_and_both_reviews(self):
  fetch=lambda s,url=None:snapshot('before' if url else 'after')
  result,state=w.check_one(SOURCE,{},[],fetch);event=result['events'][0]
  receipt={'eventId':event['id'],'sourceDigest':event['afterDigest'],'translationCommitSha':'a'*40,'reviewedAt':'2026-11-16','translationReviewed':True,'comparisonReviewed':False}
  r,_=w.check_one(SOURCE,state,[receipt],lambda s,url=None:snapshot('after'));self.assertFalse(r['events'][0]['reviewed'])
  receipt['comparisonReviewed']=True;r,state=w.check_one(SOURCE,state,[receipt],lambda s,url=None:snapshot('after'));self.assertTrue(r['events'][0]['reviewed'])
  r,_=w.check_one(SOURCE,state,[receipt],lambda s,url=None:snapshot('new source'));self.assertFalse(r['events'][-1]['reviewed'])
 def test_incomplete_source_never_becomes_a_mass_repeal(self):
  prior=snapshot();prior['articles']={str(i):{'hash':w.digest(str(i))} for i in range(10)}
  config=w.digest({'url':SOURCE['url'],'baselineUrl':SOURCE['baselineUrl'],'parser':SOURCE['parser'],'parserVersion':w.PARSER_VERSION})
  r,state=w.check_one(SOURCE,{'configHash':config,'snapshot':prior,'events':[]},[],lambda *args:snapshot());self.assertEqual(r['error'],'unexpected_article_loss');self.assertEqual(state['snapshot'],prior)
 def test_chinese_index_is_explicitly_partial(self):
  source={**SOURCE,'parser':'chinese-html','identity':['个人信息'],'minimumArticles':1}
  raw=json.dumps({'data':{'title':'个人信息','sxx':3,'content':{'title':'第一条','children':[]}}},ensure_ascii=False).encode()
  data=w.parse_source(source,raw);self.assertEqual(data['coverage'],'index_and_status_only');r,_=w.check_one(source,{},[],lambda *args:data);self.assertEqual(r['status'],'partial')
 def test_html_chrome_and_whitespace_do_not_change_body(self):
  source={**SOURCE,'parser':'eu-html','identity':['2016/679']}
  a=b'<html><nav>date one</nav>2016/679<div id="art_1">Article 1 <p>condition exception</p></div></html>'
  b=a.replace(b'date one',b'date two').replace(b'condition exception',b'condition  exception')
  self.assertEqual(w.parse_source(source,a)['digest'],w.parse_source(source,b)['digest'])
 def test_partial_singapore_document_is_rejected(self):
  source={**SOURCE,'parser':'singapore-html','identity':['PDPA'],'minimumArticles':2}
  raw=b'PDPA<div class="prov1"><p id="pr1-">long enough statutory body</p></div>'
  with self.assertRaises(w.SourceError):w.parse_source(source,raw)
 def test_korean_subarticles_keep_distinct_identities(self):
  source={**SOURCE,'parser':'korean-html','identity':['개인정보 보호법'],'minimumArticles':2}
  raw='개인정보 보호법<p>제6조(일반) 조건과 예외를 보존합니다.</p><p>제6조의2(추가) 별도의 예외를 보존합니다.</p>'.encode()
  parsed=w.parse_source(source,raw);self.assertEqual(set(parsed['articles']),{'main:6','main:6-2'})
 def test_config_change_and_fetch_failure_keep_unreviewed_events(self):
  r,state=w.check_one(SOURCE,{},[],lambda s,url=None:snapshot('old' if url else 'changed'))
  old=json.loads(json.dumps(state))
  def fail(*args):raise w.SourceError('http_403')
  r,new=w.check_one({**SOURCE,'url':'https://laws.e-gov.go.jp/new'},state,[],fail)
  self.assertEqual(len(r['events']),1);self.assertEqual(state,old);self.assertEqual(len(new['events']),1)
 def test_official_url_rejects_cross_host_credentials_and_non_https(self):
  for url in ['http://laws.e-gov.go.jp/','https://laws.e-gov.go.jp.evil.test/','https://secret@laws.e-gov.go.jp/']:
   with self.assertRaises(w.SourceError):w.validate_url(url,{'laws.e-gov.go.jp'})
 def test_checkpoint_archive_does_not_extract_arbitrary_paths(self):
  f=io.BytesIO()
  with zipfile.ZipFile(f,'w') as z:z.writestr('../checkpoint.json','{}')
  with self.assertRaises(ValueError):artifacts.read_checkpoint(f.getvalue())
 def test_artifact_selection_ignores_pull_requests_and_other_workflows(self):
  def request(path,token):return {'workflow_runs':[{'id':1,'event':'pull_request','head_branch':'main','head_repository':{'full_name':artifacts.REPO},'path':'.github/workflows/'+artifacts.WORKFLOW}]}
  with self.assertRaises(ValueError):artifacts.previous_checkpoint('token',request)
 def test_all_registered_laws_are_attempted_even_when_one_fails(self):
  sources=[{**SOURCE,'id':'one'},{**SOURCE,'id':'two'}];seen=[]
  def fetch(source,url=None):
   seen.append(source['id'])
   if source['id']=='one':raise w.SourceError('http_403')
   return snapshot()
  report,state=w.run({'sources':sources},{},{'reviews':[]},fetch);self.assertEqual(len(report['laws']),2);self.assertEqual(set(seen),{'one','two'});self.assertNotIn('old words',json.dumps(state))
if __name__=='__main__':unittest.main()
