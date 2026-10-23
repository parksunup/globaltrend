import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
const require=createRequire(import.meta.url);

test('automatic data refresh preserves typed feedback and attaches it to the revision originally read',async()=>{
  const state=[],submitted=[];let slot=0,tree;
  const hooks={useId:()=>':test:',useEffect:()=>{},useRef(initial){const n=slot++;return state[n]??(state[n]={current:initial});},useState(initial){const n=slot++;if(!(n in state))state[n]=initial;return [state[n],v=>{state[n]=typeof v==='function'?v(state[n]):v;}];}};
  const exports={};
  const source=ts.transpileModule(readFileSync('app/components/submission-feedback.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{exports,URLSearchParams,AbortController,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-only'}},require(name){
    if(name==='react')return hooks;
    if(name.endsWith('supabase/client'))return {createClient:()=>({from:()=>({insert:async payload=>{submitted.push(payload);return {error:null};}})})};
    if(name==='next/link'||name.endsWith('feedback-list'))return {default:()=>null};
    if(name.endsWith('.module.css'))return {default:{}};
    return require(name);
  }});
  const props={itemId:'fixture-one',branch:'feat/trend-source-contracts',commitSha:'a'.repeat(40)};
  const all=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(all)];
  function render(){slot=0;tree=exports.default(props);}
  render();all(tree).find(node=>node.type==='textarea').props.onChange({target:{value:'이 문장을 수정해 주세요.'}});
  render();props.commitSha='b'.repeat(40);render();
  assert.equal(all(tree).find(node=>node.type==='textarea').props.value,'이 문장을 수정해 주세요.');
  await all(tree).find(node=>node.type==='button'&&node.props.children==='피드백 저장').props.onClick();
  assert.equal(submitted[0].commit_sha,'a'.repeat(40));
  assert.equal(submitted[0].body,'이 문장을 수정해 주세요.');
});
