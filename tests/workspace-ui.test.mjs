import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {jurisdictionName} from '../lib/jurisdictions.ts';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {
  filterWorkspaceItems, canSelectForPublication, publicationBlockers, workspacePage,
  workspaceItemKey, workspaceTarget, safeWorkspaceHref,
} from '../lib/workspace-model.ts';
const require=createRequire(import.meta.url);
const item=(n,override={})=>({id:String(n),kind:'trend',revision:'1',title:`동향 자료 ${n}`,summary:'개인정보 보호 동향',jurisdictions:['EU'],topics:['인공지능'],status:'ready',...override});
const filters={query:'',kind:'all',status:'all'};
function loadUi(){
  const cache=new Map();
  function load(filename){
    filename=path.resolve(filename);if(cache.has(filename))return cache.get(filename);
    const exports={};cache.set(filename,exports);
    const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(source,{exports,console,Date,URL,FormData,
      require(name){
        if(name==='next/navigation')return {useRouter:()=>({refresh(){}})};
        if(name.endsWith('.module.css'))return {default:{}};
        if(name.startsWith('.'))return load(path.resolve(path.dirname(filename),name+'.ts'));
        return require(name);
      }});
    return exports;
  }
  return load('app/work/workspace.tsx').default;
}
const render=(props={})=>renderToStaticMarkup(React.createElement(loadUi(),{items:[item(1)],canEdit:true,canPublish:true,executeAction:async()=>({succeeded:[],failures:[]}),...props}));

test('normal lists exclude trash, while trash filter contains only trashed records',()=>{
  const rows=[item(1),item(2,{status:'trashed'}),item(3,{status:'published'})];
  assert.deepEqual(filterWorkspaceItems(rows,filters).map(x=>x.id),['1','3']);
  assert.deepEqual(filterWorkspaceItems(rows,{...filters,status:'trashed'}).map(x=>x.id),['2']);
});
test('search normalizes full-width text and searches title, body, country and topics',()=>{
  const rows=[item(1,{title:'FTC 발표',body:'아동 정보 처리',jurisdictions:['미국'],topics:['온라인 광고']}),item(2)];
  for(const query of ['ＦＴＣ','아동','미국','온라인 광고'])assert.deepEqual(filterWorkspaceItems(rows,{...filters,query}).map(x=>x.id),['1']);
});
test('type and status filters apply together',()=>{
  assert.deepEqual(filterWorkspaceItems([item(1),item(2,{kind:'law',status:'published'}),item(3,{kind:'law'})],{...filters,kind:'law',status:'ready'}).map(x=>x.id),['3']);
});
test('published records require unpublished changes before they can be selected for publication',()=>{
  assert.equal(canSelectForPublication(item(1,{status:'published'})),false);
  assert.equal(canSelectForPublication(item(1,{status:'published',hasUnpublishedChanges:true})),true);
});
test('missing content, trash and blocking issues prevent publication without treating warnings as approval',()=>{
  assert.equal(canSelectForPublication(item(1,{title:' '})),false);
  assert.equal(canSelectForPublication(item(1,{summary:''})),false);
  assert.equal(canSelectForPublication(item(1,{status:'trashed'})),false);
  assert.equal(canSelectForPublication(item(1,{status:'needs_changes'})),false);
  assert.equal(canSelectForPublication(item(1,{issues:[{message:'원문 확인 필요',blocking:true}]})),false);
  assert.deepEqual(publicationBlockers(item(1,{issues:[{message:'참고 기록',blocking:false}]})),[]);
});
test('pagination shows twenty records and clamps invalid or stale pages',()=>{
  const rows=Array.from({length:25},(_,i)=>item(i));
  assert.equal(workspacePage(rows,1).items.length,20);
  assert.equal(workspacePage(rows,2).items.length,5);
  assert.equal(workspacePage(rows,99).page,2);
  assert.equal(workspacePage(rows,-1).page,1);
  assert.equal(workspacePage([],1).pageCount,1);
});
test('selection keeps database revision intact and distinguishes equal ids in different kinds',()=>{
  const row=item(1,{revision:'9007199254740993'});
  assert.deepEqual(workspaceTarget(row),{id:'1',kind:'trend',revision:'9007199254740993'});
  assert.notEqual(workspaceItemKey(row),workspaceItemKey({...row,kind:'law'}));
});
test('source and editor URLs reject executable, protocol-relative and control-character links',()=>{
  for(const unsafe of ['javascript:alert(1)','//evil.test','/\\evil.test','/\n/evil.test','data:text/html,x','http://example.test'])assert.equal(safeWorkspaceHref(unsafe),null);
  assert.equal(safeWorkspaceHref('/public/laws/gdpr'),'/public/laws/gdpr');
  assert.equal(safeWorkspaceHref('https://example.test/law'),'https://example.test/law');
});
test('list SSR emphasizes actual material and separates page selection from all search results',()=>{
  const html=render({items:Array.from({length:25},(_,i)=>item(i+1))});
  assert.match(html,/자료 관리/);assert.match(html,/이 페이지 20건 선택/);assert.match(html,/검색 결과의 선택 가능한 25건 모두 선택/);
  assert.match(html,/동향 자료 20/);assert.doesNotMatch(html,/>동향 자료 21</);
  assert.match(html,/선택한 0건 공개/);assert.doesNotMatch(html,/RPC|SQL|검수 전 초안/);
});
test('editor sees publication request; Preview disables changing content',()=>{
  const editor=render({canPublish:false});assert.match(editor,/선택한 0건 공개 요청/);
  const preview=render({readOnly:true});assert.match(preview,/실제 자료를 저장하거나 공개하지 않습니다/);
  assert.match(preview,/<input[^>]*type="checkbox"[^>]*disabled/);
});
test('initial legal filter preserves the unified screen and omits unrelated trends',()=>{
  const html=render({initialKind:'law',items:[item(1,{title:'보여주지 않을 동향'}),item(2,{kind:'law',title:'법제 번역'})]});
  assert.match(html,/법제 번역/);assert.doesNotMatch(html,/보여주지 않을 동향/);
});
test('trash view can be opened directly from the materials screen and offers restore',()=>{
  const html=render({initialStatus:'trashed',items:[item(1,{status:'trashed'})]});
  assert.match(html,/option value="trashed" selected=""/);
  assert.match(html,/휴지통/);
  assert.match(html,/선택한 0건 복원/);
});
test('rows mark published content with unpublished changes without treating published rows as drafts',()=>{
  const html=render({items:[item(1,{status:'published',hasUnpublishedChanges:true})]});
  assert.match(html,/공개 중/);assert.match(html,/수정본 있음/);assert.doesNotMatch(html,/사람 검수 전/);
});

function interactive(props){
  const slots=[],effects=[],deps=[];let position=0,tree,refreshes=0;
  const hooks={
    useState(initial){const index=position++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useRef(initial){const index=position++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useMemo(fn){position++;return fn();},
    useEffect(fn,next){const index=position++;if(!deps[index]||next.some((value,i)=>value!==deps[index][i])){deps[index]=next;effects.push(fn);}}
  };
  const exports={};
  const code=ts.transpileModule(readFileSync('app/work/workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,console,Date,URL,FormData:class {constructor(values){this.values=values;}get(key){return this.values[key]??null;}},require(name){if(name==='react')return hooks;if(name.endsWith('/jurisdictions'))return {jurisdictionName};if(name==='next/navigation')return {useRouter:()=>({refresh(){refreshes++;}})};if(name.endsWith('.module.css'))return {default:{}};if(name.endsWith('workspace-model'))return {filterWorkspaceItems,canSelectForPublication,publicationBlockers,safeWorkspaceHref,workspacePage,workspaceItemKey,workspaceTarget,workspaceKindLabels:{trend:'동향',law:'법제'},workspaceStatusLabels:{draft:'작성 중',ready:'공개 준비',needs_changes:'수정 필요',published:'공개 중',trashed:'휴지통'}};return require(name);}});
  function render(next=props,flush=true){props=next;position=0;tree=exports.default(props);if(flush){const pending=effects.splice(0);pending.forEach(effect=>effect());position=0;tree=exports.default(props);}return tree;}
  const all=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(all)];
  const text=node=>typeof node==='string'||typeof node==='number'?String(node):React.Children.toArray(node?.props?.children).map(text).join('');
  const find=predicate=>all(tree).find(predicate);
  render();
  return {render,find,text,refreshes:()=>refreshes,props:()=>props};
}
const editable=extra=>({items:[item(1)],canEdit:true,canPublish:true,executeAction:async()=>({succeeded:[],failures:[]}),...extra});

test('all-result publication over 100 items uses bounded calls and one combined result',async()=>{
  const calls=[],rows=Array.from({length:205},(_,n)=>item(n+1));
  const h=interactive(editable({items:rows,executeAction:async command=>{calls.push(command);return {succeeded:command.targets.map(workspaceItemKey),failures:[]};}}));
  h.find(node=>node.type==='button'&&h.text(node).startsWith('검색 결과의 선택 가능한')).props.onClick();h.render();
  await h.find(node=>node.type==='button'&&h.text(node)==='선택한 205건 공개').props.onClick();await new Promise(resolve=>setTimeout(resolve,0));h.render();
  assert.deepEqual(calls.map(command=>command.targets.length),[100,100,5]);
  assert.equal(h.refreshes(),1);assert.ok(h.find(node=>node.type==='strong'&&h.text(node)==='공개 완료 205건'));
});
test('selected revision is frozen even before the revision-change effect can clear selection',async()=>{
  const calls=[];const h=interactive(editable({executeAction:async command=>{calls.push(command);return {succeeded:[],failures:[]};}}));
  h.find(node=>node.type==='input'&&node.props['aria-label']==='동향 자료 1 선택').props.onChange({target:{checked:true}});h.render();
  h.render({...h.props(),items:[item(1,{revision:'2'})]},false);
  await h.find(node=>node.type==='button'&&h.text(node)==='선택한 1건 공개').props.onClick();
  assert.equal(calls[0].targets[0].revision,'1');
});
test('changed data clears stale selection with a notice instead of silently replacing its revision',()=>{
  const h=interactive(editable({}));
  h.find(node=>node.type==='input'&&node.props['aria-label']==='동향 자료 1 선택').props.onChange({target:{checked:true}});h.render();
  h.render({...h.props(),items:[item(1,{revision:'2'})]});
  assert.ok(h.find(node=>node.type==='p'&&node.props.role==='status'&&h.text(node).includes('선택을 해제했습니다')));
  assert.ok(h.find(node=>node.type==='button'&&h.text(node)==='선택한 0건 공개'));
});
test('partial-failure retry sends only failed records and keeps their original revisions',async()=>{
  const calls=[];const h=interactive(editable({items:[item(1),item(2)],executeAction:async command=>{calls.push(command);return calls.length===1?{succeeded:['trend:1'],failures:[{key:'trend:2',message:'내용이 변경되었습니다.'}]}:{succeeded:[],failures:[{key:'trend:2',message:'최신 내용을 확인해 주세요.'}]};}}));
  h.find(node=>node.type==='input'&&node.props['aria-label']==='이 페이지의 선택 가능한 2건 선택').props.onChange({target:{checked:true}});h.render();
  await h.find(node=>node.type==='button'&&h.text(node)==='선택한 2건 공개').props.onClick();await new Promise(resolve=>setTimeout(resolve,0));h.render({...h.props(),items:[item(1,{status:'published'}),item(2,{revision:'2'})]});
  await h.find(node=>node.type==='button'&&h.text(node)==='실패한 1건 다시 시도').props.onClick();
  assert.equal(calls[1].targets.length,1);assert.equal(calls[1].targets[0].id,'2');assert.equal(calls[1].targets[0].revision,'1');
});
test('failed save does not refresh the page and destroy unsaved form values',async()=>{
  const calls=[];const h=interactive(editable({executeAction:async command=>{calls.push(command);return {succeeded:[],failures:[{key:'trend:1',message:'저장에 실패했습니다.'}]};}}));
  h.find(node=>node.type==='button'&&h.text(node)==='동향 자료 1').props.onClick();h.render();
  h.find(node=>node.type==='button'&&node.props.role==='tab'&&h.text(node)==='내용 수정').props.onClick();h.render();
  h.find(node=>node.type==='form').props.onSubmit({preventDefault(){},currentTarget:{title:'수정한 제목',summary:'작성 중인 요약',body:'보존할 본문',jurisdictions:'EU',topics:'아동'}});
  await new Promise(resolve=>setTimeout(resolve,0));h.render();
  assert.equal(calls[0].draft.title,'수정한 제목');assert.equal(h.refreshes(),0);
  assert.ok(h.find(node=>node.type==='form'));
});

test('published revisions show a focused before-and-after comparison in details',()=>{
  const h=interactive(editable({items:[item(1,{status:'published',hasUnpublishedChanges:true,changes:[{label:'핵심 요약',before:'기존 요약',after:'보완된 요약'}]})]}));
  h.find(node=>node.type==='button'&&h.text(node)==='동향 자료 1').props.onClick();h.render();
  assert.ok(h.find(node=>node.type==='summary'&&h.text(node)==='변경된 내용 1곳 보기'));
  assert.ok(h.find(node=>node.type==='p'&&h.text(node)==='기존 요약'));
  assert.ok(h.find(node=>node.type==='p'&&h.text(node)==='보완된 요약'));
});

test('same-law conflicts across different hundred-record batches are held before any publication call',async()=>{
  const rows=Array.from({length:205},(_,n)=>item(n+1));
  rows[0]=item(1,{kind:'law',publicationGroup:'same-law'});
  rows[150]=item(151,{kind:'law',publicationGroup:'same-law'});
  const calls=[];const h=interactive(editable({items:rows,executeAction:async command=>{calls.push(command);return {succeeded:command.targets.map(workspaceItemKey),failures:[]};}}));
  h.find(node=>node.type==='button'&&h.text(node).startsWith('검색 결과의 선택 가능한')).props.onClick();h.render();
  h.find(node=>node.type==='button'&&h.text(node)==='선택한 205건 공개').props.onClick();
  await new Promise(resolve=>setTimeout(resolve,0));h.render();
  assert.deepEqual(calls.map(command=>command.targets.length),[100,100,3]);
  assert.equal(calls.flatMap(command=>command.targets).some(target=>target.kind==='law'),false);
  assert.ok(h.find(node=>node.type==='strong'&&h.text(node).includes('공개 완료 203건')&&h.text(node).includes('처리하지 못한 자료 2건')));
});
