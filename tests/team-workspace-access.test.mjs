import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);

test('submitted review pages and API do not require Supabase configuration or a session; work routes still do',async()=>{
  let authCalls = 0;
  const exports = {};
  const source = ts.transpileModule(readFileSync('middleware.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(source,{exports,process:{env:{}},require(name){
    if(name==='next/server')return {NextResponse:{next:()=>({passed:true})}};
    if(name==='@supabase/ssr')return {createServerClient(){authCalls++;return {auth:{getUser:async()=>({})}};}};
    return require(name);
  }});
  for(const pathname of ['/team','/api/team-workspace','/legal-drafts','/legal-translation','/legal-translation/gdpr']){
    assert.equal((await exports.middleware({nextUrl:{pathname}})).passed,true);
    assert.equal(authCalls,0,pathname+' should not initialize auth');
  }
  await exports.middleware({nextUrl:{pathname:'/work'}});
  assert.equal(authCalls,1,'editor authorization remains unchanged');
});
