import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const id = n => `41000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const timestamp = '2026-10-19T00:00:00.000Z';
const report = n => ({id:id(n),status:'draft',updated_at:timestamp});
const law = (n, instrument = n) => ({id:id(n),status:'draft',content_hash:String(n).repeat(64),legal_instrument_id:id(instrument)});
function harness(path,{role='admin',environment='production',rows=[],failId}={}) {
  const data = new Map(rows.map(row => [row.id,{...row}]));
  const changes = [];
  const db = {
    auth:{getUser:async()=>({data:{user:{id:id(99)}}})},
    from(table) {
      let update, filters=[];
      const builder={
        select(){return builder;},eq(key,value){filters.push([key,value]);return builder;},
        update(value){update=value;return builder;},
        async maybeSingle(){
          if(table==='team_memberships') return {data:{role,is_active:true}};
          const row=[...data.values()].find(row=>filters.every(([key,value])=>row[key]===value));
          if(!row) return {data:null,error:null};
          if(update){
            if(row.id===failId) return {data:null,error:{code:'failure'}};
            changes.push({id:row.id,status:update.status});
            Object.assign(row,update,{updated_at:new Date(Date.parse(row.updated_at)+1).toISOString()});
          }
          return {data:{...row},error:null};
        }
      };return builder;
    },
    async rpc(name,args){
      const row=data.get(args.p_id);
      if(!row || row.id===failId) return {error:{code:'failure'}};
      assert.equal(name,'advance_legal_review');assert.equal(args.p_checked,true);
      if((args.p_next==='verified'&&row.status!=='draft')||(args.p_next==='published'&&row.status!=='verified')) return {error:{code:'transition'}};
      row.status=args.p_next;changes.push({id:row.id,status:row.status});return {data:row.id,error:null};
    }
  };
  const exports={};
  const context={exports,process:{env:{VERCEL_ENV:environment}},URLSearchParams,FormData,Date,console,
    require(name){
      if(name==='next/cache') return {revalidatePath(){}};
      if(name==='next/navigation') return {redirect(location){throw Object.assign(new Error('redirect'),{location});}};
      if(name.endsWith('supabase/server')) return {createClient:async()=>db};
      if(name.endsWith('legal-release')) return {buildLegalReviewPackages:()=>[]};
      throw new Error(name);
    }};
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,context);
  async function invoke(name,selections){
    const form=new FormData();for(const value of selections) form.append('selection',JSON.stringify(value));
    try{await exports[name](form);assert.fail('expected result redirect');}catch(error){if(!error.location)throw error;return new URL(error.location,'https://test.local');}
  }
  return {invoke,data,changes};
}
const reportPath='app/work/actions.ts';
const lawPath='app/work/legal/actions.ts';
const reportToken = row => ({id:row.id,updatedAt:row.updated_at});
const lawToken = row => ({id:row.id,contentHash:row.content_hash});

test('one report click performs internal approval and publication; repeated selection does not republish',async()=>{
  const row=report(1),h=harness(reportPath,{rows:[row]});
  let result=await h.invoke('publishReports',[reportToken(row)]);
  assert.equal(result.searchParams.get('published'),'1');
  assert.deepEqual(h.changes.map(change=>change.status),['in_review','approved','published']);
  result=await h.invoke('publishReports',[reportToken(row)]);
  assert.equal(result.searchParams.get('already'),'1');assert.equal(h.changes.length,3);
});
test('stale report is held while an independent selected report publishes',async()=>{
  const first=report(1),second=report(2),h=harness(reportPath,{rows:[first,second]});
  const result=await h.invoke('publishReports',[{...reportToken(first),updatedAt:'2026-10-18T00:00:00.000Z'},reportToken(second)]);
  assert.equal(result.searchParams.get('published'),'1');assert.equal(result.searchParams.get('failed'),first.id);
  assert.equal(h.data.get(first.id).status,'draft');assert.equal(h.data.get(second.id).status,'published');
});
test('per-item write failure does not falsely report success or stop other items',async()=>{
  const first=report(1),second=report(2),h=harness(reportPath,{rows:[first,second],failId:first.id});
  const result=await h.invoke('publishReports',[reportToken(first),reportToken(second)]);
  assert.equal(result.searchParams.get('published'),'1');assert.equal(result.searchParams.get('failed'),first.id);
});
for(const [path,action,make,token] of [[reportPath,'publishReports',report,reportToken],[lawPath,'publishLegalReviews',law,lawToken]]) {
  test(`${action} rejects editor and Preview writes before touching data`,async()=>{
    const row=make(1);
    for(const options of [{role:'editor'},{environment:'preview'}]){
      const h=harness(path,{rows:[row],...options}),result=await h.invoke(action,[token(row)]);
      assert.match(result.searchParams.get('notice'),/permission_denied|preview_readonly/);assert.equal(h.changes.length,0);
    }
  });
  test(`${action} rejects empty or oversized selections`,async()=>{
    const h=harness(path),empty=await h.invoke(action,[]),large=await h.invoke(action,Array.from({length:101},()=>token(make(1))));
    assert.equal(empty.searchParams.get('notice'),'invalid_selection');assert.equal(large.searchParams.get('notice'),'invalid_selection');assert.equal(h.changes.length,0);
  });
}
test('one legal click records approval and publication; published snapshots are not repeated',async()=>{
  const row=law(1),h=harness(lawPath,{rows:[row]});
  const result=await h.invoke('publishLegalReviews',[lawToken(row)]);
  assert.equal(result.searchParams.get('published'),'1');assert.deepEqual(h.changes.map(change=>change.status),['verified','published']);
  const duplicate=await h.invoke('publishLegalReviews',[lawToken(row)]);assert.equal(duplicate.searchParams.get('already'),'1');assert.equal(h.changes.length,2);
});
test('stale legal hash is held without approving it',async()=>{
  const row=law(1),h=harness(lawPath,{rows:[row]});
  const result=await h.invoke('publishLegalReviews',[{...lawToken(row),contentHash:'f'.repeat(64)}]);
  assert.equal(result.searchParams.get('failed'),row.id);assert.equal(h.changes.length,0);
});
test('multiple versions of one law are all held before changes; another law may publish',async()=>{
  const rows=[law(1,9),law(2,9),law(3,8)],h=harness(lawPath,{rows});
  const result=await h.invoke('publishLegalReviews',rows.map(lawToken));
  assert.equal(result.searchParams.get('published'),'1');assert.equal(result.searchParams.get('failed'),[rows[0].id,rows[1].id].join(','));
  assert.deepEqual(h.changes.map(change=>change.id),[rows[2].id,rows[2].id]);
});
