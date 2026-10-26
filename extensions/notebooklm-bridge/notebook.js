(() => {
  if(window.__gtNotebookBridge)return;
  window.__gtNotebookBridge=true;
  let running=false;
  const nonce=crypto.randomUUID();
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function send(message) {const result=await chrome.runtime.sendMessage(message);if(result?.error)throw Error(result.error);return result;}
  const visible=e=>e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0;
  function button(names,root=document) {
    const matches=[...root.querySelectorAll('button,[role="button"],[role="menuitem"]')].filter(e=>visible(e)&&!e.disabled&&names.some(name=>e.getAttribute('aria-label')===name || e.innerText?.trim()===name || [...e.querySelectorAll('span,div')].some(child=>child.innerText?.trim()===name)));
    return matches.length===1?matches[0]:null;
  }
  async function wait(find,timeout=45000) {
    const end=Date.now()+timeout;
    while(Date.now()<end){const result=find();if(result)return result;await sleep(600);}
    throw Error('NotebookLM 화면이 예상과 다릅니다. 열린 NotebookLM 탭을 확인한 뒤 이어서 진행해 주세요.');
  }
  async function click(names,root=document) {const e=await wait(()=>button(names,root));e.click();await sleep(600);}
  function fill(input,text) {
    const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,text);
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();
  }
  async function stage(name,phase,extra={}) {await send({type:'GT_STAGE',stage:name,phase,...extra});}
  async function exportAudio() {
    const requestId=crypto.randomUUID();
    let timer,receive;
    const blobPromise=new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('자동 오디오 회수에 실패했습니다. NotebookLM의 다운로드 기능으로 파일을 보존해 주세요.'));},90000);
      receive=event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='GT_EXPORTED_AUDIO'&&event.data.nonce===nonce&&event.data.requestId===requestId&&event.data.blob instanceof Blob){clearTimeout(timer);window.removeEventListener('message',receive);resolve(event.data.blob);}};
      window.addEventListener('message',receive);
    });
    try {
      window.postMessage({type:'GT_EXPORT_AUDIO',nonce,requestId},location.origin);
      await sleep(100);
      await click(['오디오 플레이어 옵션 더보기','More audio player options']);
      await click(['다운로드','Download']);
      return await blobPromise;
    } finally {clearTimeout(timer);window.removeEventListener('message',receive);}
  }
  async function run() {
    if(running)return;running=true;
    try {
      const initial=await send({type:'GT_STATE'});let job=initial.job;
      if(['done'].includes(job.stage)||['cancelled','ready','published'].includes(job.phase))return;
      window.postMessage({type:'GT_ARM_AUDIO',nonce},location.origin);
      if(location.hostname==='accounts.google.com')return;
      await sleep(1000);
      if(!location.pathname.startsWith('/notebook/')) {
        if(job.stage==='creating')throw Error('노트북 생성 여부를 확인해 주세요. 중복 생성을 막기 위해 자동 재클릭하지 않았습니다.');
        const create=button(['새 노트북','Create new notebook','Create notebook']);
        if(!create){await stage(job.stage,'needs_login',{message:'NotebookLM에서 Google에 로그인한 뒤 작업실의 이어서 진행을 눌러 주세요.'});return;}
        await stage('creating','opening');create.click();
        await wait(()=>/^\/notebook\/[a-f0-9-]{36}$/.test(location.pathname));
        job={...job,stage:'title'};
      }
      await stage(job.stage==='creating'||job.stage==='home'?'title':job.stage,'adding_sources',{notebookUrl:location.origin+location.pathname});
      if(['home','creating','title'].includes(job.stage)) {
        const title=await wait(()=>[...document.querySelectorAll('input')].find(e=>visible(e)&&!e.getAttribute('aria-label')&&e.type==='text'));
        fill(title,job.packet.title);
        await stage('source','adding_sources');job.stage='source';
      }
      if(job.stage==='source') {
        const existing=[...document.querySelectorAll('[role=checkbox],input[type=checkbox]')].filter(visible);
        if(!existing.length){
          let dialog=[...document.querySelectorAll('[role=dialog]')].find(visible);
          if(!dialog){await click(['출처 추가','소스 추가','Add sources','Add source']);dialog=await wait(()=>[...document.querySelectorAll('[role=dialog]')].find(visible));}
          if(!dialog.querySelector('textarea'))await click(['복사된 텍스트','Copied text','Paste text'],dialog);
          const textarea=await wait(()=>[...document.querySelectorAll('textarea')].find(visible));
          fill(textarea,`${job.packet.title}\n\n${job.packet.sourceText}`);
          await stage('source_inserted','adding_sources');await click(['삽입','Insert'],[...document.querySelectorAll('[role=dialog]')].find(visible));
        }
        job.stage='source_inserted';
      }
      if(job.stage==='source_inserted') {
        await wait(()=>[...document.querySelectorAll('[role=checkbox],input[type=checkbox]')].some(visible),120000);
        const close=button(['메모 보기 닫기','Close note view']);if(close){close.click();await sleep(700);}
        await stage('configure','adding_sources');job.stage='configure';
      }
      if(job.stage==='configure') {
        let dialog=[...document.querySelectorAll('[role=dialog]')].find(e=>visible(e)&&e.querySelector('[role=combobox]'));
        if(!dialog){await click(['AI 오디오 오버뷰','Audio Overview']);dialog=await wait(()=>[...document.querySelectorAll('[role=dialog]')].find(e=>visible(e)&&e.querySelector('[role=combobox]')));}
        const deep=[...dialog.querySelectorAll('[role=radio]')].find(e=>/^(심층 분석|Deep Dive)/.test(e.getAttribute('aria-label')||e.innerText));
        if(!deep)throw Error('심층 분석 설정을 찾지 못했습니다.');
        if(deep.getAttribute('aria-checked')!=='true'){deep.click();await sleep(500);}
        const language=dialog.querySelector('[role=combobox]');
        if(!/한국어|Korean/.test(language.innerText)) {
          language.click();const option=await wait(()=>[...document.querySelectorAll('[role=option]')].find(e=>visible(e)&&/한국어|Korean/.test(e.innerText)));option.click();await sleep(500);
        }
        const textarea=dialog.querySelector('textarea');if(!textarea)throw Error('제작 지시문 입력칸을 찾지 못했습니다.');
        fill(textarea,job.packet.instructions);
        await stage('watch','generating');
        await click(['지금 생성','Generate now','Generate'],dialog);job.stage='watch';
      }
      // A dedicated notebook contains only this episode. A retry watches it,
      // never presses Generate again and never reuses another notebook's audio.
      if(job.stage==='watch'||job.stage==='collecting') {
        await stage('watch','generating');
        const end=Date.now()+90*60*1000;
        while(Date.now()<end) {
          const current=await send({type:'GT_STATE'});if(current.job.phase==='cancelled')return;
          const dialog=[...document.querySelectorAll('[role=dialog]')].find(visible);
          if(dialog)throw Error('NotebookLM에 확인 창이 열렸습니다. 확인 후 이어서 진행해 주세요.');
          let audio=[...document.querySelectorAll('audio')].find(e=>e.currentSrc||e.src||e.querySelector('source[src]'));
          if(!audio) {
            const cards=[...document.querySelectorAll('button')].filter(e=>visible(e)&&/\d+:\d{2}/.test(e.innerText?.trim()||e.getAttribute('aria-label')||''));
            if(cards.length===1){cards[0].click();await sleep(1000);audio=[...document.querySelectorAll('audio')].find(e=>e.currentSrc||e.src||e.querySelector('source[src]'));}
          }
          const playerOptions=button(['오디오 플레이어 옵션 더보기','More audio player options']);
          if(audio||playerOptions){
            await stage('collecting','collecting');
            const pause=button(['오디오 플레이어 일시중지','Pause audio']);if(pause)pause.click();
            let blob;
            if(audio){const src=audio.currentSrc||audio.src||audio.querySelector('source[src]').src;const response=await fetch(src,{credentials:'include'});if(!response.ok)throw Error('완성된 오디오를 읽지 못했습니다.');blob=await response.blob();}
            else blob=await exportAudio();
            if(blob.size<1||blob.size>50*1024*1024)throw Error('오디오가 50MB를 넘거나 비어 있습니다. 원본은 NotebookLM에 보관되어 있습니다.');
            const mime=blob.type.split(';')[0];if(!['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'].includes(mime))throw Error('지원하지 않는 오디오 형식입니다: '+mime);
            await send({type:'GT_AUDIO_BEGIN',payload:{size:blob.size,mime}});
            for(let offset=0,index=0;offset<blob.size;offset+=192*1024,index++) {
              const bytes=new Uint8Array(await blob.slice(offset,offset+192*1024).arrayBuffer());
              let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
              await send({type:'GT_AUDIO_CHUNK',payload:{index,data:btoa(binary)}});
            }
            await stage('collecting','uploading');
            await send({type:'GT_AUDIO_END',payload:{size:blob.size,mime}});return;
          }
          const notices=[...document.querySelectorAll('[role=alert],[role=status]')].filter(visible).map(e=>e.innerText).join(' ');
          if(/생성.*실패|한도.*초과|couldn.t generate|limit reached/i.test(notices))throw Error('NotebookLM 생성 실패 또는 사용 한도에 도달했습니다. 화면 안내를 확인해 주세요.');
          await sleep(5000);
        }
        throw Error('생성이 오래 걸리고 있습니다. 작업실에서 이어서 진행을 눌러 주세요.');
      }
    } catch(error) {
      // Unbound notebooks are ordinary browsing tabs; do not touch them.
      if(!/연결된 NotebookLM 제작 탭/.test(error.message))await send({type:'GT_STAGE',phase:'blocked',message:error.message}).catch(()=>{});
    } finally {running=false;}
  }
  chrome.runtime.onMessage.addListener((message)=>{if(message.type==='GT_RESUME')void run();});
  void run();
})();
