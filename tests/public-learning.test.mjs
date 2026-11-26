import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {learningTopics,learningTopic,learningCountriesFor,learningHref,learningComparisonHref,matchedLearningTopics} from '../lib/public-learning.ts';
import {loadSubmissionDocuments} from '../lib/submission-preview.ts';
const require=createRequire(import.meta.url);
function loadComponent(filename,mocks={}) {
 const cache=new Map();
 function load(file) {
  file=path.resolve(file);if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{exports,console,URL,URLSearchParams,Map,Set,Promise,require(name){
   if(name in mocks)return mocks[name];
   if(name.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
   if(name==='next/link')return ({children,prefetch,...props})=>React.createElement('a',props,children);
   if(name.startsWith('.')){const next=path.resolve(path.dirname(file),name);return load([next+'.tsx',next+'.ts',next].find(existsSync));}
   return require(name);
  }});return exports;
 }
 return load(filename).default;
}
test('six reading questions refer to real criteria and preserve the existing legal corpus',()=>{
 const cells=loadSubmissionDocuments().legal;assert.equal(learningTopics.length,6);assert.equal(new Set(learningTopics.map(topic=>topic.id)).size,6);
 for(const topic of learningTopics){assert.ok(cells.some(cell=>cell.criterionId===topic.criterion));assert.equal(topic.questions.length,4);assert.ok(topic.relevance);assert.equal('everyday' in topic,false);assert.equal('work' in topic,false);}
});
test('topic suggestions use visible report metadata and avoid spurious AI substrings or invented matches',()=>{
 assert.equal(matchedLearningTopics({title:'해외사업자 적용 안내',summary:'',tags:[]})[0].id,'overseas-services');
 assert.deepEqual(matchedLearningTopics({title:'AI 서비스',summary:'',tags:[]}),[]);
 assert.equal(matchedLearningTopics({title:'개인정보 이용 동의와 처리근거 안내',summary:'',tags:[]})[0].id,'processing-basis');
 assert.deepEqual(matchedLearningTopics({title:'Daily mail notice',summary:'정기 행사',tags:[]}),[]);
 assert.deepEqual(matchedLearningTopics({title:'청년 행사',summary:'',tags:[]}),[]);
 assert.equal(matchedLearningTopics({title:'안내',summary:'',tags:['개인정보유출']})[0].id,'breaches');
});
test('shareable learning URLs validate inputs and countries without an audience split',()=>{
 assert.equal(learningTopic('//outside.test').id,learningTopics[0].id);
 assert.deepEqual(learningCountriesFor(['KR','EU','EU','ZZ'],['JP']),['KR','EU']);assert.deepEqual(learningCountriesFor([],['JP']),['JP']);
 const url=new URL(learningHref('children',['KR','EU','ZZ']),'https://example.test');assert.equal(url.pathname,'/public/explore');assert.equal(url.searchParams.has('audience'),false);assert.deepEqual(url.searchParams.getAll('country'),['KR','EU']);
 const comparison=new URL(learningComparisonHref(learningTopic('children'),['KR','EU']),'https://example.test');assert.equal(comparison.searchParams.get('criterion'),'children_information');assert.equal(comparison.searchParams.get('countries'),'KR,EU');
});
const cell={id:'children_information--KR',criterionId:'children_information',criterionOrder:10,criterionName:'아동 개인정보',jurisdiction:'KR',summary:'선정 판본의 실제 요약',exceptions:'조건과 예외를 보존합니다.',articleNumbers:['제22조의2'],translationLinks:[],sourceUrl:'https://official.example.test/law',sourceVersion:'선정 판본',pendingReason:'사람 검수 미착수',status:'unreviewed'};
const story={id:'report-1',title:'아동 개인정보 안내',summary:'공개 동향의 핵심 요약',tags:['아동'],region:'한국',date:'2026.11.05'};
async function explorer({legal={cells:[cell],documents:[{id:'pipa',jurisdiction:'KR'}]},stories=[story],params={topic:'children',audience:'work',country:['KR','EU']}}={}) {
 const Component=loadComponent('app/public/explore/page.tsx',{
  '../public-navigation':{PublicHeader:()=>null,PublicFooter:()=>null},
  '../../../lib/public-legal':{loadPublicLegal:async()=>{if(legal instanceof Error)throw legal;return legal;}},
  '../../../lib/public-content':{loadPublicStories:async()=>{if(stories instanceof Error)throw stories;return stories;}},
  '../../../lib/legal-release':{citedLegalPreview:()=>({anchorId:'pipa-a22-2'})},
  '../../../lib/public-submission-preview':{publicSubmissionPreviewEnabled:()=>false},
 });
 return renderToStaticMarkup(await Component({searchParams:Promise.resolve(params)}));
}
test('unified questions connect to unchanged comparison evidence, exceptions, original source and article anchor',async()=>{
 const html=await explorer();assert.match(html,/선정 판본의 실제 요약/);assert.match(html,/조건과 예외를 보존합니다/);assert.match(html,/사람 검수 미착수/);assert.match(html,/함께 확인할 사항/);assert.doesNotMatch(html,/설명의 관점|생활 속에서 이해하기|업무에서 확인하기|name="audience"/);
 assert.match(html,/pipa-a22-2/);assert.match(html,/official.example.test\/law/);assert.match(html,/criterion=children_information/);assert.match(html,/아동 개인정보 안내/);assert.match(html,/이 기준의 비교 자료는 아직 공개되어 있지 않습니다/);
 assert.doesNotMatch(html,/검수 완료/);
});
test('outages and successful empty public results remain distinguishable without leaking server errors',async()=>{
 const unavailable=await explorer({legal:new Error('private upstream diagnostic'),stories:new Error('database password')});assert.match(unavailable,/법제 자료 연결을 확인하지 못했습니다/);assert.match(unavailable,/동향 자료를 불러오지 못했습니다/);assert.doesNotMatch(unavailable,/private upstream|database password/);
 const empty=await explorer({legal:{cells:[],documents:[]},stories:[]});assert.match(empty,/아직 공개되어 있지 않습니다/);assert.match(empty,/자료를 찾지 못했습니다/);assert.doesNotMatch(empty,/연결을 확인하지 못했습니다/);
});
test('unrelated stories are not presented as evidence for the selected question',async()=>{
 const html=await explorer({stories:[{...story,title:'감독기관 정기 행사',summary:'기관 소식',tags:[]}]});assert.doesNotMatch(html,/감독기관 정기 행사/);
});
test('relevance panel presents one shared set of prompts without user-group controls',()=>{
 const Component=loadComponent('app/public/trends/trend-relevance.tsx');
 const html=renderToStaticMarkup(React.createElement(Component,{topicIds:['children'],countries:['KR','EU']}));assert.match(html,/아동 연령 기준/);assert.match(html,/읽기 안내입니다/);assert.match(html,/이 동향에서 확인할 사항/);assert.doesNotMatch(html,/audience=|aria-pressed|확인 질문 선택/);
 const fallback=renderToStaticMarkup(React.createElement(Component,{topicIds:[]}));assert.match(fallback,/추가 안내를 공식 원문에서 확인/);assert.doesNotMatch(fallback,/이 사건에는/);
});
test('old everyday and work URLs resolve to identical shared content and new links drop the old parameter',async()=>{
 const params={topic:'children',country:['KR','EU']};
 const everyday=await explorer({params:{...params,audience:'everyday'}}),work=await explorer({params:{...params,audience:'work'}});
 assert.equal(everyday,work);assert.doesNotMatch(everyday,/audience=|name="audience"/);
});

test('the fifth question explains processing grounds rather than an AI-specific service, with compatible old links',async()=>{
 const topic=learningTopics[4];assert.equal(topic.id,'processing-basis');assert.equal(topic.criterion,'processing_basis_use');assert.equal(topic.question,'내 개인정보를 이용하려면 꼭 동의를 받아야 하나요?');
 assert.equal(learningTopic('ai-and-data'),topic);assert.match(learningHref('ai-and-data'),/topic=processing-basis/);
 const current=await explorer({params:{topic:'processing-basis',country:['KR','EU']}}),legacy=await explorer({params:{topic:'ai-and-data',country:['KR','EU']}});
 assert.equal(current,legacy);assert.match(current,/동의가 필요한 경우와 그 밖의 처리근거/);assert.match(current,/criterion=processing_basis_use/);assert.doesNotMatch(current,/AI 서비스|입력·학습·출력|searchParams.*인공지능/);
});
