import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {reconnectStorage,PODCAST_DEDICATED_ACCOUNT} from '../lib/podcast-reconnect.ts';
const cookie=(name,extra={})=>({name,value:'synthetic-only',domain:'.google.com',path:'/',secure:true,httpOnly:true,...extra});
const valid=()=>({email:PODCAST_DEDICATED_ACCOUNT,cookies:[cookie('SID'),cookie('__Secure-1PSIDTS')]});
test('reconnection accepts only the dedicated account and required scoped session cookies',()=>{
 assert.equal(reconnectStorage(valid()).notebooklm.account.email,PODCAST_DEDICATED_ACCOUNT);
 assert.throws(()=>reconnectStorage({...valid(),email:'other@example.test'}),/전용/);
 assert.throws(()=>reconnectStorage({...valid(),cookies:[cookie('SID')]}),/로그인/);
 assert.equal(reconnectStorage({...valid(),cookies:[cookie('SID'),cookie('OSID')]}).cookies.length,2);
 assert.equal(reconnectStorage({...valid(),cookies:[cookie('SID'),cookie('APISID'),cookie('SAPISID')]}).cookies.length,3);
 assert.equal(reconnectStorage({...valid(),cookies:[cookie('SID',{domain:'.accounts.google.com'}),cookie('OSID')]}).cookies.length,2);
 const result=reconnectStorage({...valid(),cookies:[...valid().cookies,cookie('password'),cookie('SID',{domain:'.example.test'}),cookie('HSID',{path:'/other'})]});
 assert.equal(result.cookies.length,2);assert.deepEqual(result.origins,[]);
});
test('an unpaired origin cannot capture any Google authentication data',async()=>{
 let listener,read=0;const chrome={storage:{local:{get:async()=>({allowedOrigins:['https://globaltrend-example.vercel.app']})}},cookies:{getAll:async()=>{read++;return[];}},runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const result=await new Promise(resolve=>listener({type:'GT_RECONNECT_SAVE'},{url:'https://other.vercel.app/team/podcast',tab:{id:1}},resolve));
 assert.ok(result.error);assert.equal(read,0);
});

test('only the exact production studio is paired automatically',async()=>{
 let listener;
 const chrome={storage:{local:{get:async()=>({allowedOrigins:[]})}},runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const call=url=>new Promise(resolve=>listener({type:'GT_PING'},{url,tab:{id:1}},resolve));
 assert.equal((await call('https://globaltrend-six.vercel.app/team/podcast')).ok,true);
 assert.ok((await call('https://globaltrend-six.vercel.app/other')).error);
 assert.ok((await call('https://globaltrend-six.attacker.vercel.app/team/podcast')).error);
});

test('paired reconnect uses its exact tab, filters cookies, closes capture tab and never stores credential values',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,reads=0,delivered,closed;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{getAll:async()=>{reads++;return [...valid().cookies,cookie('unrelated'),cookie('SID',{domain:'.other.test'})];}},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async id=>closed=id},
 scripting:{executeScript:async options=>{if(options.target.tabId===77)return[{result:PODCAST_DEDICATED_ACCOUNT}];delivered=options.args[0];return[{result:{ok:true}}];}},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const app={url:'https://globaltrend-example.vercel.app/team/podcast',tab:{id:2}};
 const call=(type,sender=app)=>new Promise(resolve=>listener({type},sender,resolve));
 assert.equal((await call('GT_RECONNECT_OPEN')).ok,true);
 assert.ok((await call('GT_RECONNECT_SAVE',{...app,tab:{id:3}})).error);assert.equal(reads,0);
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);assert.equal(reads,5);assert.equal(delivered.length,2);assert.equal(closed,77);
 assert.ok(!JSON.stringify(state).includes('synthetic-only'));assert.equal(state.reconnect,undefined);
});

test('reconnect reads the NotebookLM tab cookie store and Google account host',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered,queries=[];
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{getAllCookieStores:async()=>[{id:'default',tabIds:[2]},{id:'notebook-profile',tabIds:[77]}],getPartitionKey:async details=>{assert.equal(details.tabId,77);assert.equal(details.frameId,0);return {topLevelSite:'https://notebooklm.google.com',hasCrossSiteAncestor:false};},getAll:async details=>{queries.push(details);return details.storeId==='notebook-profile'&&details.partitionKey?.topLevelSite==='https://notebooklm.google.com'&&details.domain==='google.com'?valid().cookies:[];}},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async()=>{}},
 scripting:{executeScript:async options=>{if(options.target.tabId===77)return[{result:''}];delivered=options.args[0];return[{result:{ok:true}}];}},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);
 assert.equal(queries.length,6);
 assert.equal(queries.every(query=>query.storeId==='notebook-profile'),true);
 assert.equal(queries.slice(0,1).every(query=>query.partitionKey?.topLevelSite==='https://notebooklm.google.com'),true);
 assert.equal(queries.slice(1).every(query=>!query.partitionKey),true);
 assert.equal(delivered.length,2);
});

test('reconnect recognises the dedicated Google account on its account button',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered=false;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{getAll:async()=>valid().cookies},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async()=>{}},
 scripting:{executeScript:async options=>{
  if(options.target.tabId===77){
   const button={getAttribute:name=>name==='aria-label'?'Google 계정: psunup@gmail.com':null};
   const document={querySelectorAll:selector=>selector.includes('button')?[button]:[]};
   return [{result:vm.runInNewContext(`(${options.func.toString()})()`,{document})}];
  }
  delivered=true;return[{result:{ok:true}}];
 }},runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);
 assert.equal(delivered,true);
});

test('reconnect recognises the dedicated account shown inside a Google account frame',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered=false;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{getAll:async()=>valid().cookies},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async()=>{}},
 scripting:{executeScript:async options=>{
  if(options.target.tabId===77){
   assert.equal(options.target.allFrames,true);
   return [{result:''},{result:'Google 계정: psunup@gmail.com'}];
  }
  delivered=true;return[{result:{ok:true}}];
 }},runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);
 assert.equal(delivered,true);
});

test('reconnect accepts an already signed-in NotebookLM tab when its account label is hidden',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered=false;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{getAll:async()=>valid().cookies},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async()=>{}},
 scripting:{executeScript:async options=>{if(options.target.tabId===77)return[{result:''}];delivered=true;return[{result:{ok:true}}];}},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);
 assert.equal(delivered,true);
});

test('reconnect still refuses a visibly different Google account',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered=false;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value)}},
 cookies:{getAll:async()=>valid().cookies},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'})},
 scripting:{executeScript:async options=>{if(options.target.tabId===77)return[{result:'other@gmail.com'}];delivered=true;return[{result:{ok:true}}];}},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.match((await call('GT_RECONNECT_SAVE')).error,/다른 Google 계정/);
 assert.equal(delivered,false);
});

test('browser reconnect passes a rotatable session without PSIDTS to cloud verification',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{getAll:async()=>[cookie('SID'),cookie('OSID')]},
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async()=>{}},
 scripting:{executeScript:async options=>{if(options.target.tabId===77)return[{result:''}];delivered=options.args[0];return[{result:{ok:true}}];}},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);
 assert.equal(delivered.some(c=>c.name==='OSID'),true);
});


test('reconnect falls back to ordinary cookies when Chrome rejects partitionKey in getAll',async()=>{
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener,delivered,partitionReads=0,ordinaryReads=0;
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value),remove:async key=>{delete state[key];}}},
 cookies:{
  getAllCookieStores:async()=>[{id:'default',tabIds:[2]},{id:'notebook-profile',tabIds:[77]}],
  getPartitionKey:async()=>({topLevelSite:'https://notebooklm.google.com',hasCrossSiteAncestor:false}),
  getAll:async details=>{
   if(details.partitionKey){partitionReads++;throw new TypeError("Unexpected property: 'partitionKey'.");}
   ordinaryReads++;
   return details.storeId==='notebook-profile'&&details.url==='https://accounts.google.com/'?valid().cookies:[];
  }
 },
 tabs:{create:async()=>({id:77}),get:async()=>({id:77,url:'https://notebooklm.google.com/'}),remove:async()=>{}},
 scripting:{executeScript:async options=>{if(options.target.tabId===77)return[{result:''}];delivered=options.args[0];return[{result:{ok:true}}];}},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const sender={url:'https://globaltrend-example.vercel.app/work/podcast',tab:{id:2}};
 const call=type=>new Promise(resolve=>listener({type},sender,resolve));
 await call('GT_RECONNECT_OPEN');
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);
 assert.equal(partitionReads,1);assert.equal(ordinaryReads,5);assert.equal(delivered.length,2);
});

test('missing-session diagnostics distinguish query rejection and filtering without exposing values',async()=>{
 let listener;
 const state={allowedOrigins:[],reconnect:{origin:'https://globaltrend-six.vercel.app',appTabId:2,notebookTabId:77,openedAt:Date.now()}};
 const chrome={storage:{local:{get:async key=>({[key]:state[key]})}},
 cookies:{getAllCookieStores:async()=>[{id:'0',tabIds:[77]}],getPartitionKey:async()=>({topLevelSite:'https://notebooklm.google.com'}),getAll:async details=>{
 if(details.partitionKey)throw Error("Unexpected property: 'partitionKey'.");
 return [cookie('SID',{path:'/excluded',value:'secret-must-never-leak'})];
 }},
 tabs:{get:async()=>({url:'https://notebooklm.google.com/'})},
 scripting:{executeScript:async()=>[{result:''}]},
 runtime:{onMessage:{addListener:fn=>listener=fn}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,Error,Set,Promise,Date});
 const result=await new Promise(resolve=>listener({type:'GT_RECONNECT_SAVE'},{url:'https://globaltrend-six.vercel.app/work/podcast',tab:{id:2}},resolve));
 assert.equal(result.diagnostics.stage,'required_cookie_missing');
 assert.equal(result.diagnostics.queries[0].error,'partition_parameter_rejected');
 assert.equal(result.diagnostics.authCookies[0].path,'/excluded');
 assert.equal(result.diagnostics.acceptedCookieNames.length,0);
 assert.equal(JSON.stringify(result).includes('secret-must-never-leak'),false);
});
