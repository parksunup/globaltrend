// Only an explicitly armed, dedicated production tab captures its own audio
// export. No credentials, network requests or application RPCs are inspected.
(() => {
  let armed='',request='',expires=0;
  const audioBlobs=new Map();
  const create=URL.createObjectURL, revoke=URL.revokeObjectURL, click=HTMLAnchorElement.prototype.click;
  const isAudio=blob=>blob instanceof Blob && /^audio\//.test(blob.type) && blob.size>0 && blob.size<=50*1024*1024;
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin)return;
    const m=event.data;
    if(m?.type==='GT_ARM_AUDIO'&&typeof m.nonce==='string'&&m.nonce.length===36){armed=m.nonce;expires=Date.now()+90*60*1000;}
    if(m?.type==='GT_EXPORT_AUDIO'&&m.nonce===armed&&Date.now()<expires)request=m.requestId;
  });
  URL.createObjectURL=function(blob){const url=create.call(this,blob);if(armed&&Date.now()<expires&&isAudio(blob)){audioBlobs.clear();audioBlobs.set(url,blob);}return url;};
  URL.revokeObjectURL=function(url){audioBlobs.delete(url);return revoke.call(this,url);};
  HTMLAnchorElement.prototype.click=function(...args){
    const blob=audioBlobs.get(this.href);
    if(armed&&request&&Date.now()<expires&&this.hasAttribute('download')&&isAudio(blob)){
      window.postMessage({type:'GT_EXPORTED_AUDIO',nonce:armed,requestId:request,blob},location.origin);request='';return;
    }
    return click.apply(this,args);
  };
})();
