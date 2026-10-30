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
 assert.equal((await call('GT_RECONNECT_SAVE')).ok,true);assert.equal(reads,1);assert.equal(delivered.length,2);assert.equal(closed,77);
 assert.ok(!JSON.stringify(state).includes('synthetic-only'));assert.equal(state.reconnect,undefined);
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
