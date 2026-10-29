const TERMINAL = ['published','ready','cancelled'];
const getJob = async () => (await chrome.storage.local.get('job')).job;
async function save(job) {await chrome.storage.local.set({job}); return job;}
function validPacket(job) {
  const p=job?.packet;
  return typeof job?.id==='string' && /^[a-f0-9-]{36}$/.test(job.id) && p?.version===1 && /^\d{4}-W\d{2}$/.test(p.issueKey) && typeof p.sourceText==='string' && p.sourceText.length<=200000 && typeof p.instructions==='string' && p.instructions.length<=20000 && typeof p.title==='string' && p.title.length<=160;
}
async function appRpc(job,method,payload) {
  return chrome.tabs.sendMessage(job.appTabId,{type:'GT_RPC',jobId:job.id,method,payload});
}
async function handler(message,sender) {
  const {allowedOrigins=[]}=await chrome.storage.local.get('allowedOrigins');
  const origin=sender.url ? new URL(sender.url).origin : '';
  const isApp=(origin==='https://globaltrend-six.vercel.app'||allowedOrigins.includes(origin)) && ['/team/podcast','/work/podcast'].includes(new URL(sender.url).pathname);
  let job=await getJob();
  if (message.type==='GT_PING' && isApp) return {ok:true,version:1,job:job?.origin===origin?{id:job.id,phase:job.phase}:null};
  if (message.type==='GT_RECONNECT_OPEN' && isApp) {
    if(!chrome.cookies)throw Error('업데이트된 연결 도구를 팟캐스트 전용 Chrome 프로필에 설치해 주세요.');
    const tab=await chrome.tabs.create({url:'https://notebooklm.google.com/',active:true});
    await chrome.storage.local.set({reconnect:{origin,appTabId:sender.tab.id,notebookTabId:tab.id,openedAt:Date.now()}});
    return {ok:true};
  }
  if (message.type==='GT_RECONNECT_SAVE' && isApp) {
    const {reconnect}=await chrome.storage.local.get('reconnect');
    if(!reconnect||reconnect.origin!==origin||reconnect.appTabId!==sender.tab.id||Date.now()-reconnect.openedAt>900000)throw Error('먼저 Google 로그인 열기를 눌러 주세요.');
    const tab=await chrome.tabs.get(reconnect.notebookTabId);
    if(!['https://notebooklm.google.com','https://notebook.google.com'].includes(new URL(tab.url).origin))throw Error('Google 로그인을 끝낸 뒤 다시 눌러 주세요.');
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>Array.from(document.querySelectorAll('a[href*="accounts.google.com"], [data-email]')).map(e=>(e.getAttribute('aria-label')??'')+' '+(e.getAttribute('data-email')??'')).join(' ')});
    const text=results[0]?.result??'';
    const emails=[...new Set(text.match(/[a-zA-Z0-9._%+-]+@gmail\.com/g)??[])];
    if(emails.length!==1||emails[0]!=='psunup@gmail.com')throw Error('다른 Google 계정이 없는 전용 프로필에서 psunup@gmail.com으로 로그인하고, NotebookLM 오른쪽 위 계정 메뉴를 연 뒤 다시 눌러 주세요.');
    const names=['SID','HSID','SSID','APISID','SAPISID','__Secure-1PSID','__Secure-3PSID','__Secure-1PAPISID','__Secure-3PAPISID','__Secure-1PSIDTS','__Secure-3PSIDTS','__Secure-1PSIDCC','__Secure-3PSIDCC','SIDCC','NID','AEC','SOCS'];
    const cookies=(await chrome.cookies.getAll({domain:'google.com'})).filter(c=>names.includes(c.name)&&['.google.com','google.com','notebooklm.google.com','notebook.google.com'].includes(c.domain)&&c.path==='/').map(c=>({name:c.name,value:c.value,domain:c.domain,path:c.path,expires:c.expirationDate??-1,httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite==='strict'?'Strict':c.sameSite==='lax'?'Lax':'None'}));
    const reply=await chrome.scripting.executeScript({target:{tabId:sender.tab.id},func:async cookies=>{const r=await fetch('/api/podcast/reconnect',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'psunup@gmail.com',cookies})});const body=await r.json();return r.ok?{ok:true}:{error:body.error??'연결 실패'};},args:[cookies]});
    const result=reply[0]?.result;if(!result?.ok)throw Error(result?.error??'연결 결과를 확인하지 못했습니다.');
    await chrome.storage.local.remove('reconnect');
    await chrome.tabs.remove(tab.id);
    return {ok:true};
  }
  if (message.type==='GT_BEGIN' && isApp) {
    if (!validPacket(message.job)) throw Error('제작 자료 형식이 올바르지 않습니다.');
    if (job && !TERMINAL.includes(job.phase) && job.id!==message.job.id) {
      if(job.origin!==origin)throw Error('다른 작업실에서 제작 중입니다. 그 작업실에서 먼저 중단해 주세요.');
      const current=await appRpc({...job,appTabId:sender.tab.id},'status',{});
      if(!TERMINAL.includes(current?.job?.phase))throw Error('다른 회차를 제작 중입니다. 기존 작업을 먼저 마치거나 중단해 주세요.');
      job=await save({...job,phase:current.job.phase});
    }
    if (job?.id===message.job.id && job.origin===origin && !TERMINAL.includes(job.phase)) {
      job=await save({...job,appTabId:sender.tab.id,phase:'opening'});
      try {await chrome.tabs.update(job.notebookTabId,{active:true}); await chrome.tabs.sendMessage(job.notebookTabId,{type:'GT_RESUME'});return {ok:true};} catch { /* Reopen the saved notebook below. */ }
    } else {
      if (TERMINAL.includes(message.job.phase)) throw Error('완료되거나 중단된 제작 기록입니다.');
      job={id:message.job.id,packet:message.job.packet,origin,appTabId:sender.tab.id,stage:message.job.notebook_url?'watch':'home',notebookUrl:message.job.notebook_url,phase:'opening'};
    }
    const tab=await chrome.tabs.create({url:'about:blank',active:true});
    await save({...job,notebookTabId:tab.id});
    await chrome.tabs.update(tab.id,{url:job.notebookUrl || 'https://notebook.google.com/'});
    return {ok:true};
  }
  if (message.type==='GT_CANCEL' && isApp && job?.id===message.jobId && job.origin===origin) {await save({...job,phase:'cancelled'});return {ok:true};}
  if (!job || sender.tab?.id!==job.notebookTabId || !['https://notebook.google.com','https://notebooklm.google.com'].includes(origin)) throw Error('연결된 NotebookLM 제작 탭이 아닙니다.');
  if (message.type==='GT_STATE') return {ok:true,job};
  if (job.phase==='cancelled') throw Error('중단된 제작입니다.');
  if (message.type==='GT_STAGE') {
    let notebookUrl=job.notebookUrl;
    if (message.notebookUrl) {
      const u=new URL(message.notebookUrl);
      if(!['https://notebook.google.com','https://notebooklm.google.com'].includes(u.origin)||!/^\/notebook\/[a-f0-9-]{36}$/.test(u.pathname)) throw Error('NotebookLM 주소를 확인할 수 없습니다.');
      notebookUrl=u.origin+u.pathname;
    }
    job=await save({...job,stage:message.stage ?? job.stage,phase:message.phase ?? job.phase,notebookUrl});
    const result=await appRpc(job,'progress',{phase:job.phase,notebookUrl,message:message.message??''});
    if(result?.error) throw Error(result.error);
    return {ok:true};
  }
  if (['GT_AUDIO_BEGIN','GT_AUDIO_CHUNK','GT_AUDIO_END'].includes(message.type)) {
    const result=await appRpc(job,message.type,message.payload);
    if(result?.error) throw Error(result.error);
    if(message.type==='GT_AUDIO_END') await save({...job,phase:result.phase,stage:'done'});
    return result;
  }
  throw Error('지원하지 않는 연결 명령입니다.');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{handler(message,sender).then(reply,error=>reply({error:error.message}));return true;});
