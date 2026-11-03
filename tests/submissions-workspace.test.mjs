import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {loadSubmittedStories} from '../lib/public-submission-preview.ts';
const require=createRequire(import.meta.url);
const uuid=n=>`51000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const story={id:'one',institution:'CURIA',title:'판례 동향',originalTitle:'Original judgment release',summary:'개인정보 판례 요약',details:'한국어 상세 본문',jurisdictions:['EU'],tags:['판례'],date:'2026.10.19',officialUrl:'https://curia.europa.eu/news/one'};
const law={recordId:'jp-appi',jurisdiction:'JP',contentHash:'b'.repeat(64),versionLabel:'2026',instrument:{title:'APPI',summary:'법제 설명'},availability:'translation',document:{sections:[]},cells:[]};
function moduleUnderTest({stories=[story],laws=[law]}={}){
  const exports={};const source=ts.transpileModule(readFileSync('lib/workspace-submissions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,process,console,require(name){if(name==='./public-submission-preview.ts'||name==='./public-submission-preview')return {loadSubmittedStories:typeof stories==='function'?stories:()=>stories};if(name==='./legal-release.ts'||name==='./legal-release')return {buildLegalReviewPackages:()=>laws};return require(name);}});return exports;
}
function fakeDb({sources=true,existing=false,edited=false,workingEdited=false,trashed=false,lawEdited=false,race=false}={}){
  const calls=[];const tables={sources:sources?[{id:uuid(1),publishers:{acronym:'CJEU'}}]:[],source_items:[],reports:[],publication_working_copies:[]};
  function populate(params){
    const sourceId=uuid(2),reportId=uuid(3),payload={title_ko:params.p_title_ko,one_line_summary_ko:params.p_summary_ko,detailed_summary_ko:params.p_details_ko,jurisdictions:params.p_jurisdictions,topics:params.p_topics};
    tables.source_items.push({id:sourceId,source_id:params.p_source_id,canonical_url:params.p_canonical_url,title_original:params.p_original_title,published_at:params.p_source_published_at});
    tables.reports.push({id:reportId,source_item_id:sourceId,...payload,...(edited?{detailed_summary_ko:'기존 편집된 본문'}:{})});
    tables.publication_working_copies.push({entity_type:'report',entity_id:reportId,revision:7,payload:{...payload,...(workingEdited?{title_ko:'다른 수정본 제목'}:{})},trashed_at:trashed?'2026-10-19':null});return reportId;
  }
  if(existing)populate({p_source_id:uuid(1),p_canonical_url:story.officialUrl,p_original_title:story.originalTitle,p_source_published_at:'2026-10-19T12:00:00Z',p_title_ko:story.title,p_summary_ko:story.summary,p_details_ko:story.details,p_jurisdictions:story.jurisdictions,p_topics:story.tags});
  const db={from(table){calls.push({table});let filters=[],limit=Infinity;const rows=()=>tables[table].filter(row=>filters.every(([key,value])=>key==='publishers.acronym'?row.publishers?.acronym===value:key==='is_active'?value===true:row[key]===value)).slice(0,limit);const b={select(){return b;},eq(key,value){filters.push([key,value]);return b;},limit(n){limit=n;return b;},async maybeSingle(){const data=rows();return {data:data[0]??null,error:data.length>1?{code:'PGRST116'}:null};},then(resolve,reject){return Promise.resolve({data:rows(),error:null}).then(resolve,reject);}};return b;},async rpc(name,params){calls.push({rpc:name,params});if(name==='create_report_draft'){const id=populate(params);return race?{data:null,error:{code:'23505'}}:{data:id,error:null};}if(name==='import_legal_review'){const id=uuid(4);tables.publication_working_copies.push({entity_type:'law',entity_id:id,revision:'8',payload:lawEdited?{...params.p_payload,versionLabel:'다른 수정본'}:params.p_payload,trashed_at:null});return {data:id,error:null};}throw Error(name);}};
  return {db,tables,calls};
}
const candidate=(m)=>m.loadAllTrendImportCandidates()[0];
const prepareTrend=(m,h,hash)=>m.prepareWorkspaceSubmission(h.db,'trend','repo-trend:one',hash??m.hashSubmission(candidate(m)));

test('all import candidates include the entire submitted corpus rather than just weekly examples',()=>{
  const m=moduleUnderTest({stories:loadSubmittedStories});const rows=m.loadAllTrendImportCandidates();
  assert.equal(rows.length,loadSubmittedStories().length);assert.ok(rows.length>7);assert.ok(new Set(rows.map(row=>row.source)).size>3);
  assert.ok(rows.every(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.publishedDate)&&row.details&&row.originalTitle));
});
test('submission hashes canonicalize object keys but retain array order and actual text',()=>{
  const m=moduleUnderTest();assert.equal(m.hashSubmission({a:1,b:{x:2,y:3}}),m.hashSubmission({b:{y:3,x:2},a:1}));
  assert.notEqual(m.hashSubmission(['a','b']),m.hashSubmission(['b','a']));assert.notEqual(m.hashSubmission({title:'전'}),m.hashSubmission({title:'후'}));
});
test('stale repository selection fails before querying or creating database content',async()=>{
  const m=moduleUnderTest(),h=fakeDb();await assert.rejects(prepareTrend(m,h,'f'.repeat(64)),error=>error.code==='40001');assert.equal(h.calls.length,0);
});
test('new trend resolves CURIA to registered CJEU source and returns its working-copy revision',async()=>{
  const m=moduleUnderTest(),h=fakeDb();const result=await prepareTrend(m,h);
  assert.equal(result.id,uuid(3));assert.equal(result.revision,'7');
  const created=h.calls.find(call=>call.rpc==='create_report_draft');assert.equal(created.params.p_source_id,uuid(1));assert.equal(created.params.p_details_ko,story.details);
});
test('identical existing source/report/working copy is reused without duplicate creation',async()=>{
  const m=moduleUnderTest(),h=fakeDb({existing:true});assert.equal((await prepareTrend(m,h)).id,uuid(3));assert.equal(h.calls.some(call=>call.rpc),false);
});
test('existing edited live report or different working copy cannot inherit repository publication approval',async()=>{
  const m=moduleUnderTest();for(const options of [{existing:true,edited:true},{existing:true,workingEdited:true},{existing:true,trashed:true}]){
    const h=fakeDb(options);await assert.rejects(prepareTrend(m,h),error=>error.code==='40001');assert.equal(h.calls.some(call=>call.rpc),false);
  }
});
test('changed original facts and an original without a report are held rather than overwritten',async()=>{
  const m=moduleUnderTest();for(const mutate of [h=>h.tables.source_items[0].published_at='2026-10-18T12:00:00Z',h=>h.tables.reports.splice(0)]){
    const h=fakeDb({existing:true});mutate(h);await assert.rejects(prepareTrend(m,h),error=>error.code==='40001');assert.equal(h.calls.some(call=>call.rpc),false);
  }
});
test('missing source is an explicit error; the helper never registers a source automatically',async()=>{
  const m=moduleUnderTest(),h=fakeDb({sources:false});await assert.rejects(prepareTrend(m,h),error=>error.code==='22023'&&error.message.includes('출처'));assert.equal(h.calls.some(call=>call.rpc),false);
});
test('duplicate source registration is held rather than choosing an arbitrary source',async()=>{
  const m=moduleUnderTest(),h=fakeDb();h.tables.sources.push({id:uuid(9),publishers:{acronym:'CJEU'}});await assert.rejects(prepareTrend(m,h),error=>error.code==='22023');
});
test('concurrent identical source insertion is safely reused after the unique constraint race',async()=>{
  const m=moduleUnderTest(),h=fakeDb({race:true});const result=await prepareTrend(m,h);assert.equal(result.id,uuid(3));assert.equal(h.calls.filter(call=>call.rpc==='create_report_draft').length,1);
});
test('law import requires its exact current content hash and returns a working revision',async()=>{
  const m=moduleUnderTest(),h=fakeDb();const result=await m.prepareWorkspaceSubmission(h.db,'law','repo-law:jp-appi',law.contentHash);assert.equal(result.id,uuid(4));assert.equal(result.revision,'8');assert.equal(h.calls[0].rpc,'import_legal_review');
  await assert.rejects(m.prepareWorkspaceSubmission(h.db,'law','repo-law:jp-appi','f'.repeat(64)),error=>error.code==='40001');
});
test('law working-copy differences are not silently imported as the selected repository version',async()=>{
  const m=moduleUnderTest(),h=fakeDb({lawEdited:true});await assert.rejects(m.prepareWorkspaceSubmission(h.db,'law','repo-law:jp-appi',law.contentHash),error=>error.code==='40001');
});
