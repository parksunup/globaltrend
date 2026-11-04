import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {productionWorkspaceOrigin} from '../lib/workspace-environment.ts';
const require=createRequire(import.meta.url);
const Empty=()=>null;
function render(readOnly,productionOrigin) {
 const data={commitSha:'a'.repeat(40),documents:{legal:[{criterionId:'extraterritorial_scope'}]},items:[],translations:[],translationErrors:[],trends:[],warnings:[],canPublish:true,databaseAvailable:true,legalPublications:[{recordId:'kr-pipa',title:'PIPA',jurisdiction:'KR',status:'ready'}]};
 let state=0;
 const hooks={...React,useEffect(){},useState(initial){state++;return [state===1?'legal':state===2?data:typeof initial==='function'?initial():initial,()=>{}]}};
 const exports={};
 const source=ts.transpileModule(readFileSync('app/components/live-team-workspace.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,console,URL,Map,Set,require(name){
  if(name==='react')return hooks;
  if(name==='react/jsx-runtime')return require(name);
  if(name.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
  if(name.endsWith('submission-documents'))return ()=>React.createElement('p',null,'읽을 수 있는 비교표');
  if(name.endsWith('translation-review')||name.endsWith('team-login')||name.endsWith('team-weekly-panel'))return Empty;
  if(name.endsWith('team-trend-publication')||name.endsWith('team-workspace-prompts')||name.endsWith('supabase/client'))return {};
  throw Error(name);
 }});
 return renderToStaticMarkup(React.createElement(exports.default,{role:'legal',readOnly,productionOrigin}));
}
test('Preview hides public mutations even when cached data says the editor can publish',()=>{
 const html=render(true,'https://production.example.test');
 assert.match(html,/미리보기에서는 자료를 공개할 수 없습니다/);
 assert.match(html,/href="https:\/\/production.example.test\/work\?role=legal"/);
 assert.match(html,/읽을 수 있는 비교표/);
 assert.doesNotMatch(html,/<button[^>]*>이 법률 공개<\/button>|<button[^>]*>공개하기<\/button>/);
 assert.doesNotMatch(html,/공개하려면 담당자 등록이 필요합니다/);
});
test('production retains editor publication controls and missing production URL is explained honestly',()=>{
 assert.match(render(false),/<button[^>]*>이 법률 공개<\/button>/);
 assert.match(render(true),/운영 주소가 연결되지 않았습니다/);
});
test('production navigation comes from the supplied project hostname, never a guessed Preview alias',()=>{
 assert.equal(productionWorkspaceOrigin('production.example.test'),'https://production.example.test');
 assert.equal(productionWorkspaceOrigin('https://production.example.test/path'),'https://production.example.test');
 for(const value of [undefined,'','http://insecure.test','javascript:bad','https://user:password@example.test'])assert.equal(productionWorkspaceOrigin(value),undefined);
});
