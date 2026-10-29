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
