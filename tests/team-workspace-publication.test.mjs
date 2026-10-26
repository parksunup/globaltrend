import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function route({vercelEnv='production',user=null,member=null}={}) {
  const exports={};let dbReads=0,branchReads=0;
  const code=ts.transpileModule(fs.readFileSync('app/api/team-workspace/publication/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const db={auth:{getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:member,error:null})})})})};
  vm.runInNewContext(code,{exports,Response,Request,URL,Error,console,process:{env:{VERCEL_ENV:vercelEnv,NODE_ENV:'production'}},fetch,require(name){
    if(name.endsWith('next/cache'))return {revalidatePath:()=>{}};
    if(name.endsWith('supabase/server'))return {createClient:async()=>{dbReads++;return db;}};
    if(name.endsWith('live-team-workspace'))return {createLiveWorkspaceReader:()=>async()=>{branchReads++;return {commitSha:'a'.repeat(40)};}};
    if(name.endsWith('team-trends'))return {loadTeamTrendRows:async()=>[]};
    if(name.endsWith('workspace-submissions'))return {prepareLegalCandidate:async()=>{},prepareTrendCandidate:async()=>{}};
    throw Error(name);
  }});
  return {post:exports.POST,counts:()=>({dbReads,branchReads})};
}
const request=()=>new Request('https://example.test/api/team-workspace/publication',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({role:'trends',action:'publish',itemId:'12345678-1234-1234-1234-123456789abc',branchSha:'a'.repeat(40)})});

test('Preview cannot change real publication state',async()=>{
  const api=route({vercelEnv:'preview',user:{id:'user'},member:{role:'editor',is_active:true}});
  const response=await api.post(request());
  assert.equal(response.status,409);assert.match((await response.json()).error,/미리보기/);assert.deepEqual(api.counts(),{dbReads:0,branchReads:0});
});
test('publication requires a signed-in team editor',async()=>{
  const api=route();const response=await api.post(request());
  assert.equal(response.status,401);assert.deepEqual(api.counts(),{dbReads:1,branchReads:0});
});
test('reviewers cannot publish even when signed in',async()=>{
  const api=route({user:{id:'reviewer'},member:{role:'reviewer',is_active:true}});const response=await api.post(request());
  assert.equal(response.status,403);assert.deepEqual(api.counts(),{dbReads:1,branchReads:0});
});
