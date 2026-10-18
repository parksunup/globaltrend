import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
const id='10000000-0000-0000-0000-000000000001',target={id,kind:'trend',revision:'1'};
function load({role='admin',preview=false,errors={},prepared}={}) {
 const calls=[],paths=[];const exports={};
 const db={from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:{payload:{key_points:[{text:'보존'}]}},error:null})})}),rpc:async(name,params)=>{calls.push({name,params});return {data:{entity_id:params.p_entity_id,revision:2},error:errors[params.p_entity_id]??null};}};
 const source=ts.transpileModule(readFileSync('app/work/workspace-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,console,process:{env:{VERCEL_ENV:preview?'preview':'production'}},require:name=>name==='next/cache'?{revalidatePath:p=>paths.push(p)}:name.includes('workspace-submissions')?{prepareWorkspaceSubmission:async()=>{if(!prepared)throw new Error('changed');return prepared;}}:{workspaceSession:async()=>({db,canEdit:['admin','editor'].includes(role),canPublish:role==='admin'})}});
 return {run:exports.executeWorkspaceAction,calls,paths};
}
test('preview and editor cannot perform administrator publication operations',async()=>{
 for(const setup of [{preview:true},{role:'editor'},{role:'viewer'}]){const x=load(setup),r=await x.run({operation:'publish',targets:[target]});assert.equal(x.calls.length,0);assert.equal(r.failures.length,1);}
});
test('mixed law/trend bulk action returns per-item failures and retries no successful item itself',async()=>{
 const other='10000000-0000-0000-0000-000000000002';const x=load({errors:{[other]:{code:'40001'}}});
 const r=await x.run({operation:'publish',targets:[target,{id:other,kind:'law',revision:'4'},target]});
 assert.equal(x.calls.length,2);assert.equal(r.succeeded[0],'trend:'+id);assert.match(r.failures[0].message,/내용이 변경/);assert.equal(x.calls[1].params.p_entity_type,'law');assert.ok(x.paths.includes('/public'));
});
test('editor saves a working payload and never updates public tables directly',async()=>{
 const x=load({role:'editor'});const r=await x.run({operation:'save_trend',targets:[target],draft:{title:'제목',summary:'요약',body:'본문',jurisdictions:['EU'],topics:['아동']}});
 assert.equal(r.failures.length,0);assert.equal(x.calls[0].name,'save_publication_draft');assert.equal(x.calls[0].params.p_payload.title_ko,'제목');assert.equal(x.calls[0].params.p_payload.key_points[0].text,'보존');
});
test('malformed revision, prototype operation, and oversized selection never invoke RPC',async()=>{
 const x=load();for(const command of [{operation:'publish',targets:[{...target,revision:'NaN'}]},{operation:'toString',targets:[target]},{operation:'publish',targets:Array(101).fill(target)}])await x.run(command);assert.equal(x.calls.length,0);
});

test('one selection registers a repository submission then publishes the returned working revision',async()=>{
 const x=load({prepared:{id,revision:'7'}});const r=await x.run({operation:'publish',targets:[{id:'repo-trend:submitted-news',kind:'trend',revision:'a'.repeat(64)}]});
 assert.equal(r.succeeded[0],'trend:repo-trend:submitted-news');assert.equal(x.calls[0].name,'publish_publication_draft');assert.equal(x.calls[0].params.p_entity_id,id);assert.equal(x.calls[0].params.p_expected_revision,7);
});
test('a changed repository submission never proceeds to publication',async()=>{
 const x=load();const r=await x.run({operation:'publish',targets:[{id:'repo-trend:submitted-news',kind:'trend',revision:'a'.repeat(64)}]});assert.equal(r.succeeded.length,0);assert.equal(r.failures.length,1);assert.equal(x.calls.length,0);
});
