import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function loader(mocks={}) {
  const cache=new Map();
  return function load(filename) {
    filename=path.resolve(filename);if(cache.has(filename)) return cache.get(filename);
    const exports={};cache.set(filename,exports);
    const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(source,{exports,process,console,URL,
      require(name){
        if(name in mocks)return mocks[name];
        if(name==='next/link') return {default:({children,...props})=>React.createElement('a',props,children)};
        if(name.endsWith('.module.css'))return {default:{}};
        if(name.endsWith('submission-feedback'))return {default:()=>React.createElement('div',null,'feedback')};
        if(name.startsWith('.')){
          let next=path.resolve(path.dirname(filename),name);
          next=['.tsx','.ts',''].map(ext=>next+ext).find(file=>existsSync(file));return load(next);
        }
        return require(name);
      }});
    return exports;
  };
}
const section={id:'main-a1',group:'main',title:'제1조',context:'본칙',reviewStatus:'published',lines:[{id:'main-a1',label:'',text:'번역 본문'}]};
const props={lawId:'gdpr',title:'GDPR',officialName:'GDPR',officialUrl:'https://example.test',version:'2026',scopeNote:'사람 검수 미착수. 선정 조문 범위.',reviewStatus:'published',sections:[section]};
const cell={id:'test-KR',jurisdiction:'KR',criterionId:'test',criterionName:'테스트 기준',criterionOrder:1,summary:'비교 내용',status:'published',articleNumbers:['제1조'],translationLinks:[],exceptions:'',sourceVersion:'2026',sourceUrl:'https://example.test',pendingReason:'사람 검수 미착수'};

test('published translation uses current status while preserving original scope as historical details',()=>{
  const Component=loader()('app/components/translation-review.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Component,props));
  assert.match(html,/법제 전문 · 검수 완료·발행됨/);
  assert.match(html,/작성 당시 판본·번역 범위 기록/);
  assert.match(html,/현재 검수·발행 상태를 뜻하지 않습니다/);
  assert.doesNotMatch(html,/법제 전문 · 사람 검수 전 초안/);
});
test('unpublished translation is not marked reviewed by a global label',()=>{
  const Component=loader()('app/components/translation-review.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Component,{...props,reviewStatus:'not_started',scopeNote:'',sections:[{...section,reviewStatus:'not_started'}]}));
  assert.match(html,/미발행 · 제출 자료/);assert.doesNotMatch(html,/검수 완료·발행됨/);
});
test('published comparison preserves old pending notes as historical records',()=>{
  const Component=loader()('app/components/submission-documents.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Component,{documents:{legal:[cell],weekly:null}}));
  assert.match(html,/검수 완료·발행됨/);assert.match(html,/<summary>작성 당시 검토 기록<\/summary>/);
  assert.doesNotMatch(html,/작성된 내용은 모두 사람 검수 전/);assert.doesNotMatch(html,/>검수 필요 사항</);
});
test('submission lists reflect supplied publication status and archive obsolete review fields',()=>{
  const Component=loader()('app/components/submission-preview.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Component,{items:[{id:'trend-one',group:'trends',kind:'동향 표본',title:'발행 자료',subtitle:'EDPB',summary:'사람 검수 미착수 당시 설명',status:'published',fields:[{label:'검토 메모',value:'사람 검수 미착수'}],links:[],files:[]}],documents:{legal:[],weekly:null}}));
  assert.match(html,/검수 완료·발행됨/);assert.match(html,/작성 당시 기록 · 검토 메모/);assert.match(html,/<summary>작성 당시 설명<\/summary>/);
  assert.doesNotMatch(html,/이 배포 브랜치의 파일 · 검수 전 초안/);
});
test('translation review entry uses live legal workspace rather than overwriting submitted drafts with published DB data',async()=>{
  const load=loader({'../../lib/public-legal':{loadReviewedLegalDrafts:async()=>{throw Error('검수 화면에서 운영 발행본을 읽으면 안 됩니다.');}}});
  const Page=load('app/legal-translation/page.tsx').default;
  const element=await Page();
  assert.equal(element.props.role,'legal');
  const html=renderToStaticMarkup(element);
  assert.match(html,/최신 제출 자료를 불러오는 중/);assert.match(html,/PR 병합이나 자료별 사이트 재배포는 필요하지 않습니다/);
});
test('offline viewer describes historical files without declaring present review status',()=>{
  const Component=loader()('app/components/draft-viewer.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Component));
  assert.match(html,/파일 기록 · 현재 운영 검수 상태와 별개/);assert.doesNotMatch(html,/사람 검수는 미착수이며/);
});
