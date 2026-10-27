import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {makePodcastPacket,validDay} from '../lib/podcast-production.ts';
import {zipFiles} from '../lib/zip-files.ts';
const story=(n,date='2026-10-23')=>({id:`12345678-1234-1234-1234-${String(n).padStart(12,'0')}`,title:`소식 ${n}`,summary:'요약',details:'공식 자료에 근거한 본문',officialUrl:`https://example.test/${n}`,officialDate:date,source:'공식 기관'});
const input={issueKey:'2026-W43',weekStart:'2026-10-19',weekEnd:'2026-10-25',main:story(1),brief:story(2),context:[story(3,'2025-01-01')]};
test('one major topic and one optional brief are fixed while older contextual evidence is retained',()=>{
 const packet=makePodcastPacket(input);assert.deepEqual(packet.reportIds,[story(1).id,story(3).id,story(2).id]);
 assert.match(packet.instructions,/메인 주제는 “소식 1” 한 가지/);assert.match(packet.instructions,/“소식 2” 소식 한 건만 짧게/);assert.match(packet.sourceText,/2025-01-01/);
 assert.match(makePodcastPacket({...input,brief:undefined}).instructions,/짧은 추가 소식은 없습니다/);
});
test('unknown/out-of-week main dates, duplicate reports and invalid official URLs cannot create an episode',()=>{
 assert.equal(validDay('2026-02-30'),false);assert.throws(()=>makePodcastPacket({...input,main:story(1,'')}),/공식 발표일/);
 assert.throws(()=>makePodcastPacket({...input,brief:story(2,'2026-10-26')}),/공식 발표일/);
 assert.throws(()=>makePodcastPacket({...input,brief:story(1)}),/두 번/);
 assert.throws(()=>makePodcastPacket({...input,main:{...story(1),officialUrl:'javascript:alert(1)'}}),/공식 출처/);
});
test('the extension ZIP has valid filenames, CRC and central-directory offsets',()=>{
 const data=zipFiles([{name:'bridge/manifest.json',content:Buffer.from('123456789')}]);
 assert.equal(data.readUInt32LE(0),0x04034b50);assert.equal(data.readUInt32LE(14),0xcbf43926);
 const end=data.length-22,central=data.readUInt32LE(end+16);assert.equal(data.readUInt32LE(central),0x02014b50);assert.equal(data.readUInt32LE(central+42),0);assert.equal(data.readUInt16LE(end+10),1);
});
function worker(){
 const state={allowedOrigins:['https://globaltrend-example.vercel.app']};let listener;let nextTab=10;const sent=[];
 const chrome={storage:{local:{get:async key=>({[key]:state[key]}),set:async value=>Object.assign(state,value)}},tabs:{create:async()=>({id:nextTab++}),update:async()=>{},sendMessage:async(...args)=>{sent.push(args);return {phase:'ready'};}},runtime:{onMessage:{addListener:fn=>{listener=fn;}}}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/background.js',import.meta.url),'utf8'),{chrome,URL,TextEncoder,Error,Set,Promise});
 return {state,sent,call:(message,sender)=>new Promise(resolve=>listener(message,sender,resolve))};
}
test('only the paired studio can start and only its dedicated notebook can retrieve the packet',async()=>{
 const w=worker(),job={id:story(9).id,packet:makePodcastPacket(input),phase:'queued'};
 const app={url:'https://globaltrend-example.vercel.app/team/podcast',tab:{id:2}};
 assert.match((await w.call({type:'GT_BEGIN',job},{url:'https://other.vercel.app/team/podcast',tab:{id:3}})).error,/연결된/);
 assert.equal((await w.call({type:'GT_BEGIN',job},app)).ok,true);
 assert.match((await w.call({type:'GT_STATE'},{url:'https://notebook.google.com/notebook/'+story(8).id,tab:{id:99}})).error,/연결된/);
 const notebook={url:'https://notebook.google.com/notebook/'+story(8).id,tab:{id:w.state.job.notebookTabId}};
 assert.equal((await w.call({type:'GT_STATE'},notebook)).job.id,job.id);
 await w.call({type:'GT_CANCEL',jobId:job.id},app);
 assert.match((await w.call({type:'GT_AUDIO_BEGIN',payload:{}},notebook)).error,/중단/);
});
test('unarmed downloads are untouched and only the explicitly requested audio export is returned',()=>{
 const handlers=[],messages=[],urls=new Map();let clicked=0,index=0;
 class Link {constructor(href,download=true){this.href=href;this.download=download;}hasAttribute(){return this.download;}click(){clicked++;}}
 const URLMock={createObjectURL(blob){const id='blob:test/'+index++;urls.set(id,blob);return id;},revokeObjectURL(id){urls.delete(id);}};
 const win={addEventListener(_name,fn){handlers.push(fn);},postMessage(message){messages.push(message);}};
 vm.runInNewContext(readFileSync(new URL('../extensions/notebooklm-bridge/capture.js',import.meta.url),'utf8'),{window:win,location:{origin:'https://notebook.google.com'},URL:URLMock,HTMLAnchorElement:Link,Blob,Date,Map});
 const dispatch=data=>handlers.forEach(fn=>fn({source:win,origin:'https://notebook.google.com',data}));
 new Link(URLMock.createObjectURL(new Blob(['x'],{type:'audio/mp4'}))).click();assert.equal(clicked,1);assert.equal(messages.length,0);
 const nonce='a'.repeat(36);dispatch({type:'GT_ARM_AUDIO',nonce});const url=URLMock.createObjectURL(new Blob(['audio'],{type:'audio/mp4'}));
 dispatch({type:'GT_EXPORT_AUDIO',nonce,requestId:'one'});new Link(url).click();assert.equal(clicked,1);assert.equal(messages[0].blob.size,5);
 new Link(url).click();assert.equal(clicked,2);
});
