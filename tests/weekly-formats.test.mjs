import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/public/weekly/weekly-formats.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const module={exports:{}};
vm.runInNewContext(js,{exports:module.exports,require:name=>name==='next/link'?{__esModule:true,default:props=>React.createElement('a',props)}:name.endsWith('.css')?{formats:'formats'}:require(name)});
const Formats=module.exports.default;
test('both formats remain reachable and the selected page is unambiguous',()=>{
 for(const active of ['written','podcast']){
  const html=renderToStaticMarkup(React.createElement(Formats,{active}));
  assert.match(html,/주간 동향/);assert.match(html,/팟캐스트/);assert.doesNotMatch(html,/서면/);
  const href=active==='written'?'/public/weekly':'/public/weekly/podcast';
  assert.ok(html.includes(`href="${href}" aria-current="page"`));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 }
});
test('written weekly issues render text and do not query or require podcast audio',()=>{
 const written=readFileSync(new URL('../app/public/weekly/page.tsx',import.meta.url),'utf8');
 const podcast=readFileSync(new URL('../app/public/weekly/podcast/page.tsx',import.meta.url),'utf8');
 assert.match(written,/<WeeklyFormats active="written"/);assert.match(podcast,/<WeeklyFormats active="podcast"/);
 assert.match(written,/detailed_summary_ko/);assert.doesNotMatch(written,/\.from\("weekly_podcast_episodes"\)|<audio/);
 assert.match(podcast,/<audio controls/);assert.doesNotMatch(written,/그 주에 발행된 팟캐스트를 호별로 모아/);
 assert.doesNotMatch(written+podcast,/서면/);
});
