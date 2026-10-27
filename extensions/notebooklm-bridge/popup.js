document.querySelector('#connect').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const url = new URL(tab.url);
    if (!['/team/podcast','/work/podcast'].includes(url.pathname) || !(url.protocol==='https:' && /(^|\.)vercel\.app$/.test(url.hostname) || url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw Error('국제요정 팟캐스트 제작 화면에서 다시 눌러 주세요.');
    const granted = await chrome.permissions.request({origins:[url.origin+'/*']});
    if (!granted) throw Error('작업실 연결 권한을 허용해 주세요.');
    const {allowedOrigins=[]} = await chrome.storage.local.get('allowedOrigins');
    await chrome.storage.local.set({allowedOrigins:[...new Set([...allowedOrigins,url.origin])]});
    const id = 'studio-'+Array.from(new TextEncoder().encode(url.origin)).map(c=>c.toString(16)).join('');
    await chrome.scripting.unregisterContentScripts({ids:[id]}).catch(()=>{});
    await chrome.scripting.registerContentScripts([{id,matches:[url.origin+'/*'],js:['studio.js'],runAt:'document_idle'}]);
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['studio.js']});
    status.textContent = '연결됐습니다. 작업실에서 팟캐스트 만들기를 눌러 주세요.';
  } catch (error) {status.textContent=error.message;}
});
