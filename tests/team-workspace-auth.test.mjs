import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as trendTools from '../lib/team-trends.ts';
import {teamWorkspacePrompt} from '../lib/team-workspace-prompts.ts';

function route(state) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync('app/api/team-workspace/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,Response,Request,URL,Error,console,process:{env:{}},fetch,require(name){
    if(name.endsWith('live-team-workspace'))return {createLiveWorkspaceReader:()=>async()=>{state.gitReads++;return {role:'trends',commitSha:'a'.repeat(40),items:[],trendEdits:[]};}};
    if(name.endsWith('team-trends'))return trendTools;
    if(name.endsWith('supabase/server'))return {createClient:async()=>({auth:{getUser:async()=>({data:{user:state.user}})},rpc:async(_name,args)=>{state.args=args;return state.result;}})};
    throw Error(name);
  }});
  return Object.assign(exports.GET,{PUT:exports.PUT});
}
const row={id:'12345678-1234-1234-1234-123456789abc',revision:'a'.repeat(32),title_ko:'제목',summary_ko:'요약',details_ko:'본문'};
test('anonymous requests cannot read DB drafts or trigger GitHub loading',async()=>{
  const state={gitReads:0,user:null};const get=route(state);
  const response=await get(new Request('https://example.test/api/team-workspace?role=trends'));
  assert.equal(response.status,401);assert.equal(state.gitReads,0);assert.equal((await response.json()).loginRequired,true);
});
test('authenticated draft reading is private and detects DB changes without a GitHub push',async()=>{
  const state={gitReads:0,user:{id:'test'},result:{data:{items:[row],total:1,nextOffset:null}}};const get=route(state);
  const first=await get(new Request('https://example.test/api/team-workspace?role=trends'));
  assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/private, no-store/);
  const etag=first.headers.get('etag');assert.equal((await first.json()).trends.length,1);
  assert.equal((await get(new Request('https://example.test/api/team-workspace?role=trends',{headers:{'if-none-match':etag}}))).status,304);
  state.result.data.items=[{...row,details_ko:'변경된 본문'}];
  const updated=await get(new Request('https://example.test/api/team-workspace?role=trends',{headers:{'if-none-match':etag}}));
  assert.equal(updated.status,200);assert.notEqual(updated.headers.get('etag'),etag);
});
test('invalid delegated connection is rejected, not downgraded to public draft access',async()=>{
  const state={gitReads:0,user:null,result:{error:{code:'42501',message:'denied'}}};
  const response=await route(state)(new Request('https://example.test/api/team-workspace?role=trends',{headers:{Authorization:'Bearer '+'b'.repeat(64)}}));
  assert.equal(response.status,403);assert.equal(state.gitReads,0);assert.match((await response.json()).error,/만료/);
});
test('role prompts preserve assigned branches and only trend connection includes the scoped key',()=>{
  const key='b'.repeat(64),connection={token:key,expiresAt:'2026-10-24'};
  const trend=teamWorkspacePrompt('trends','https://example.test',connection);
  assert.match(trend,/feat\/trend-source-contracts/);assert.match(trend,/Authorization: Bearer/);assert.match(trend,/운영 reports 테이블에 직접 쓰거나 발행하지/);
  const legal=teamWorkspacePrompt('legal','https://example.test',connection);
  assert.match(legal,/feat\/legal-corpus-foundation/);assert.equal(legal.includes(key),false);
});
test('workspace save rejects extra publication fields and reports concurrency conflicts',async()=>{
  const state={gitReads:0,result:{error:{code:'40001',message:'conflict'}}};const put=route(state).PUT;
  const entry={edit:{report_id:row.id,base_revision:row.revision,title_ko:'제목',summary_ko:'요약',details_ko:'본문'},expected_revision:0};
  const request=edits=>new Request('https://example.test/api/team-workspace?role=trends',{method:'PUT',headers:{Authorization:'Bearer '+'b'.repeat(64)},body:JSON.stringify({edits})});
  assert.equal((await put(request([{...entry,edit:{...entry.edit,status:'published'}}]))).status,400);
  assert.equal((await put(request([entry]))).status,409);
  state.result={data:{saved:1,published:false}};
  const saved=await put(request([entry]));assert.equal(saved.status,200);assert.deepEqual(await saved.json(),{saved:1,published:false});
  assert.equal((await put(new Request('https://example.test/api/team-workspace?role=trends',{method:'PUT',headers:{Origin:'https://evil.test'},body:JSON.stringify({edits:[entry]})}))).status,403);
});
