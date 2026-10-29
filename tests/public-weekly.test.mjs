import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadLatestPublicPodcast,podcastDisplayTitle} from '../lib/public-podcast.ts';

function fakeDb({episodes=[],issues=[],audio={signedUrl:'https://audio.example.test/episode'}}={}){
 const tables={weekly_podcast_episodes:episodes,weekly_issues:issues};
 const calls=[];
 return {calls,from(name){
  const filters=[];let limit=Infinity;
  const query={select(){return query},eq(field,value){filters.push(row=>row[field]===value);return query},in(field,values){filters.push(row=>values.includes(row[field]));return query},order(){return query},limit(value){limit=value;return query},then(resolve){calls.push(name);resolve({data:(tables[name]??[]).filter(row=>filters.every(predicate=>predicate(row))).slice(0,limit),error:null});}};
  return query;
 },storage:{from(){return {async createSignedUrl(){return audio instanceof Error?{data:null,error:audio}:{data:audio,error:null}}}}}};
}

test('home player reads the published podcast and its published issue',async()=>{
 const db=fakeDb({episodes:[{issue_key:'2026-W43',audio_path:'episode.mp4',audio_mime_type:'audio/mp4',published_at:'2026-10-29',status:'published'},{issue_key:'2026-W44',audio_path:'draft.mp4',status:'draft'}],issues:[{issue_key:'2026-W43',title:'국제요정: 심층 팟캐스트',description:'설명',week_start:'2026-10-05',week_end:'2026-10-11',status:'published'}]});
 const result=await loadLatestPublicPodcast(db);
 assert.equal(result.podcast?.title,'심층 팟캐스트');
 assert.equal(result.podcast?.audioUrl,'https://audio.example.test/episode');
 assert.deepEqual(db.calls,['weekly_podcast_episodes','weekly_issues']);
});

test('podcast display title only drops the leading brand prefix',()=>{
 assert.equal(podcastDisplayTitle('국제요정: 영국 ICO 발표'),'영국 ICO 발표');
 assert.equal(podcastDisplayTitle('국제요정이 분석한 발표'),'국제요정이 분석한 발표');
});

test('home player does not expose a podcast without a published issue or readable audio',async()=>{
 const episode={issue_key:'2026-W43',audio_path:'episode.mp4',status:'published',published_at:'2026-10-29'};
 const draft=fakeDb({episodes:[episode],issues:[{issue_key:'2026-W43',status:'draft'}]});
 assert.equal((await loadLatestPublicPodcast(draft)).podcast,null);
 const missingAudio=fakeDb({episodes:[episode],issues:[{issue_key:'2026-W43',status:'published'}],audio:new Error('denied')});
 assert.deepEqual(await loadLatestPublicPodcast(missingAudio),{podcast:null,unavailable:true});
});

test('home podcast player renders the monthly issue and edition label',()=>{
 const playerSource=fs.readFileSync(new URL('../app/public/home-podcast-player.tsx',import.meta.url),'utf8');
 const playerCode=ts.transpileModule(playerSource,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const player={exports:{}};
 new Function('require','module','exports',playerCode)(name=>name.endsWith('.css')?new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}):name==='next/link'?({href,children})=>React.createElement('a',{href},children):name.includes('weekly-label')?require('../lib/weekly-label.ts'):require(name),player,player.exports);
 const html=renderToStaticMarkup(React.createElement(player.exports.default,{podcast:{issueKey:'2026-10-W1-2',title:'주제',description:'소개',start:'2026-10-05',end:'2026-10-11',audioUrl:'https://audio.example.test/file',mime:'audio/mp4'}}));
 assert.ok(html.includes('2026년 10월 1주-2'));
 assert.ok(!html.includes('2026-10-W1-2'));
});

const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../app/public/weekly/written-weekly-report.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name.endsWith('.css')?new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}):name==='next/link'?({href,children})=>React.createElement('a',{href},children):name.includes('weekly-label')?require('../lib/weekly-label.ts'):require(name),mod,mod.exports);

test('written weekly view renders the eight selected reports and no podcast selection',()=>{
 const reports=Array.from({length:8},(_,i)=>({id:`report-${i}`,title_ko:`선정 동향 ${i+1}`,one_line_summary_ko:'한 줄 요약',detailed_summary_ko:'본문 첫 문단\n\n둘째 문단'}));
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,{issue:{issue_key:'2026-W43',title:'주간 동향 편집본',description:'',week_start:'2026-10-19',week_end:'2026-10-25',published_at:'2026-10-29'},reports}));
 assert.equal((html.match(/동향 자세히 보기/g)??[]).length,8);
 for(let i=1;i<=8;i++)assert.ok(html.includes(`선정 동향 ${i}`));
 assert.ok(!html.includes('팟캐스트용 주요 주제'));
 assert.ok(html.includes('본문 첫 문단')&&html.includes('둘째 문단'));
 assert.ok(html.includes('2026년 10월 3주'));
 assert.ok(!html.replace(/<[^>]*>/g,'').includes('2026-W43'));
});

test('written and podcast archives offer every issue in a dropdown selector',()=>{
 const source=fs.readFileSync(new URL('../app/public/weekly/weekly-issue-picker.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
  new Function('require','module','exports',code)(name=>name.endsWith('.css')?new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}):name==='next/navigation'?({useRouter:()=>({push:()=>{}})}):name.includes('weekly-label')?require('../lib/weekly-label.ts'):require(name),mod,mod.exports);
 const issues=Array.from({length:60},(_,i)=>({issue_key:`2026-01-W1-${i+1}`,title:`제${i}호`,week_start:'2026-01-05',week_end:'2026-01-11'}));
 for(const basePath of ['/public/weekly','/public/weekly/podcast']){
  const podcast=basePath.endsWith('/podcast');
  const html=renderToStaticMarkup(React.createElement(mod.exports.default,{issues,selectedKey:issues[59].issue_key,basePath,label:'지난 호',podcast}));
  assert.equal((html.match(/<option/g)??[]).length,60);
  assert.ok(html.includes('value="2026-01-W1-60" selected=""'));
  assert.ok(html.includes(podcast?'2026년 1월 1주-60':'2026년 1월 1주'));
  assert.ok(!/2026-W\d{2}/.test(html));
  assert.ok(html.includes('지난 호 선택'));
 }
});
