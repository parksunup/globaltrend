'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '../../../lib/supabase/client';
import {makePodcastPacket,type PodcastPacket,type PodcastStory,PODCAST_MAX_AUDIO_BYTES} from '../../../lib/podcast-production';
import TeamLogin from '../../components/team-login';
import styles from './studio.module.css';
type Job={id:string;packet:PodcastPacket;phase:string;notebook_url?:string;message:string;audio_path?:string;auto_publish:boolean;execution_mode?:'browser'|'cloud'};
type Transfer={parts:Uint8Array[];size:number;mime:string;received:number};
const labels:Record<string,string>={queued:'제작 준비',opening:'NotebookLM 여는 중',adding_sources:'자료와 지시문 전달 중',generating:'음성 만드는 중',collecting:'완성된 음성 가져오는 중',uploading:'국제요정에 저장 중',ready:'음성 완성',published:'공개 완료',needs_login:'Google 로그인 필요',blocked:'확인 후 이어서 진행',failed:'확인 필요',cancelled:'제작 중단'};
function previousWeek(){
 const now=new Date(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})+'T00:00:00Z');
 const monday=new Date(now);monday.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7)-7);
 const end=new Date(monday);end.setUTCDate(monday.getUTCDate()+6);
 const thursday=new Date(monday);thursday.setUTCDate(monday.getUTCDate()+3);
 const year=thursday.getUTCFullYear(),week=Math.ceil((((thursday.valueOf()-Date.UTC(year,0,1))/86400000)+1)/7);
 return {start:monday.toISOString().slice(0,10),end:end.toISOString().slice(0,10),key:`${year}-W${String(week).padStart(2,'0')}`};
}
async function api(body:Record<string,unknown>){const r=await fetch('/api/podcast/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
export default function PodcastStudio(){
 const [stories,setStories]=useState<PodcastStory[]>([]),[jobs,setJobs]=useState<Job[]>([]);
 const [login,setLogin]=useState(false),[loaded,setLoaded]=useState(false),[setup,setSetup]=useState(false),[canPublish,setCanPublish]=useState(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false);
 const [mode,setMode]=useState<'cloud'|'browser'>('cloud'),[cloudReady,setCloudReady]=useState(false),[cloudStatus,setCloudStatus]=useState('setup_required');
 const [dates,setDates]=useState(previousWeek),[mainId,setMainId]=useState(''),[briefId,setBriefId]=useState(''),[contextIds,setContextIds]=useState<string[]>([]),[autoPublish,setAutoPublish]=useState(true);
 const [audio,setAudio]=useState<{id:string;url:string}>();
 const pending=useRef(new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
 const transfers=useRef(new Map<string,Transfer>());
 async function storeAudio(jobId:string,blob:Blob){
  const target=await api({action:'upload',jobId,size:blob.size,mime:blob.type});
  if(!target.alreadyUploaded){const {error}=await createClient().storage.from('weekly-podcasts').uploadToSignedUrl(target.path,target.token,blob,{contentType:blob.type});if(error)throw Error('오디오 저장에 실패했습니다. 이어서 진행을 눌러 주세요.');}
  return api({action:'complete',jobId,size:blob.size,mime:blob.type});
 }
 async function load(jobsOnly=false){
  const r=await fetch('/api/podcast/production'+(jobsOnly?'?jobsOnly=1':''),{cache:'no-store'}),v=await r.json();
  if(r.status===401){setLogin(true);setLoaded(true);return;}if(!r.ok)throw Error(v.error);
  setLogin(false);if(v.stories)setStories(v.stories);setJobs(v.jobs);setSetup(v.setupRequired);setCanPublish(v.canPublish);setCloudReady(v.cloudReady===true);setCloudStatus(v.cloudStatus);setLoaded(true);
 }
 function bridge(command:Record<string,unknown>){return new Promise<any>((resolve,reject)=>{
  const requestId=crypto.randomUUID(),timer=setTimeout(()=>{pending.current.delete(requestId);reject(Error('브라우저 연결 도구를 설치하고 이 작업실에 연결해 주세요.'));},4000);
  pending.current.set(requestId,{resolve,reject,timer});window.postMessage({type:'GT_COMMAND',requestId,command},location.origin);
 });}
 useEffect(()=>{void load().catch(e=>{setError(e.message);setLoaded(true);});const timer=setInterval(()=>void load(true).catch(e=>setError(e.message)),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  async function onMessage(event:MessageEvent){
   if(event.source!==window||event.origin!==location.origin)return;const m=event.data;
   if(m?.type==='GT_CONNECTED'){setConnected(true);return;}
   if(m?.type==='GT_RESPONSE'){const item=pending.current.get(m.requestId);if(!item)return;clearTimeout(item.timer);pending.current.delete(m.requestId);if(m.result?.error)item.reject(Error(m.result.error));else{setConnected(true);item.resolve(m.result);}return;}
   if(m?.type!=='GT_RPC')return;
   let result:Record<string,unknown>;
   try{
    if(m.method==='status'){result=await api({action:'status',jobId:m.jobId});}
    else if(m.method==='progress'){result=await api({action:'progress',jobId:m.jobId,...m.payload});void load(true);}
    else if(m.method==='GT_AUDIO_BEGIN'){
     if(!Number.isSafeInteger(m.payload.size)||m.payload.size<1||m.payload.size>PODCAST_MAX_AUDIO_BYTES||!['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'].includes(m.payload.mime))throw Error('오디오 형식 또는 크기를 확인해 주세요.');
     transfers.current.set(m.jobId,{parts:[],size:m.payload.size,mime:m.payload.mime,received:0});result={ok:true};
    }else if(m.method==='GT_AUDIO_CHUNK'){
     const transfer=transfers.current.get(m.jobId);if(!transfer||m.payload.index!==transfer.parts.length||typeof m.payload.data!=='string'||m.payload.data.length>262144)throw Error('오디오 연결이 끊겼습니다. 이어서 진행을 눌러 주세요.');
     const bytes=Uint8Array.from(atob(m.payload.data),c=>c.charCodeAt(0));transfer.received+=bytes.length;if(transfer.received>transfer.size)throw Error('오디오 크기가 일치하지 않습니다.');transfer.parts.push(bytes);result={ok:true};
    }else if(m.method==='GT_AUDIO_END'){
     const transfer=transfers.current.get(m.jobId);if(!transfer||transfer.received!==transfer.size||m.payload.size!==transfer.size||m.payload.mime!==transfer.mime)throw Error('오디오가 끝까지 전달되지 않았습니다. 이어서 진행을 눌러 주세요.');
     const blob=new Blob(transfer.parts as BlobPart[],{type:transfer.mime});
     const completed=await storeAudio(m.jobId,blob);transfers.current.delete(m.jobId);result={phase:completed.job.phase};void load(true);
    }else throw Error('지원하지 않는 연결 요청입니다.');
   }catch(e){result={error:e instanceof Error?e.message:'연결 실패'};setError(String(result.error));}
   window.postMessage({type:'GT_RPC_RESULT',requestId:m.requestId,result},location.origin);
  }
  window.addEventListener('message',onMessage);void bridge({type:'GT_PING'}).catch(()=>{});
  return()=>{window.removeEventListener('message',onMessage);for(const item of pending.current.values()){clearTimeout(item.timer);item.reject(Error('화면이 닫혔습니다.'));}pending.current.clear();};
 },[]);
 const candidates=stories.filter(s=>s.officialDate>=dates.start&&s.officialDate<=dates.end).sort((a,b)=>b.officialDate.localeCompare(a.officialDate));
 const main=stories.find(s=>s.id===mainId),brief=stories.find(s=>s.id===briefId);let packet:PodcastPacket|undefined;
 try{if(main)packet=makePodcastPacket({issueKey:dates.key,weekStart:dates.start,weekEnd:dates.end,main,brief,context:stories.filter(s=>contextIds.includes(s.id))});}catch{}
 async function start(){if(busy||!packet)return;setBusy(true);setError('');try{if(mode==='browser')await bridge({type:'GT_PING'});const v=await api({action:'prepare',executionMode:mode,issueKey:dates.key,weekStart:dates.start,weekEnd:dates.end,mainId,briefId,contextIds:stories.filter(s=>contextIds.includes(s.id)).map(s=>s.id),autoPublish:canPublish&&autoPublish});await load(true);if(mode==='browser')await bridge({type:'GT_BEGIN',job:v.job});}catch(e){setError(e instanceof Error?e.message:'제작 시작 실패');}finally{setBusy(false);}}
 async function act(job:Job,action:string){setBusy(true);setError('');try{if(action==='resume'){if(job.execution_mode==='cloud')await api({action:'resumeCloud',jobId:job.id});else await bridge({type:'GT_BEGIN',job});}else if(action==='cancel'){await api({action:'progress',jobId:job.id,phase:'cancelled'});if(job.execution_mode!=='cloud')await bridge({type:'GT_CANCEL',jobId:job.id}).catch(()=>{});}else if(action==='listen'){const v=await api({action:'listen',jobId:job.id});setAudio({id:job.id,url:v.url});}else await api({action,jobId:job.id});await load(true);}catch(e){setError(e instanceof Error?e.message:'처리 실패');}finally{setBusy(false);}}
 return <div className={styles.studio}>
  <header className={styles.hero}><span>국제요정 · PODCAST STUDIO</span><h1>한 가지 주제를, 깊이 있게.</h1><p>메인 주제와 짧은 추가 소식을 고르면 NotebookLM이 한국어 대화를 만듭니다. 완성된 음성은 이곳으로 돌아옵니다.</p><a href="/work">← 동향 작업실</a> · <a href="/public/weekly/podcast">공개 팟캐스트 ↗</a></header>
  <section className={styles.panel}><h2>어디에서 만들까요?</h2><label>제작 방식<select value={mode} onChange={e=>setMode(e.target.value as 'cloud'|'browser')}><option value="cloud">클라우드에서 만들기 · 컴퓨터를 꺼도 계속 진행</option><option value="browser">내 Chrome에서 만들기 · 기존 연결 도구 사용</option></select></label>{mode==='cloud'?<><p className={styles.connection}>{cloudReady?'● 클라우드 연결 준비됨':cloudStatus==='needs_login'?'○ 전용 Google 계정의 다시 로그인이 필요합니다':'○ 클라우드 연결을 준비하고 있습니다'}</p><ol><li>이 화면에서 기간과 깊이 다룰 주제 한 가지를 고릅니다.</li><li>원하시면 짧게 소개할 소식 한 가지를 더 고릅니다.</li><li>아래 제작 버튼을 누릅니다. 요청이 제작 현황에 나타나면 화면을 닫거나 컴퓨터를 꺼도 됩니다.</li><li>클라우드가 약 15분 간격으로 요청을 확인합니다. GitHub 사정에 따라 시작이 늦어질 수 있습니다.</li><li>완성되면 ‘완성본 듣기’로 확인하세요. 자동 공개를 켰다면 완성 직후 공개됩니다.</li></ol><p>연결 준비가 끝나기 전에는 제작 버튼이 켜지지 않습니다. Google 로그인이 만료되거나 무료 사용 한도에 도달하면 중단 이유를 알려드립니다.</p></>:<><ol><li><a href="https://notebook.google.com/" target="_blank" rel="noreferrer">NotebookLM 열기</a>에서 Google에 로그인해 주세요.</li><li><a href="/api/podcast/extension">연결 도구 받기</a> → 압축을 풀고 Chrome 확장 프로그램 관리 화면에서 폴더를 불러옵니다.</li><li>연결 도구 아이콘을 눌러 <strong>‘이 작업실 연결’</strong>을 선택해 주세요.</li></ol><p className={styles.connection}>{connected?'● 브라우저 연결됨':'○ 브라우저 연결을 기다립니다'}</p><p>이 방식에서는 제작 화면과 NotebookLM 탭을 열어 두어야 합니다.</p></>}</section>
  {login&&<section className={styles.panel}><TeamLogin onSuccess={()=>void load().catch(e=>setError(e.message))}/></section>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}{setup&&<p className={styles.error}>제작 기록을 아직 준비하지 못했습니다. 팟캐스트 DB 변경 적용 여부를 확인해 주세요.</p>}
  {!login&&<section className={styles.panel}><h2>이번 회차 만들기</h2><div className={styles.fields}><label>주간호 번호<input value={dates.key} onChange={e=>setDates({...dates,key:e.target.value})}/></label><label>자료 시작일<input type="date" value={dates.start} onChange={e=>setDates({...dates,start:e.target.value})}/></label><label>자료 종료일<input type="date" value={dates.end} onChange={e=>setDates({...dates,end:e.target.value})}/></label></div><p>공식 발표일이 이 기간에 해당하는 공개 동향 {candidates.length}건입니다.</p>
   <label>깊이 다룰 메인 주제<select value={mainId} onChange={e=>{setMainId(e.target.value);if(briefId===e.target.value)setBriefId('');setContextIds(ids=>ids.filter(id=>id!==e.target.value));}}><option value="">주제를 골라 주세요</option>{candidates.map(s=><option key={s.id} value={s.id}>{s.officialDate} · {s.title}</option>)}</select></label>{main&&<p className={styles.summary}>{main.summary}</p>}
   <label>짧게 짚을 추가 소식 (선택)<select value={briefId} onChange={e=>{setBriefId(e.target.value);setContextIds(ids=>ids.filter(id=>id!==e.target.value));}}><option value="">추가 소식 없이 만들기</option>{candidates.filter(s=>s.id!==mainId).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
   <details><summary>메인 주제를 설명할 관련 자료 추가</summary><p>관련 자료는 이전 시기의 자료도 고를 수 있습니다. 별도의 메인 소식으로 다루지 않습니다.</p><div className={styles.context}>{stories.filter(s=>s.id!==mainId&&s.id!==briefId).map(s=><label key={s.id}><input type="checkbox" checked={contextIds.includes(s.id)} onChange={e=>setContextIds(ids=>e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/><span>{s.officialDate} · {s.title}</span></label>)}</div></details>
   {packet&&<details><summary>전달할 자료와 지시문 확인</summary><pre>{packet.instructions+'\n\n'+packet.sourceText}</pre></details>}
   <label className={styles.check}><input type="checkbox" checked={autoPublish&&canPublish} disabled={!canPublish} onChange={e=>setAutoPublish(e.target.checked)}/>완성되면 이 회차를 바로 공개</label>{!canPublish&&<p>제작 시험 화면에서는 오디오를 준비하고, 실제 공개는 운영 사이트에서 실행합니다.</p>}
   <button className={styles.primary} disabled={!loaded||busy||!packet||setup||(mode==='cloud'&&!cloudReady)} onClick={start}>{busy?'요청 저장 중…':autoPublish&&canPublish?'팟캐스트 만들고 자동 게시':'팟캐스트 만들기'}</button>
  </section>}
  <section className={styles.panel}><h2>제작 현황</h2>{!loaded?<p>자료를 불러오는 중입니다…</p>:!jobs.length?<p>아직 제작 중인 회차가 없습니다.</p>:jobs.map(job=><article className={styles.job} key={job.id}>
   <span>{job.packet.issueKey} · {job.execution_mode==='cloud'?'클라우드 · ':''}{labels[job.phase]??job.phase}</span><h3>{job.packet.title}</h3>{job.message&&<p>{job.message}</p>}
   {job.execution_mode==='cloud'&&job.phase==='queued'&&<p>요청을 저장했습니다. 컴퓨터를 꺼도 클라우드가 이어서 처리합니다.</p>}
   <div className={styles.actions}>{!['ready','published','cancelled'].includes(job.phase)&&<>
    {(job.execution_mode!=='cloud'||['failed','needs_login'].includes(job.phase))&&<button disabled={busy} onClick={()=>act(job,'resume')}>이어서 진행</button>}
    <button disabled={busy} onClick={()=>act(job,'cancel')}>중단</button></>}
    {job.notebook_url&&<a href={job.notebook_url} target="_blank" rel="noreferrer">NotebookLM 보기 ↗</a>}{job.audio_path&&<button disabled={busy} onClick={()=>act(job,'listen')}>완성본 듣기</button>}
    {job.phase==='ready'&&canPublish&&<button disabled={busy} onClick={()=>act(job,'publish')}>공개하기</button>}{job.phase==='published'&&<a href="/public/weekly/podcast">공개 페이지 보기 ↗</a>}</div>
   {job.execution_mode!=='cloud'&&!['published','cancelled'].includes(job.phase)&&<details><summary>자동 회수가 멈췄다면 파일 직접 연결</summary><p>이 회차의 NotebookLM에서 받은 오디오 파일을 선택하면 같은 제작 기록에 연결합니다.</p><input aria-label="완성된 오디오 직접 연결" type="file" accept=".mp3,.m4a,.wav" disabled={busy} onChange={async event=>{const file=event.currentTarget.files?.[0];if(!file)return;setBusy(true);setError('');try{await storeAudio(job.id,file);await load(true);}catch(e){setError(e instanceof Error?e.message:'파일 연결 실패');}finally{setBusy(false);}}}/></details>}
   {audio?.id===job.id&&<audio controls src={audio.url} preload="none"/>}</article>)}</section>
 </div>;
}
