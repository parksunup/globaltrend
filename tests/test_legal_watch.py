import base64
import importlib.util
import io
import json
import sys
from unittest.mock import patch
from pathlib import Path
import unittest
import urllib.error
import zipfile
import warnings
ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
 sys.path.insert(0,str((ROOT/path).parent))
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
 def test_korean_official_body_separates_main_and_supplementary_article_numbers(self):
  source={**SOURCE,'parser':'korean-html','identity':['개인정보 보호법'],'minimumArticles':3,'minimumMainArticles':2}
  raw='<h2>개인정보 보호법</h2>[시행 2026. 9. 11.] [법률 제21445호, 2026. 3. 10., 일부개정]<p class="pty1_p4">제1조(목적) 개인정보를 보호한다.</p><p class="pty1_dep1">조건과 예외를 모두 보존한다.</p><p class="pty1_p4">제2조(정의) 개인정보를 정의한다.</p><p class="pty3">부칙 &lt;법률 제21445호, 2026. 3. 10.&gt;</p><p class="pty3_dep1">제1조(시행일) 시행 관계를 보존한다.</p>'.encode()
  parsed=w.parse_source(source,raw);self.assertEqual(len(parsed['articles']),3);self.assertEqual(sum(k.startswith('main:') for k in parsed['articles']),2);self.assertTrue(any(k.startswith('supplement:21445:') for k in parsed['articles']));self.assertEqual(parsed['metadata']['lawNumber'],'21445')
  with self.assertRaisesRegex(w.SourceError,'korean_title_not_confirmed'):w.parse_source(source,raw.replace('<h2>개인정보 보호법</h2>'.encode(),'<h2>다른 법률</h2><p>개인정보 보호법을 인용한다.</p>'.encode()))
 def test_korean_current_resolver_uses_official_sequence_and_rejects_missing_or_ambiguous_values(self):
  source={**SOURCE,'parser':'korean-html','identity':['개인정보 보호법'],'resolver':'korean-current-body','minimumArticles':1,'allowedHosts':['www.law.go.kr']}
  raw='<h2>개인정보 보호법</h2>[시행 2026. 9. 11.] [법률 제21445호, 일부개정]<p class="pty1_p4">제1조(목적) 조건과 예외를 보존한다.</p>'.encode();calls=[]
  def fetch(s,url):calls.append(url);return b'<input id="lsiSeq" value="283839">' if len(calls)==1 else raw
  with patch.object(w,'fetch_bytes',side_effect=fetch):result=w.read_official(source,'https://www.law.go.kr/law')
  self.assertIn('lsiSeq=283839',calls[-1]);self.assertEqual(result['metadata']['lawNumber'],'21445')
  with patch.object(w,'fetch_bytes',return_value=b'<input id="lsiSeq" value="283839"><input id="lsiSeq" value="999999">'):
   with self.assertRaisesRegex(w.SourceError,'current_korean_sequence_not_confirmed'):w.read_official(source,'https://www.law.go.kr/law')
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
 def test_uk_multi_letter_and_terminal_dot_article_identifiers_are_not_dropped(self):
  source={**SOURCE,'parser':'uk-xml','identity':['GDPR'],'minimumArticles':3}
  raw=b'<Law>GDPR<P1 id="article-8ZA">8ZA conditions and exceptions</P1><P1 id="article-12A.">12A conditions and exceptions</P1><P1 id="article-13">13 conditions and exceptions</P1></Law>'
  self.assertEqual(set(w.parse_source(source,raw)['articles']),{'main:8ZA','main:12A','main:13'})
 def test_pdf_section_boundaries_exclude_contents_citations_and_footnote_years(self):
  import pdf_sources as pdf
  sg='Personal Data Protection\nversion in force from 16/10/2026\n1. Short title (contents)\n'
  sg+='1. This Act is the Personal Data Protection Act 2012.\n'
  sg+='\n'.join(f'{n}. condition and exception body' for n in range(2,91))+'\n2014. Continued citation year\n'
  sg+='\n'.join(name+' SCHEDULE\nconditions and exceptions' for name in pdf.ORDINALS)
  articles,_,_=pdf.singapore(sg);self.assertEqual(len(articles),101);self.assertNotIn('main:2014',articles);self.assertIn('schedule:11',articles)
  ca='CALIFORNIA CONSUMER PRIVACY ACT effective 01/01/2026\nContents\n1798.100. Contents only\f'
  ca+='1798.100. General Duties\n(a) conditions and exceptions\n     1798.140.\n'
  ca+='\n'.join(f'1798.{n}. Example heading\n(a) conditions and exceptions' for n in range(101,145))+'\n1798.199.100.\n(a) final statutory section'
  sections,_,_=pdf.california(ca);self.assertEqual(len(sections),46);self.assertIn('main:1798.199.100',sections)
  with self.assertRaises(ValueError):pdf.singapore(sg.replace('ELEVENTH SCHEDULE','Missing schedule'))
 def test_eu_resolves_current_version_from_official_page_instead_of_assuming_pinned_date(self):
  source={**SOURCE,'parser':'eu-html','identity':['2016/679'],'resolver':'eu-current-consolidation','allowedHosts':['eur-lex.europa.eu']}
  landing=b'Current consolidated version <a href="?uri=CELEX:02016R0679-20261101">version</a>'
  body=b'2016/679<div id="art_1">Article 1 conditions and exceptions</div>'
  calls=[]
  def fetch(s,url):calls.append(url);return landing if len(calls)==1 else body
  with patch.object(w,'fetch_bytes',side_effect=fetch):result=w.read_official(source,'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng')
  self.assertEqual(result['version'],'CELEX:02016R0679-20261101');self.assertIn('20261101',calls[-1])
  with patch.object(w,'fetch_bytes',return_value=b'2016/679 without current edition link'):
   with self.assertRaises(w.SourceError):w.read_official(source,'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng')
 def test_fixed_edition_fallback_is_partial_and_retains_primary_failure(self):
  source={**SOURCE,'parser':'eu-html','identity':['2016/679'],'fallbackUrl':'https://laws.e-gov.go.jp/fixed','fallbackVersion':'fixed edition'}
  def fetch(s,url):
   if url==source['url']:raise w.SourceError('http_202')
   return b'2016/679<div id="art_1">Article 1 condition and exception</div>'
  with patch.object(w,'fetch_bytes',side_effect=fetch):result=w.fetch_source(source)
  self.assertEqual(result['coverage'],'fixed_official_edition');self.assertEqual(result['primaryError'],'http_202')
 def test_california_resolver_ignores_future_regulations_and_unapproved_object_hosts(self):
  source={**SOURCE,'parser':'california-pdf','url':'https://cppa.ca.gov/regulations/'}
  landing=b'<a href="/pdf/99990101_ccpa_statute.pdf">California Consumer Privacy Act (Effective future)</a><a href="https://evil.test/pdf/20260101_ccpa_statute.pdf">California Consumer Privacy Act (Effective now)</a><a href="/regulations/pdf/ccpa_statute_eff_20260101.pdf">CCPA Regulations (Effective now)</a><a href="/pdf/20260101_ccpa_statute.pdf">California Consumer Privacy Act (Effective January 1, 2026)</a>'
  calls=[]
  def fetch(s,url):calls.append(url);return landing if len(calls)==1 else b'%PDF-fake'
  with patch.object(w,'fetch_bytes',side_effect=fetch),patch.object(w,'parse_source',return_value=snapshot()):w.fetch_source(source)
  self.assertEqual(calls[-1],'https://cppa.ca.gov/pdf/20260101_ccpa_statute.pdf')
 def test_chinese_attachment_uses_public_official_endpoint_and_checks_the_index(self):
  from xml.sax.saxutils import escape
  source={**SOURCE,'parser':'chinese-docx','identity':['测试法'],'selectedId':'selected-id','url':'https://flk.npc.gov.cn/details','allowedHosts':['flk.npc.gov.cn'],'minimumArticles':2}
  data={'title':'测试法','bbbs':'selected-id','gbrq':'2021-08-20','sxrq':'2021-11-01','sxx':3,'ossFile':{'ossWordPath':'prod/20210820/'+'a'*32+'.docx'},'content':{'children':[{'title':'第一条'},{'title':'第二条'}]},'urlIn':'http://172.16.0.1/private'}
  def docx(paragraphs):
   stream=io.BytesIO();xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+''.join('<w:p><w:r><w:t>'+escape(p)+'</w:t></w:r></w:p>' for p in paragraphs)+'</w:body></w:document>'
   with zipfile.ZipFile(stream,'w') as archive:archive.writestr('word/document.xml',xml)
   return stream.getvalue()
  raw=docx(['测试法','第一条 为测试保留完整的条件和例外。','第二条 为测试保留另外的条件和例外。']);calls=[]
  def fetch(s,url):
   calls.append(url);return json.dumps({'data':data},ensure_ascii=False).encode() if url==source['url'] else raw
  with patch.object(w,'fetch_bytes',side_effect=fetch):result=w.fetch_source(source)
  self.assertEqual(set(result['articles']),{'main:1','main:2'});self.assertEqual(result['coverage'],'article_text');self.assertTrue(calls[-1].startswith('https://flk.npc.gov.cn/law-search/file/download?'));self.assertNotIn('172.16',str(calls));self.assertNotIn('保留',json.dumps(result,ensure_ascii=False))
  data['content']['children'].append({'title':'第三条'})
  with patch.object(w,'fetch_bytes',side_effect=fetch):
   with self.assertRaisesRegex(w.SourceError,'attachment_index_mismatch'):w.fetch_source(source)
  data['ossFile']['ossWordPath']='../private.docx'
  with patch.object(w,'fetch_bytes',side_effect=fetch):
   with self.assertRaisesRegex(w.SourceError,'unapproved_attachment_path'):w.fetch_source(source)
 def test_chinese_docx_rejects_wrong_archives_duplicate_members_and_noncontiguous_articles(self):
  import chinese_source as docx
  with self.assertRaises(ValueError):docx.document_paragraphs(b'not an archive')
  stream=io.BytesIO()
  with zipfile.ZipFile(stream,'w') as archive:archive.writestr('../word/document.xml','<x/>')
  with self.assertRaisesRegex(ValueError,'unsafe_docx_members'):docx.document_paragraphs(stream.getvalue())
  duplicate=io.BytesIO()
  with warnings.catch_warnings():
   warnings.simplefilter('ignore',UserWarning)
   with zipfile.ZipFile(duplicate,'w') as archive:
    archive.writestr('word/document.xml','<x/>');archive.writestr('word/document.xml','<y/>')
  with self.assertRaisesRegex(ValueError,'unsafe_docx_members'):docx.document_paragraphs(duplicate.getvalue())
  entity=io.BytesIO()
  with zipfile.ZipFile(entity,'w') as archive:archive.writestr('word/document.xml','<!DOCTYPE x [<!ENTITY ex SYSTEM "https://example.test/">]><x/>')
  with self.assertRaisesRegex(ValueError,'unsafe_docx_xml'):docx.document_paragraphs(entity.getvalue())
  with self.assertRaisesRegex(ValueError,'noncontiguous_docx_articles'):docx.article_bodies('第一条 完整测试条件和例外。\n第三条 缺失第二条的测试条件。',w.chinese_number)
if __name__=='__main__':unittest.main()
