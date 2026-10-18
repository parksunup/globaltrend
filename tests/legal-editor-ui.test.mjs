import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const legalProps={id:'law-one',revision:'1',readOnly:false,published:true,payload:{instrument:{summary:'기존 설명'},document:{scopeNote:'기존 범위',sections:[{id:'a1',title:'제1조',lines:[{id:'a1-p1',label:'1',text:'기존 조문'}]}]},cells:[{id:'criterion-1',criterionOrder:1,criterionName:'목적 제한',summary:'기존 요약',exceptions:'기존 예외',articleNumbers:['제1조']}]}};
function harness(filename,props,mocks){
  const state=[],navigations=[];let slot=0,tree,prevented=0,resets=0;
  const dom=new Map();
  const hooks={useState(initial){const n=slot++;if(!(n in state))state[n]=typeof initial==='function'?initial():initial;return [state[n],value=>{state[n]=typeof value==='function'?value(state[n]):value;}];},useRef(initial){const n=slot++;if(!(n in state))state[n]={current:initial};return state[n];}};
  const exports={};
  const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{exports,console,window:{location:{assign:url=>navigations.push(url)}},FormData:class{constructor(values){this.values={...values};}get(name){return this.values[name]??null;}},require(name){if(name==='react')return hooks;if(name.endsWith('.module.css'))return {default:{}};if(name in mocks)return mocks[name];return require(name);}});
  const descendants=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(descendants)];
  const text=node=>typeof node==='string'||typeof node==='number'?String(node):React.Children.toArray(node?.props?.children).map(text).join('');
  function render(){slot=0;tree=exports.default(props);return tree;}
  const find=predicate=>descendants(tree).find(predicate);
  const fields=()=>descendants(tree).filter(node=>['input','textarea','select'].includes(node.type));
  function named(name){return find(node=>node.props?.name===name);}
  function changeTextarea(index,value){const field=descendants(tree).filter(node=>node.type==='textarea')[index];dom.set('textarea:'+index,value);field.props.onChange?.({target:{value}});render();}
  function fill(name,value){dom.set(name,value);named(name)?.props.onChange?.({target:{value}});render();}
  function values(){return Object.fromEntries(fields().filter(field=>field.props.name).map(field=>[field.props.name,field.props.value??dom.get(field.props.name)??field.props.defaultValue??'']));}
  async function submit(){const form=find(node=>node.type==='form');assert.equal(form.props.action,undefined,'native React action reset must not be enabled');assert.equal(typeof form.props.onSubmit,'function');const result=form.props.onSubmit({preventDefault(){prevented++;},currentTarget:{...values(),reset(){resets++;}}});await result;render();}
  render();
  return {render,find,text,named,changeTextarea,fill,values,submit,navigations,dom,prevented:()=>prevented,resets:()=>resets};
}
function legal(save,props={}){return harness('app/work/legal/editor.tsx',{...legalProps,...props},{'./save-working-copy':{saveLegalWorkingCopy:save}});}
function trend(save){return harness('app/work/new/new-trend-form.tsx',{sources:[{id:'source',name:'EDPB'}],readOnlyPreview:false},{'./save':{createWorkspaceNewDraft:save}});}

test('legal save failure keeps entered changes, revision and manual form state for retry',async()=>{
  const calls=[];const h=legal(async(previous,form)=>{calls.push({previous,revision:form.get('revision'),changes:JSON.parse(form.get('changes'))});return {ok:false,message:'저장하지 못했습니다.',revision:'1'};});
  h.changeTextarea(0,'사용자가 수정한 설명');h.changeTextarea(2,'사용자가 수정한 조문');
  await h.submit();
  assert.equal(h.prevented(),1);assert.equal(h.resets(),0);assert.equal(h.dom.get('textarea:0'),'사용자가 수정한 설명');assert.equal(h.dom.get('textarea:2'),'사용자가 수정한 조문');
  assert.equal(h.named('revision').props.value,'1');assert.deepEqual(JSON.parse(h.named('changes').props.value),{summary:'사용자가 수정한 설명','line:a1-p1':'사용자가 수정한 조문'});
  assert.ok(h.find(node=>node.type==='p'&&node.props.role==='status'&&h.text(node)==='저장하지 못했습니다.'));
  await h.submit();assert.equal(calls.length,2);assert.equal(calls[1].changes['line:a1-p1'],'사용자가 수정한 조문');
});
test('legal network failure preserves changes and re-enables save',async()=>{
  const h=legal(async()=>{throw new Error('offline');});h.changeTextarea(0,'보존할 설명');await h.submit();
  assert.equal(JSON.parse(h.named('changes').props.value).summary,'보존할 설명');assert.equal(h.resets(),0);
  assert.ok(h.find(node=>node.type==='button'&&h.text(node)==='수정본 저장'&&!node.props.disabled));
  assert.ok(h.find(node=>node.type==='p'&&h.text(node).includes('입력한 내용은 유지됩니다')));
});
test('successful legal save updates hidden revision and clears changes before the next edit',async()=>{
  const calls=[];const h=legal(async(previous,form)=>{calls.push({revision:form.get('revision'),changes:JSON.parse(form.get('changes'))});return {ok:true,message:'저장했습니다.',revision:String(Number(form.get('revision'))+1)};});
  h.changeTextarea(0,'첫 번째 저장 설명');await h.submit();
  assert.equal(h.named('revision').props.value,'2');assert.deepEqual(JSON.parse(h.named('changes').props.value),{});
  assert.ok(h.find(node=>node.type==='button'&&h.text(node)==='수정본 저장'&&node.props.disabled));
  assert.equal(h.dom.get('textarea:0'),'첫 번째 저장 설명');
  h.changeTextarea(2,'두 번째 저장 조문');await h.submit();
  assert.equal(calls[0].revision,'1');assert.equal(calls[1].revision,'2');assert.deepEqual(calls[1].changes,{'line:a1-p1':'두 번째 저장 조문'});
  assert.equal(h.named('revision').props.value,'3');assert.deepEqual(JSON.parse(h.named('changes').props.value),{});assert.equal(h.resets(),0);
});
test('legal editor refuses duplicate in-flight submits before React can rerender',async()=>{
  let resolve,calls=0;const h=legal(()=>{calls++;return new Promise(done=>{resolve=done;});});h.changeTextarea(0,'설명');
  const first=h.submit(),second=h.submit();assert.equal(calls,1);resolve({ok:true,message:'저장했습니다.',revision:'2'});await Promise.all([first,second]);assert.equal(calls,1);
});
test('read-only legal editor does not call the save action',async()=>{
  let calls=0;const h=legal(async()=>{calls++;return {ok:true,message:'',revision:'2'};},{readOnly:true});await h.submit();assert.equal(calls,0);
});
test('new trend validation failure keeps typed fields and permits retry without navigation',async()=>{
  const calls=[];const h=trend(async form=>{calls.push({title:form.get('title_ko'),body:form.get('details_ko')});return {ok:false,message:'원문 주소를 확인해 주세요.'};});
  h.fill('title_ko','작성 중인 제목');h.fill('details_ko','작성 중인 긴 본문');await h.submit();
  assert.equal(h.prevented(),1);assert.equal(h.resets(),0);assert.equal(h.values().title_ko,'작성 중인 제목');assert.equal(h.values().details_ko,'작성 중인 긴 본문');assert.deepEqual(h.navigations,[]);
  assert.ok(h.find(node=>node.type==='p'&&node.props.role==='alert'&&h.text(node)==='원문 주소를 확인해 주세요.'));
  await h.submit();assert.equal(calls[1].body,'작성 중인 긴 본문');
});
test('new trend network failure keeps data and successful retry navigates only after saving',async()=>{
  let calls=0;const h=trend(async()=>{calls++;if(calls===1)throw new Error('offline');return {ok:true};});
  h.fill('title_ko','보존할 제목');h.fill('details_ko','보존할 본문');await h.submit();assert.deepEqual(h.navigations,[]);assert.equal(h.values().details_ko,'보존할 본문');
  await h.submit();assert.deepEqual(h.navigations,['/work?notice=draft_saved']);assert.equal(h.resets(),0);
});
