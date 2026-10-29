import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../app/work/weekly/weekly-editor.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name.endsWith('.css')?new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}):name.includes('weekly-priority')?require('../lib/weekly-priority.ts'):require(name),mod,mod.exports);
test('weekly editing preview renders eight selected reports, all remaining items and all have selectable Korean drafts',()=>{
 const candidates=Array.from({length:11},(_,i)=>({id:String(i),title:`기사 ${i}`,summary:'요약',details:'본문',date:'2026-10-20',source:'기관',url:'https://example.test',status:'draft',documentType:'press_release',topics:[],jurisdictions:[]}));
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,{candidates,initialIds:candidates.slice(0,8).map(c=>c.id),notes:{},issueKey:'2026-W43',title:'주간호',start:'2026-10-19',end:'2026-10-25',save:async()=>{}}));
 assert.equal((html.match(/name="report"/g)??[]).length,8);
 assert.ok(html.includes('같은 주의 나머지 동향'));assert.ok(html.includes('3건'));
 for(let i=0;i<11;i++)assert.ok(html.includes(`기사 ${i}`));
 assert.ok(!html.includes('한국어 초안 작성 전'));assert.ok(html.includes('작업실 주간호 편집본'));assert.ok(html.includes('주요 동향 8/8건'));
});
test('published weekly issues stay editable and clearly say saved changes go live immediately',()=>{
 const candidate={id:'1',title:'공개 기사',summary:'요약',details:'본문',date:'2026-10-20',source:'기관',url:'https://example.test',status:'published',documentType:'press_release',topics:[],jurisdictions:[]};
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,{candidates:[candidate],initialIds:[candidate.id],notes:{},issueKey:'2026-W43',title:'공개 주간호',start:'2026-10-19',end:'2026-10-25',save:async()=>{},published:true}));
 assert.ok(html.includes('공개 중 · 변경 사항은 저장 즉시 반영'));
 assert.ok(html.includes('주요 동향 1/8건'));
 assert.match(html,/type="checkbox" aria-label="공개 기사 주간호 포함" checked=""/);
 assert.doesNotMatch(html,/aria-label="공개 기사 주간호 포함" disabled=""/);
});
test('a missing saved report can be unchecked, but cannot be saved back into the issue',()=>{
 const candidate={id:'missing-report',title:'목록에서 찾지 못한 원고',summary:'현재 목록에서 빠진 저장 자료',details:'',date:'',source:'',url:'',status:'missing',documentType:'',topics:[],jurisdictions:[]};
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,{candidates:[candidate],initialIds:[candidate.id],notes:{},issueKey:'2026-W43',title:'주간호',start:'2026-10-19',end:'2026-10-25',save:async()=>{}}));
 assert.ok(html.includes('저장 전에 목록에서 찾지 못한 자료의 체크를 해제해 주세요.'));
 assert.match(html,/aria-label="목록에서 찾지 못한 원고 주간호 포함" checked=""/);
 assert.match(html,/type="submit" disabled=""/);
});
