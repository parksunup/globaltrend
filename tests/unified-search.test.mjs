import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {parseSearchFilters,rankPublicDocuments,searchHref,quickSearchQuestions,normalizeSearchText} from '../lib/unified-search.ts';
import {semanticSearch} from '../lib/search-semantic-provider.ts';
const require=createRequire(import.meta.url);
const doc=(extra={})=>({id:'article:gdpr:main-a3',kind:'article',title:'제3조 적용 범위',text:'EU 역외 적용의 조건과 예외를 확인한다.',url:'/public/laws/gdpr#main-a3',jurisdictions:['EU'],tags:['GDPR'],date:'',version:'2016-05-04 선정 판본',sourceUrl:'https://eur-lex.europa.eu/',lawId:'gdpr',lawTitle:'GDPR',...extra});
const trend=doc({id:'trend:one',kind:'trend',title:'아동 개인정보 안내',text:'미성년자 연령 확인 안내',jurisdictions:['KR'],tags:['아동'],date:'2026-11-08',url:'/public/trends/61000000-0000-4000-8000-000000000001',lawTitle:undefined});
test('query parsing validates lengths, real dates, calendar periods and shared filters',()=>{
 assert.equal(normalizeSearchText('ＧＤＰＲ Article 3'),'gdpr 제3조');
 const f=parseSearchFilters({q:'  아동  ',country:['UK,GB','KR','../x'],scope:'laws',mode:'concept',page:'-3'});assert.equal(f.q,'아동');assert.deepEqual(f.countries,['GB','KR']);assert.equal(f.scope,'laws');assert.equal(f.mode,'hybrid');assert.equal(f.page,1);
 assert.ok(parseSearchFilters({q:'x'.repeat(301)}).errors.length);assert.ok(parseSearchFilters({q:'!!!'}).errors.length);assert.ok(parseSearchFilters({from:'2026-02-30'}).errors.length);assert.ok(parseSearchFilters({from:'2026-03-01',to:'2026-02-01'}).errors.length);
 assert.equal(parseSearchFilters({period:'최근 1개월'},new Date('2026-03-31T00:00:00Z')).from,'2026-02-28');
 const u=new URL(searchHref(f),'https://example.test');assert.equal(u.pathname,'/public/search');assert.deepEqual(u.searchParams.getAll('country'),['GB','KR']);assert.equal(u.searchParams.get('scope'),'laws');
});
test('free questions map to the six existing reading criteria and keyword mode does not pretend to expand them',()=>{
 const ids=['extraterritorial_scope','children_information','cross_border_transfer','data_subject_rights','processing_basis_use','breach_notification'];
 assert.equal(quickSearchQuestions.length,6);
 for(let i=0;i<ids.length;i++){
  const comparison=doc({id:'comparison:'+i,kind:'comparison',title:'조항 분류',text:'선정 비교 근거',tags:[],lawTitle:undefined,criterionId:ids[i]});
  const hits=rankPublicDocuments([comparison],parseSearchFilters({q:quickSearchQuestions[i]}));assert.equal(hits.length,1,quickSearchQuestions[i]);assert.ok(hits[0].reasons.some(reason=>reason.includes('관련 표현')));
 }
 assert.equal(rankPublicDocuments([doc({title:'아동 보호',text:'아동의 권리',tags:[],lawTitle:undefined})],parseSearchFilters({q:'아이',mode:'keyword'})).length,0);
});
test('exact legal names and article numbers outrank unrelated weak semantic matches',()=>{
 const rows=[doc(),doc({id:'other',title:'제99조',text:'일반 규정',tags:[],lawTitle:'다른 법률'})];
 const hits=rankPublicDocuments(rows,parseSearchFilters({q:'GDPR 제 3 조'}),[{id:'other',score:.76}]);assert.equal(hits[0].document.id,rows[0].id);assert.ok(hits[0].reasons.includes('검색어 일치'));
});
test('semantic results must belong to the current public corpus and are labelled separately',()=>{
 const f=parseSearchFilters({q:'미지의질문'});const rows=[doc()];
 const hits=rankPublicDocuments(rows,f,[{id:rows[0].id,score:.9},{id:'withdrawn-private-record',score:1}]);assert.equal(hits.length,1);assert.deepEqual(hits[0].reasons,['의미가 가까운 자료']);
 assert.equal(rankPublicDocuments(rows,f,[{id:rows[0].id,score:NaN}]).length,0);assert.equal(rankPublicDocuments(rows,{...f,mode:'keyword'},[{id:rows[0].id,score:.9}]).length,0);
});
test('country, topic, scope and publication date filters do not confuse statute versions with trend dates',()=>{
 const rows=[trend,doc({title:'아동 개인정보',text:'아동 보호',tags:['아동']})];
 const all=rankPublicDocuments(rows,parseSearchFilters({q:'아동',from:'2026-11-09'}));assert.equal(all.length,1);assert.equal(all[0].document.kind,'article');
 assert.equal(rankPublicDocuments(rows,parseSearchFilters({q:'아동',country:'KR',scope:'trends',topic:'children'})).length,1);
 assert.equal(rankPublicDocuments(rows,parseSearchFilters({q:'아동',country:'CN'})).length,0);
});
test('optional semantic provider is off by default and degrades safely without paid service or private errors',async()=>{
 let calls=0;assert.deepEqual(await semanticSearch('질문',[doc()],{url:'',fetch:async()=>{calls++;throw Error();}}),{state:'off',hits:[]});assert.equal(calls,0);
 assert.equal((await semanticSearch('질문',[doc()],{url:'http://remote.invalid/search',fetch:async()=>{calls++;}})).state,'unavailable');assert.equal(calls,0);
 const active=await semanticSearch('질문',[doc()],{url:'http://127.0.0.1:8766/search',token:'test-token',fetch:async(_url,init)=>{calls++;assert.equal(init.headers.Authorization,'Bearer test-token');assert.equal(JSON.parse(init.body).documents[0].id,doc().id);return Response.json({hits:[{id:doc().id,score:.95},{id:'private',score:1},{id:doc().id,score:2}]});}});
 assert.equal(active.state,'active');assert.deepEqual(active.hits,[{id:doc().id,score:.95}]);
 const failed=await semanticSearch('질문',[doc()],{url:'https://encoder.example.test/search',fetch:async()=>{throw Error('secret service detail');}});assert.deepEqual(failed,{state:'unavailable',hits:[]});
 const oversized=await semanticSearch('질문',[doc()],{url:'http://127.0.0.1:8766/search',fetch:async()=>new Response('x'.repeat(200001))});assert.equal(oversized.state,'unavailable');
});
function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports,console,URL,URLSearchParams,Map,Set,Date,Intl,process,require(name){if(name in mocks)return mocks[name];if(name==='next/link')return ({children,prefetch,...props})=>React.createElement('a',props,children);if(name.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});if(name.startsWith('.')){const next=path.resolve(path.dirname(file),name);return load([next,next+'.ts',next+'.tsx'].find(existsSync));}return require(name);}});return exports;}return load;}
test('catalog excludes drafts, pending review notes and unsafe source URLs',()=>{
 const {publicSearchDocuments}=loader({'./published-trends':{},'./public-legal':{}})('lib/unified-search-data.ts');
 const story={id:'one',publicationStatus:'published',title:'동향',summary:'공개 요약',details:'공개 본문',country:'KR',jurisdictions:['KR'],tags:[],originalTitle:'Original',institution:'기관',date:'2026.11.08',officialUrl:'javascript:bad'};
 const cell={id:'scope--KR',status:'published',criterionId:'law_application_scope',criterionName:'법 적용 대상',jurisdiction:'KR',summary:'공개 요약',exceptions:'예외 보존',articleNumbers:['제3조'],sourceVersion:'판본',sourceUrl:'https://official.example.test',pendingReason:'PRIVATE REVIEW NOTE'};
 const law={id:'pipa',jurisdiction:'KR',title:'한국법',officialName:'법',version:'판본',reviewStatus:'official',officialUrl:'https://official.example.test',sections:[{id:'pipa-제3조',title:'제3조',context:'본칙',lines:[{text:'공개 조문'}]}]};
 const rows=publicSearchDocuments([story,{...story,id:'draft',publicationStatus:'draft'}],{cells:[cell,{...cell,id:'draft',status:'unreviewed'}],documents:[law,{...law,id:'unreviewed',reviewStatus:'not_started'}],instruments:[]});
 assert.equal(rows.length,3);assert.equal(rows[0].sourceUrl,'');assert.ok(rows.some(row=>row.url.includes(encodeURIComponent('pipa-제3조'))));assert.ok(!JSON.stringify(rows).includes('PRIVATE REVIEW NOTE'));
});
async function renderSearch({params={q:'아동'},sources={trends:true,laws:true},documents=[trend,doc({title:'아동 개인정보',text:'아동의 조건과 예외'})]}={}){
 let requests=0;const Component=loader({'../public-navigation':{PublicHeader:()=>null,PublicFooter:()=>null},'../../../lib/unified-search-data':{loadPublicSearchCorpus:async()=>{requests++;return {sources,documents};}},'../../../lib/search-semantic-provider':{semanticSearch:async()=>({state:'off',hits:[]})}})('app/public/search/page.tsx').default;
 return {html:renderToStaticMarkup(await Component({searchParams:Promise.resolve(params)})),requests};
}
test('unified screen groups public news and laws, preserves back links, and states the real search method',async()=>{
 const {html}=await renderSearch();assert.match(html,/동향/);assert.match(html,/법제·근거 조문/);assert.match(html,/공식 출처 게시일/);assert.match(html,/선정 판본/);assert.match(html,/back=/);assert.match(html,/단어와 정해진 관련 표현/);assert.doesNotMatch(html,/의미가 가까운 자료를 함께 찾았습니다/);
});
test('empty queries do not fetch a corpus and partial outages are not reported as absent law',async()=>{
 const empty=await renderSearch({params:{}});assert.equal(empty.requests,0);assert.match(empty.html,/빠르게 시작하기/);assert.equal((empty.html.match(/class="quick"/g)??[]).length,1);
 const partial=await renderSearch({sources:{trends:true,laws:false},documents:[trend]});assert.match(partial.html,/법제 자료 연결을 확인하지 못했습니다/);assert.match(partial.html,/아동 개인정보 안내/);assert.doesNotMatch(partial.html,/현재 공개 법제에서 일치하는 자료를 찾지 못했습니다/);
});
test('public legal search never uses Preview draft fallback',async()=>{
 let draftCalls=0;const load=loader({'@supabase/supabase-js':{createClient:()=>{throw Error('must not connect without settings');}},'./legal-release':{reviewedDraftLegalBundle:()=>{draftCalls++;return {};},publishedLegalBundle:()=>({cells:[],documents:[],instruments:[]})},'./public-submission-preview':{publicSubmissionPreviewEnabled:()=>true},'./public-legal-schema':{},'./official-pipa':{}})('lib/public-legal.ts');
 // No production or Preview SDK connection exists in this test; missing settings must not select repository drafts.
 const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 try{await assert.rejects(()=>load.loadPublishedLegalForSearch(),/not configured/);assert.equal(draftCalls,0);}finally{if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousKey;}
});
test('search links keep published snapshots through comparison and article navigation in Preview',async()=>{
 let publishedCalls=0;
 const mocks={'../../../lib/public-legal':{loadPublishedLegalForSearch:async()=>{publishedCalls++;return {cells:[],documents:[],instruments:[]};},loadPublicLegal:async()=>{throw Error('must not use Preview working copy');}},'../../../lib/public-submission-preview':{publicSubmissionPreviewEnabled:()=>true},'../../../lib/legal-release':{},'./public-law-compare':{default:()=>null,__esModule:true}};
 const page=loader(mocks)('app/public/laws/page.tsx').default;
 const element=await page({searchParams:Promise.resolve({published:'1',back:'/public/search?q=GDPR',view:'compare'})});
 assert.equal(publishedCalls,1);assert.equal(element.props.publishedOnly,true);assert.equal(element.props.draftMode,false);assert.equal(element.props.searchReturnTo,'/public/search?q=GDPR');
 const textPage=loader({'next/navigation':{notFound:()=>{throw Error('not found');}},'../../../../lib/public-legal':{loadPublishedLegalForSearch:async()=>{publishedCalls++;return {documents:[{id:'gdpr'}]};},loadPublicLegal:async()=>{throw Error('must not use Preview working copy');}},'../../public-navigation':{PublicHeader:()=>null,PublicFooter:()=>null},'../public-law-reader':{default:()=>null,__esModule:true}})('app/public/laws/[lawId]/page.tsx').default;
 await textPage({params:Promise.resolve({lawId:'gdpr'}),searchParams:Promise.resolve({back:'/public/laws?view=compare&published=1'})});
 assert.equal(publishedCalls,2);
});
