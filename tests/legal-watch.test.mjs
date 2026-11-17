import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {validateWatchReport,lawImpact,reviewPacket} from '../lib/legal-watch.ts';
import {reportFromArchive,loadWatchReport,watchSources} from '../lib/legal-watch-data.ts';
const sources=watchSources();const initial=JSON.parse(readFileSync('data/legal-watch/initial-report.json','utf8'));
const changes={added:[],removed:[],modified:['main:3'],metadataChanged:false};
const event={id:'a'.repeat(64),kind:'source_changed',createdAt:'2026-11-16T00:00:00Z',beforeDigest:'b'.repeat(64),afterDigest:'c'.repeat(64),changes,reviewed:false};
const law={...initial.laws[0],status:'changed',coverage:'article_text',events:[event]};
const cell=(id,citation)=>({id,criterionName:id,articleNumbers:[citation],summary:'기존 설명과 조건',exceptions:'기존 예외와 기한',sourceVersion:'선정 판본'});
const p={contentHash:'d'.repeat(64),versionLabel:'이전 판본',cells:[cell('scope','제3조'),cell('rights','제4조')],recordId:'kr-pipa',instrument:{},document:null};
function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zip(files){const locals=[],central=[];let offset=0;for(const [name,value] of Object.entries(files)){const text=Buffer.from(value),bytes=deflateRawSync(text),filename=Buffer.from(name);const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(crc(text),14);l.writeUInt32LE(bytes.length,18);l.writeUInt32LE(text.length,22);l.writeUInt16LE(filename.length,26);locals.push(l,filename,bytes);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc(text),16);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(text.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=l.length+filename.length+bytes.length;}const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,end]);}
test('live initial report accounts for every configured law, including failures and partial coverage',()=>{
 const report=validateWatchReport(structuredClone(initial),sources);assert.equal(report.laws.length,sources.length);assert.ok(report.laws.some(l=>l.status==='error'));assert.ok(report.laws.some(l=>l.coverage==='index_and_status_only'));
 assert.throws(()=>validateWatchReport({...initial,laws:initial.laws.slice(1)},sources));assert.throws(()=>validateWatchReport({...initial,laws:[initial.laws[0],...initial.laws.slice(0,-1)]},sources));
});
test('article impact preserves explanations and exceptions and routes unmapped changes to full review',()=>{
 assert.deepEqual(lawImpact(law,p).cells.map(c=>c.id),['scope']);assert.equal(lawImpact(law,p).cells[0].exceptions,p.cells[0].exceptions);
 assert.equal(lawImpact({...law,events:[{...event,changes:{...changes,modified:['main:99']}}]},p).fullReview,true);
 assert.equal(lawImpact({...law,events:[{...event,changes:{...changes,modified:['supplement:2026:3']}}]},p).cells.length,2);
 assert.equal(lawImpact({...law,events:[{...event,kind:'baseline_review'}]},p).cells.length,2);
});
test('draft packet keeps a base hash and separate translation and comparison checks; never records publication',()=>{
 const packet=reviewPacket(law,p,initial);assert.equal(packet.basePayloadHash,p.contentHash);assert.deepEqual(packet.review,{translationReviewed:false,comparisonReviewed:false,published:false});assert.match(packet.request,/条件|조건/);assert.match(packet.request,/기존 담당 브랜치/);assert.equal(packet.comparison.cells[0].existingExceptions,p.cells[0].exceptions);assert.match(packet.status,/human_review/);
});
test('ZIP reader checks members, uncompressed size and CRC instead of extracting arbitrary paths',()=>{
 const valid=zip({'report.json':JSON.stringify(initial),'checkpoint.json':'{}'});assert.equal(reportFromArchive(valid).laws.length,7);
 assert.throws(()=>reportFromArchive(zip({'../report.json':'{}'})));assert.throws(()=>reportFromArchive(Buffer.from('not a zip')));
 const bad=Buffer.from(valid);const central=bad.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bad.writeUInt32LE(0,central+16);assert.throws(()=>reportFromArchive(bad));
 const bomb=Buffer.from(valid);bomb.writeUInt32LE(4_000_001,central+24);assert.throws(()=>reportFromArchive(bomb));
});
test('read-only Preview reads bundled metadata and never sends the GitHub token',async()=>{
 let calls=0;const loaded=await loadWatchReport({allowRemote:false,token:'secret',fetch:async()=>{calls++;throw Error('must not fetch');}});assert.equal(calls,0);assert.equal(loaded.source,'bundled');
});
test('trusted workflow artifact loads, and the signed blob request never receives authorization',async()=>{
 const raw=zip({'report.json':JSON.stringify(initial),'checkpoint.json':'{}'});let storage=0;
 const fetcher=async(url,init)=>{
  const u=String(url);if(u.endsWith('/zip')){assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://example.blob.core.windows.net/report.zip?signature=test'}});}
  if(u.startsWith('https://example.blob.core.windows.net/')){storage++;assert.equal(init.headers,undefined);return new Response(raw);}
  if(u.endsWith('/artifacts'))return Response.json({artifacts:[{id:12,name:'legal-amendment-watch',expired:false}]});
  return Response.json({workflow_runs:[{id:10,event:'schedule',head_branch:'main',head_repository:{full_name:'parksunup/globaltrend'},path:'.github/workflows/legal-amendment-watch.yml',status:'completed',conclusion:'success'}]});
 };
 const result=await loadWatchReport({token:'secret',fetch:fetcher});assert.equal(result.source,'github');assert.equal(storage,1);assert.match(result.runUrl,/runs\/10$/);
});
test('failed latest run or pull-request artifact cannot silently reset a review baseline',async()=>{
 for(const run of [{event:'pull_request',conclusion:'success'},{event:'schedule',conclusion:'failure'}]){
  const result=await loadWatchReport({token:'secret',fetch:async()=>Response.json({workflow_runs:[{id:10,head_branch:'main',head_repository:{full_name:'parksunup/globaltrend'},path:'.github/workflows/legal-amendment-watch.yml',status:'completed',...run}]})});assert.equal(result.connection,'unavailable');assert.equal(result.source,'bundled');
 }
});

// Exercise the server entry points with identity and data sources replaced, not production credentials.
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function server(file,state){
 const exports={};const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,console,Date,Response,process:{env:state.env??{}},require(name){
  if(name.endsWith('workspace-data'))return {workspaceSession:async()=>state.session??{user:null,canEdit:false}};
  if(name.endsWith('legal-watch-data'))return {loadWatchReport:async(options)=>{state.reads=(state.reads??0)+1;state.options=options;return {report:initial,source:'bundled',connection:'not_configured',stale:false};}};
  if(name.endsWith('legal-watch'))return {pendingEvents:l=>l.events.filter(e=>!e.reviewed),lawImpact,reviewPacket};
  if(name.endsWith('legal-release'))return {buildLegalReviewPackages:()=>[]};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='../frame')return {__esModule:true,default:({children})=>React.createElement('main',null,children)};
  if(name==='./review-controls')return {__esModule:true,default:({lawId})=>React.createElement('button',null,lawId+' 수정안 요청')};
  if(name.endsWith('.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
  return require(name);
 }});return exports;
}
test('status endpoint blocks anonymous and inactive roles before reading Actions artifacts',async()=>{
 for(const [session,status] of [[{user:null,canEdit:false},401],[{user:{id:'viewer'},canEdit:false},403]]){
  const state={session};const r=await server('app/api/legal-updates/status/route.ts',state).GET();assert.equal(r.status,status);assert.equal(state.reads,undefined);
 }
});
test('Preview status uses only safe bundled evidence and sends no private payload',async()=>{
 const state={env:{VERCEL_ENV:'preview'},session:{user:{id:'editor'},canEdit:true}};const response=await server('app/api/legal-updates/status/route.ts',state).GET();assert.equal(response.status,200);assert.equal(state.options.allowRemote,false);assert.match(response.headers.get('cache-control'),/private, no-store/);const body=await response.json();assert.equal(body.total,7);assert.ok(body.failed>0);assert.equal(body.laws,undefined);
});
test('monitor page distinguishes initial evidence, change candidates, limited checks and source failures',async()=>{
 const state={env:{VERCEL_ENV:'preview'},session:{user:{id:'editor'},canEdit:true}};const Component=server('app/work/legal-updates/page.tsx',state).default;const html=renderToStaticMarkup(await Component());
 assert.match(html,/초기 수동 점검/);assert.match(html,/변경 후보 발견/);assert.match(html,/목차·유효성만 확인/);assert.match(html,/공식 원문 확인 실패/);assert.match(html,/변경이 없다는 뜻이 아닙니다/);assert.match(html,/검토 후 공개/);assert.equal((html.match(/<section[^>]+id="(?:pipa|appi|pipl|gdpr|uk-gdpr|ccpa|pdpa)"/g)??[]).length,7);
});
test('production monitoring screen requires team membership and does not read results first',async()=>{
 const state={};const html=renderToStaticMarkup(await server('app/work/legal-updates/page.tsx',state).default());assert.match(html,/팀 계정으로 로그인/);assert.equal(state.reads,undefined);
});

test("artifact body links cannot point outside the configured official hosts",()=>{
 const report=structuredClone(initial);report.laws[0].acquiredUrl="https://evil.test/body";assert.throws(()=>validateWatchReport(report,sources),/invalid_official_body_url/);
});
