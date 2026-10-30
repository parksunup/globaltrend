const TERMINAL = ['published','ready','cancelled'];
const getJob = async () => (await chrome.storage.local.get('job')).job;
async function save(job) {await chrome.storage.local.set({job}); return job;}
function validPacket(job) {
  const p=job?.packet;
  return typeof job?.id==='string' && /^[a-f0-9-]{36}$/.test(job.id) && p?.version===1 && /^(?:\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])|\d{4}-(?:0[1-9]|1[0-2])-W[1-5]-[1-9]\d*)$/.test(p.issueKey) && typeof p.sourceText==='string' && p.sourceText.length<=200000 && typeof p.instructions==='string' && p.instructions.length<=20000 && typeof p.title==='string' && p.title.length<=160;
}
async function appRpc(job,method,payload) {
  return chrome.tabs.sendMessage(job.appTabId,{type:'GT_RPC',jobId:job.id,method,payload});
}
async function googleCookiesForTab(tabId) {
  const stores=chrome.cookies.getAllCookieStores?await chrome.cookies.getAllCookieStores():[];
  const storeId=stores.find(store=>store.tabIds.includes(tabId))?.id;
  const details=storeId?{storeId}:{};
  const urls=['https://accounts.google.com/','https://notebooklm.google.com/','https://notebook.google.com/','https://google.com/'];
  let partitionKey;
  try {
    if(chrome.cookies.getPartitionKey)partitionKey=await chrome.cookies.getPartitionKey({tabId,frameId:0});
  } catch {/* Older Chrome versions may not expose partition keys. */}
  const batches=[];
  if(partitionKey){
    try{
      batches.push(...await Promise.all(urls.map(url=>chrome.cookies.getAll({...details,url,partitionKey}))));
    }catch{
      // Some Chrome builds expose getPartitionKey but reject partitionKey in
      // getAll(). A partition query is best-effort; it must never block the
      // ordinary cookie-store lookup below.
      batches.length=0;
    }
  }
  // Prefer partitioned cookies when supported, then fall back to ordinary
  // Google cookies. An unsupported partition query must not abort reconnection.
  batches.push(...await Promise.all(urls.map(url=>chrome.cookies.getAll({...details,url}))));
  const seen=new Set();
  return batches.flat().filter(cookie=>{
    const key=[cookie.name,cookie.domain,cookie.path,cookie.storeId??storeId??''].join('|');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
async function handler(message,sender) {
  const {allowedOrigins=[]}=await chrome.storage.local.get('allowedOrigins');
  const origin=sender.url ? new URL(sender.url).origin : '';
  const isApp=(origin==='https://globaltrend-six.vercel.app'||allowedOrigins.includes(origin)) && ['/team/podcast','/work/podcast'].includes(new URL(sender.url).pathname);
  let job=await getJob();
  if (message.type==='GT_PING' && isApp) return {ok:true,version:8,job:job?.origin===origin?{id:job.id,phase:job.phase}:null};
  if (message.type==='GT_MASTER_OPEN' && isApp) {
    if(!chrome.cookies)throw Error('업데이트된 연결 도구가 필요합니다.');
    await chrome.cookies.remove({url:'https://accounts.google.com/EmbeddedSetup',name:'oauth_token'});
    const tab=await chrome.tabs.create({url:'https://accounts.google.com/EmbeddedSetup',active:true});
    await chrome.storage.local.set({masterBootstrap:{origin,appTabId:sender.tab.id,googleTabId:tab.id,openedAt:Date.now()}});
    return {ok:true};
  }
  if (message.type==='GT_MASTER_SAVE' && isApp) {
    const {masterBootstrap}=await chrome.storage.local.get('masterBootstrap');
    if(!masterBootstrap||masterBootstrap.origin!==origin||masterBootstrap.appTabId!==sender.tab.id||Date.now()-masterBootstrap.openedAt>900000)throw Error('먼저 장기 로그인 연결을 눌러 주세요.');
    await chrome.tabs.get(masterBootstrap.googleTabId);
    const cookie=await chrome.cookies.get({url:'https://accounts.google.com/EmbeddedSetup',name:'oauth_token'});
    if(!cookie?.value||cookie.value.length<20||cookie.value.length>4096)throw Error('Google 로그인 완료를 기다리는 중입니다.');
    const reply=await chrome.scripting.executeScript({target:{tabId:sender.tab.id},func:async token=>{
      const response=await fetch('/api/podcast/bootstrap',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({oauthToken:token})});
      const body=await response.json();return response.ok?{ok:true}:{error:body.error??'장기 로그인 연결 실패'};
    },args:[cookie.value]});
    const result=reply[0]?.result;if(!result?.ok)throw Error(result?.error??'장기 로그인 요청을 확인하지 못했습니다.');
    await chrome.storage.local.remove('masterBootstrap');
    await chrome.tabs.remove(tab.id);
    return {ok:true};
  }
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
    let results=[];
    try{results=await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:()=>{
      const accountText=()=>Array.from(document.querySelectorAll('a[href*="accounts.google.com"], [data-email], button[aria-label*="@"], [role="button"][aria-label*="@"]')).map(e=>(e.getAttribute('aria-label')??'')+' '+(e.getAttribute('data-email')??'')).join(' ');
      const text=accountText();
      if(!text.includes('@gmail.com')){
        const button=Array.from(document.querySelectorAll('button,a,[role="button"]')).find(e=>/google account|google 계정|account menu|계정 메뉴/i.test(e.getAttribute('aria-label')??''));
        button?.click();
      }
      return text;
    }});}catch{/* Google account frames may disallow script injection. The cloud verifies the session. */}
    const text=results.map(frame=>typeof frame.result==='string'?frame.result:'').join(' ');
    const emails=[...new Set(text.match(/[a-zA-Z0-9._%+-]+@gmail\.com/g)??[])];
    if(emails.length>0&&(emails.length!==1||emails[0]!=='psunup@gmail.com'))throw Error('NotebookLM에 다른 Google 계정이 표시됩니다. 팟캐스트 전용 계정으로 전환해 주세요.');
    const names=['SID','HSID','SSID','APISID','SAPISID','LSID','OSID','__Secure-1PSID','__Secure-3PSID','__Secure-1PAPISID','__Secure-3PAPISID','__Secure-1PSIDTS','__Secure-3PSIDTS','__Secure-1PSIDCC','__Secure-3PSIDCC','SIDCC','NID','AEC','SOCS'];
    const allowedDomains=['google.com','accounts.google.com','notebooklm.google.com','notebook.google.com'];
    const cookies=(await googleCookiesForTab(tab.id)).filter(c=>names.includes(c.name)&&allowedDomains.includes(c.domain.replace(/^\./,''))&&c.path==='/').map(c=>({name:c.name,value:c.value,domain:c.domain,path:c.path,expires:c.expirationDate??-1,httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite==='strict'?'Strict':c.sameSite==='lax'?'Lax':'None'}));
    const cookieNames=new Set(cookies.map(cookie=>cookie.name));
    if(!cookieNames.has('SID'))throw Error('이 Chrome 프로필에서 Google 로그인 세션을 찾지 못했습니다. NotebookLM을 연 프로필과 작업실 프로필이 같은지 확인해 주세요.');
    if(!cookieNames.has('__Secure-1PSIDTS')&&!cookieNames.has('OSID')&&!(cookieNames.has('APISID')&&cookieNames.has('SAPISID')))throw Error('Google 로그인은 확인했지만 NotebookLM 자동 제작에 필요한 인증 쿠키가 부족합니다. 아래 장기 로그인 연결을 사용해 주세요.');
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
