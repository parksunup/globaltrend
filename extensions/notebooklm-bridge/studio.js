(() => {
  if (!['/team/podcast','/work/podcast'].includes(location.pathname) || window.__gtPodcastStudio) return;
  window.__gtPodcastStudio=true;
  const pending=new Map();
  window.addEventListener('message',async event=>{
    if(event.source!==window || event.origin!==location.origin) return;
    const m=event.data;
    if(m?.type==='GT_RPC_RESULT' && pending.has(m.requestId)) {const item=pending.get(m.requestId);clearTimeout(item.timer);pending.delete(m.requestId);item.reply(m.result);return;}
    if(m?.type!=='GT_COMMAND' || !['GT_PING','GT_BEGIN','GT_CANCEL'].includes(m.command?.type)) return;
    const result=await chrome.runtime.sendMessage(m.command).catch(error=>({error:error.message}));
    window.postMessage({type:'GT_RESPONSE',requestId:m.requestId,result},location.origin);
  });
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message.type!=='GT_RPC') return;
    const requestId=crypto.randomUUID();
    const timer=setTimeout(()=>{pending.delete(requestId);reply({error:'국제요정 제작 화면을 다시 열고 이어서 진행해 주세요.'});},120000);
    pending.set(requestId,{reply,timer});
    window.postMessage({...message,requestId},location.origin);
    return true;
  });
  window.postMessage({type:'GT_CONNECTED'},location.origin);
})();
