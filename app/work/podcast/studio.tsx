'use client';

import {useEffect,useRef,useState} from 'react';
import {makePodcastPacket,validDay,type PodcastPacket,type PodcastStory} from '../../../lib/podcast-production';
import {rankPodcastStories,recommendedPodcastStory,resolvePodcastMain,type PodcastMainChoice} from '../../../lib/podcast-recommendation';
import {formatMonthlyWeek,monthlyWeekIssueKey,podcastEditionNumber} from '../../../lib/weekly-label';
import TeamLogin from '../../components/team-login';
import styles from './studio.module.css';

type Job={id:string;packet:PodcastPacket;phase:string;message:string;audio_path?:string;auto_publish:boolean;execution_mode?:'browser'|'cloud'};
type Episode={issue_key:string;status:string;week_start:string;week_end:string;title:string};
type Period={start:string;end:string;key:string};
type Choice={period:string;id:string};
type Selection={weekStart:string;weekEnd:string;mainId:string;briefId:string;contextIds:string[]};
const labels:Record<string,string>={queued:'제작 대기',opening:'NotebookLM 연결 중',adding_sources:'자료 전달 중',generating:'음성 제작 중',collecting:'완성된 음성 가져오는 중',uploading:'사이트에 저장 중',ready:'음성 완성',published:'게시 완료',unpublished:'게시 취소',needs_login:'Google 로그인 필요',blocked:'확인 필요',failed:'제작 오류',cancelled:'제작 중단'};

function periodFor(day:string):Period{
 const date=new Date(`${day}T00:00:00Z`);
 date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
 const end=new Date(date);end.setUTCDate(end.getUTCDate()+6);
 const start=date.toISOString().slice(0,10);
 return {start,end:end.toISOString().slice(0,10),key:monthlyWeekIssueKey(start)};
}
function initialPeriod():Period{
 const today=new Date(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})+'T00:00:00Z');
 today.setUTCDate(today.getUTCDate()-7);
 return periodFor(today.toISOString().slice(0,10));
}
export function latestCandidatePeriod(stories:PodcastStory[],fallback:Period):Period{
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
 const latest=stories.map(story=>story.officialDate).filter(day=>validDay(day)&&day<=today).sort().at(-1);
 return latest?periodFor(latest):fallback;
}
async function api(body:Record<string,unknown>){
 const response=await fetch('/api/podcast/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw Error(result.error??'요청을 처리하지 못했습니다.');return result;
}

export default function PodcastStudio(){
 const [stories,setStories]=useState<PodcastStory[]>([]),[jobs,setJobs]=useState<Job[]>([]),[episodes,setEpisodes]=useState<Episode[]>([]);
 const [login,setLogin]=useState(false),[loaded,setLoaded]=useState(false),[setup,setSetup]=useState(false),[canPublish,setCanPublish]=useState(false);
 const [cloudReady,setCloudReady]=useState(false),[cloudStatus,setCloudStatus]=useState('setup_required'),[connected,setConnected]=useState(false),[bridgeVersion,setBridgeVersion]=useState(0);
 const [reconnectAvailable,setReconnectAvailable]=useState(false),[reconnectOpened,setReconnectOpened]=useState(false);
 const [masterStatus,setMasterStatus]=useState<'idle'|'pending'|'verified'|'failed'>('idle'),[masterOpened,setMasterOpened]=useState(false),[masterAvailable,setMasterAvailable]=useState(false);
 const [period,setPeriod]=useState<Period>(initialPeriod),[mainChoice,setMainChoice]=useState<PodcastMainChoice>(),[briefChoice,setBriefChoice]=useState<Choice>();
 const [contextIds,setContextIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [audio,setAudio]=useState<{id:string;url:string}>();
 const periodChosen=useRef(false),pendingSelection=useRef<{selection:Selection;packet:string}|null>(null),submitting=useRef(false);
 const bridgePending=useRef(new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());

 async function load(jobsOnly=false){
  const response=await fetch('/api/podcast/production'+(jobsOnly?'?jobsOnly=1':''),{cache:'no-store'});
  const result=await response.json();
  if(response.status===401){setLogin(true);setLoaded(true);return;}
  if(!response.ok)throw Error(result.error??'제작 화면을 불러오지 못했습니다.');
  setLogin(false);setLoaded(true);setJobs(result.jobs??[]);setEpisodes(result.episodes??[]);
  setCloudReady(result.cloudReady===true);setCloudStatus(result.cloudStatus??'setup_required');
  setSetup(result.setupRequired===true);setCanPublish(result.canPublish===true);
  if(result.stories){setStories(result.stories);if(!periodChosen.current)setPeriod(current=>latestCandidatePeriod(result.stories,current));}
  const reconnect=await fetch('/api/podcast/reconnect',{cache:'no-store'});
  if(reconnect.ok){const status=await reconnect.json();setReconnectAvailable(status.available===true);}
  const master=await fetch('/api/podcast/bootstrap',{cache:'no-store'});
  setMasterAvailable(master.ok);
  if(master.ok){const status=await master.json();setMasterStatus(status.result??'idle');}
 }
 function bridge(command:Record<string,unknown>){return new Promise<any>((resolve,reject)=>{
  const requestId=crypto.randomUUID();
  const timer=setTimeout(()=>{bridgePending.current.delete(requestId);reject(Error('이 브라우저에 NotebookLM 연결 도구가 없습니다. 아래 첫 연결 안내를 확인해 주세요.'));},15000);
  bridgePending.current.set(requestId,{resolve,reject,timer});
  window.postMessage({type:'GT_COMMAND',requestId,command},location.origin);
 });}
 useEffect(()=>{
  function onMessage(event:MessageEvent){
   if(event.source!==window||event.origin!==location.origin)return;
   const message=event.data;
   if(message?.type==='GT_CONNECTED'){setConnected(true);return;}
   if(message?.type!=='GT_RESPONSE')return;
   const pending=bridgePending.current.get(message.requestId);if(!pending)return;
   clearTimeout(pending.timer);bridgePending.current.delete(message.requestId);
   if(message.result?.error)pending.reject(Error(message.result.error));
   else{setConnected(true);pending.resolve(message.result);}
  }
  window.addEventListener('message',onMessage);
  void bridge({type:'GT_PING'}).then(status=>setBridgeVersion(Number(status.version)||0)).catch(()=>{});
  return()=>{window.removeEventListener('message',onMessage);for(const item of bridgePending.current.values()){clearTimeout(item.timer);item.reject(Error('화면이 닫혔습니다.'));}bridgePending.current.clear();};
 },[]);
 useEffect(()=>{void load().catch(cause=>{setError(cause.message);setLoaded(true);});},[]);
 useEffect(()=>{
  const timer=setInterval(()=>void load(true).catch(cause=>setError(cause.message)),pendingSelection.current||reconnectOpened?10000:30000);
  return()=>clearInterval(timer);
 },[reconnectOpened,cloudReady]);
 async function confirmReconnect(){
  try{
   await bridge({type:'GT_RECONNECT_SAVE'});
   setReconnectOpened(false);setError('');
   setNotice('로그인 정보를 전달했습니다. 클라우드 연결을 확인한 뒤 제작을 이어갑니다.');
   await load(true);
  }catch(cause){
   const message=cause instanceof Error?cause.message:'로그인 완료 여부를 확인하지 못했습니다.';
   setError(message);
   if(message.includes('계정 메뉴'))setNotice('NotebookLM 오른쪽 위의 계정 아이콘을 한 번 누른 뒤 다시 확인해 주세요.');
  }
 }
 useEffect(()=>{
  if(!reconnectOpened||!connected||!reconnectAvailable)return;
  let stopped=false,inFlight=false;
  const until=Date.now()+15*60*1000;
  async function check(){
   if(stopped||inFlight)return;
   if(Date.now()>until){setReconnectOpened(false);pendingSelection.current=null;setError('Google 로그인 확인 시간이 지났습니다. 다시 눌러 주세요.');return;}
   inFlight=true;
   try{if(!stopped)await confirmReconnect();}
   finally{inFlight=false;}
  }
  void check();const timer=setInterval(()=>void check(),7000);
  return()=>{stopped=true;clearInterval(timer);};
 },[reconnectOpened,connected,reconnectAvailable]);
 useEffect(()=>{
  if(!masterOpened||!connected)return;
  let stopped=false,inFlight=false;
  const until=Date.now()+15*60*1000;
  async function check(){
   if(stopped||inFlight)return;
   if(Date.now()>until){setMasterOpened(false);setError('장기 로그인 연결 시간이 지났습니다. 다시 눌러 주세요.');return;}
   inFlight=true;
   try{await bridge({type:'GT_MASTER_SAVE'});if(!stopped){setMasterOpened(false);setNotice('장기 로그인 정보를 클라우드에 전달했습니다. 발급 결과를 확인하는 중입니다.');await load(true);}}
   catch(cause){if(!stopped&&cause instanceof Error&&!cause.message.includes('기다리는 중'))setError(cause.message);}
   finally{inFlight=false;}
  }
  void check();const timer=setInterval(()=>void check(),7000);
  return()=>{stopped=true;clearInterval(timer);};
 },[masterOpened,connected]);

 const ranked=rankPodcastStories(stories,period.start,period.end),candidates=ranked.map(item=>item.story);
 const periodKey=period.start+'/'+period.end;
 const mainId=resolvePodcastMain(ranked,periodKey,mainChoice);
 const main=candidates.find(story=>story.id===mainId);
 const briefId=briefChoice?.period===periodKey?briefChoice.id:(ranked.find(item=>item.story.id!==mainId)?.story.id??'');
 const brief=candidates.find(story=>story.id===briefId&&story.id!==mainId);
 const context=stories.filter(story=>contextIds.includes(story.id)&&story.id!==mainId&&story.id!==briefId);
 const selection:Selection={weekStart:period.start,weekEnd:period.end,mainId,briefId:brief?.id??'',contextIds:context.map(story=>story.id)};
 let packet:PodcastPacket|undefined;
 try{if(main)packet=makePodcastPacket({issueKey:period.key,weekStart:period.start,weekEnd:period.end,main,brief,context});}catch{}
 const packetSignature=packet?JSON.stringify(packet):'';
 const recommendation=recommendedPodcastStory(ranked);

 async function submit(selected:Selection){
  if(submitting.current)return;submitting.current=true;setBusy(true);setError('');
  try{
   const result=await api({action:'prepare',executionMode:'cloud',...selected,autoPublish:true});
   setNotice(result.job?.phase==='published'?'이 회차는 이미 게시됐습니다.':'제작을 요청했습니다. NotebookLM MCP가 음성을 만들고 완성되면 자동으로 게시합니다.');
   await load(true);
  }catch(cause){setError(cause instanceof Error?cause.message:'제작 요청에 실패했습니다.');}
  finally{setBusy(false);submitting.current=false;}
 }
 useEffect(()=>{
  const pending=pendingSelection.current;
  if(!pending||!cloudReady)return;
  pendingSelection.current=null;
  if(!packetSignature||packetSignature!==pending.packet){setError('로그인하는 동안 후보 자료가 달라졌습니다. 다시 읽고 제작 버튼을 눌러 주세요.');return;}
  void submit(pending.selection);
 },[cloudReady,packetSignature]);
 async function start(){
  if(!packet||busy||!canPublish)return;
  setError('');setNotice('');
  if(cloudReady){await submit(selection);return;}
  if(!reconnectAvailable){setError('NotebookLM 연결 기능이 준비되지 않았습니다. 잠시 후 다시 열어 주세요.');return;}
  if(!connected){setError('처음 한 번은 이 브라우저에 연결 도구를 설치해야 합니다. 아래 ‘첫 연결 안내’를 열어 주세요.');return;}
  pendingSelection.current={selection,packet:packetSignature};
  try{await bridge({type:'GT_RECONNECT_OPEN'});setReconnectOpened(true);setNotice('열린 Google 화면에서 전용 계정으로 로그인해 주세요. 완료되면 제작이 자동으로 이어집니다.');}
  catch(cause){pendingSelection.current=null;setError(cause instanceof Error?cause.message:'Google 로그인 화면을 열지 못했습니다.');}
 }
 async function act(job:Job,action:'cancel'|'listen'|'publish'|'unpublish'){
  setBusy(true);setError('');
  try{
   if(action==='listen'){const result=await api({action:'listen',jobId:job.id});setAudio({id:job.id,url:result.url});}
   else if(action==='cancel')await api({action:'progress',jobId:job.id,phase:'cancelled'});
   else await api({action,jobId:job.id});
   await load(true);
  }catch(cause){setError(cause instanceof Error?cause.message:'작업을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 }
 function choosePeriod(day:string){if(!validDay(day))return;periodChosen.current=true;setPeriod(periodFor(day));setMainChoice(undefined);setBriefChoice(undefined);setContextIds([]);pendingSelection.current=null;}
 function chooseMain(id:string){setMainChoice({period:periodKey,id});if(briefId===id)setBriefChoice({period:periodKey,id:''});setContextIds(ids=>ids.filter(value=>value!==id));pendingSelection.current=null;}
 return <div className={styles.studio}>
  <header className={styles.hero}><span>국제요정 · PODCAST</span><h1>이번 주 팟캐스트</h1><p>추천된 동향을 읽어보시고, 괜찮으면 제작 버튼 하나만 누르세요.</p><a href="/work">← 작업실</a> · <a href="/public/weekly/podcast">공개 팟캐스트 ↗</a></header>
  {login?<section className={styles.panel}><TeamLogin onSuccess={()=>void load().catch(cause=>setError(cause.message))}/></section>:<>
   <section className={styles.panel} aria-label="이번 주 제작 후보">
    <div className={styles.topline}><div><h2>자동으로 고른 후보</h2><p>{formatMonthlyWeek(period.start)} · {period.start}–{period.end} · 발표된 동향 {candidates.length}건</p></div><label>다른 주 보기<input type="date" value={period.start} onChange={event=>choosePeriod(event.target.value)}/></label></div>
    {main?<><article className={styles.storyCard}><span>깊이 다룰 주제 · {mainChoice?.period===periodKey?'직접 선택':'자동으로 먼저 표시한 후보'}</span><h3>{main.title}</h3><p>{main.summary}</p><div className={styles.storyBody}>{main.details}</div><a href={main.officialUrl} target="_blank" rel="noopener noreferrer">공식 자료 보기 ↗</a></article>
      <label>메인 주제 바꾸기<select value={mainId} onChange={event=>chooseMain(event.target.value)}>{candidates.map(story=><option key={story.id} value={story.id}>{story.title}</option>)}</select></label>
      {brief&&<article className={styles.briefCard}><span>끝에서 짧게 짚을 소식</span><h3>{brief.title}</h3><p>{brief.summary}</p><details><summary>본문 읽기</summary><div className={styles.storyBody}>{brief.details}</div><a href={brief.officialUrl} target="_blank" rel="noopener noreferrer">공식 자료 보기 ↗</a></details></article>}
      <label>짧은 소식 바꾸기<select value={brief?.id??''} onChange={event=>{setBriefChoice({period:periodKey,id:event.target.value});pendingSelection.current=null;}}><option value="">짧은 소식 없이 만들기</option>{candidates.filter(story=>story.id!==mainId).map(story=><option key={story.id} value={story.id}>{story.title}</option>)}</select></label>
      <details><summary>나머지 후보와 추천 기준 보기</summary><p>제도·판단 변화, 영향 범위, 실무 관련성, 설명할 근거를 비교해 먼저 표시할 후보를 고릅니다. 점수는 참고용이며 낮아도 위에서 자유롭게 선택할 수 있습니다.</p><ol className={styles.candidateScores}>{ranked.map(item=><li key={item.story.id}><strong>{item.story.title}</strong><span>{item.score}점 · {item.stage}</span><small>{item.story.summary}</small></li>)}</ol></details>
      <details><summary>메인 주제의 관련 자료 더하기</summary><div className={styles.context}>{stories.filter(story=>story.id!==mainId&&story.id!==briefId).map(story=><label key={story.id}><input type="checkbox" checked={contextIds.includes(story.id)} onChange={event=>{setContextIds(ids=>event.target.checked?[...ids,story.id]:ids.filter(id=>id!==story.id));pendingSelection.current=null;}}/>{story.title}</label>)}</div></details>
      <details><summary>NotebookLM에 전달할 내용 보기</summary><pre>{packet?.instructions+'\n\n'+packet?.sourceText}</pre></details>
     </>:loaded?<p>이 기간에는 제작 가능한 공개 동향이 없습니다. 다른 주를 골라 주세요.</p>:<p>동향 후보를 불러오는 중입니다…</p>}
   </section>
   <section className={styles.panel} aria-label="제작과 게시"><h2>제작과 게시</h2><p>버튼을 누르면 클라우드의 NotebookLM MCP가 자료 전달, 음성 제작, 저장, 게시를 이어서 처리합니다. 화면을 닫거나 컴퓨터를 꺼도 진행됩니다.</p>
    <p className={styles.connection} role="status">{cloudReady?'● NotebookLM 연결됨':reconnectOpened?'○ Google 로그인을 기다리는 중':cloudStatus==='needs_login'?'○ Google 로그인이 필요합니다':'○ NotebookLM 연결 확인 중'}</p>
    <button className={styles.primary} type="button" disabled={!loaded||busy||!packet||setup||!canPublish||Boolean(pendingSelection.current)} onClick={()=>void start()}>{busy?'제작 요청 중…':reconnectOpened?'Google 로그인 완료 대기 중…':'제작 후 자동으로 게시'}</button>
    {reconnectOpened&&<div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>void confirmReconnect()}>로그인 완료 확인</button><button type="button" className={styles.secondary} onClick={()=>void bridge({type:'GT_RECONNECT_OPEN'}).then(()=>setError('')).catch(cause=>setError(cause.message))}>Google 로그인 창 다시 열기</button></div>}
    {reconnectOpened&&bridgeVersion>0&&bridgeVersion<3&&<p role="alert" className={styles.error}>연결 도구가 이전 버전입니다. 아래에서 새 연결 도구를 받은 뒤 Chrome 확장 프로그램 화면에서 새로고침하고, 이 페이지도 다시 열어 주세요. <a href="/api/podcast/extension">새 연결 도구 받기</a></p>}
    {canPublish&&<p>누르면 이 회차가 완성되는 대로 실제 공개 페이지에 게시됩니다.</p>}
    {notice&&<p role="status" className={styles.summary}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
    {setup&&<p role="alert" className={styles.error}>제작 기록 연결을 확인하지 못했습니다.</p>}
    <details className={styles.setup}><summary>Google 로그인을 오래 유지하기 · 처음 한 번</summary><p>기관망에서 막히는 장기 로그인 발급은 클라우드에서 진행합니다. 이 브라우저에 최신 연결 도구를 설치한 뒤 아래 버튼을 누르고, 열린 Google 화면에서 팟캐스트 전용 계정으로 로그인해 주세요. 완료 후에는 클라우드가 결과를 확인합니다.</p><p role="status">{!masterAvailable?'장기 로그인 연결을 준비 중입니다.':masterStatus==='verified'?'장기 로그인 연결 완료':masterStatus==='pending'?'클라우드에서 장기 로그인 발급 중':masterStatus==='failed'?'발급 실패 · 다시 로그인해 주세요':'아직 장기 로그인 연결 전'}</p>{masterStatus!=='verified'&&<button type="button" className={styles.secondary} disabled={!masterAvailable||!connected||masterOpened||masterStatus==='pending'} onClick={()=>void bridge({type:'GT_MASTER_OPEN'}).then(()=>{setMasterOpened(true);setError('');}).catch(cause=>setError(cause.message))}>{masterOpened?'Google 로그인 확인 중…':'장기 로그인 연결'}</button>}<p>기존 도구를 설치하셨다면 새 연결 도구를 다시 내려받아 같은 폴더에 압축을 풀고 Chrome 확장 프로그램 화면에서 새로고침해 주세요.</p></details>
    {!cloudReady&&<details className={styles.setup}><summary>첫 연결 안내 · Google 로그인이 안 열릴 때</summary><ol><li>Chrome의 팟캐스트 전용 프로필에서 이 작업실을 엽니다.</li><li><a href="/api/podcast/extension">NotebookLM 연결 도구 받기</a>를 눌러 압축을 푼 뒤, Chrome의 <code>chrome://extensions</code>에서 ‘압축해제된 확장 프로그램을 로드합니다’로 폴더를 선택합니다. 처음 한 번만 하면 됩니다.</li><li>이 페이지를 새로고침하고 ‘제작 후 자동으로 게시’를 누릅니다.</li><li>Google 로그인 화면이 열리면 팟캐스트 전용 계정으로 로그인하고, NotebookLM 오른쪽 위 계정 아이콘을 한 번 누릅니다. 비밀번호는 국제요정 사이트에 입력하지 않습니다.</li></ol><p>{connected?'연결 도구가 이 브라우저에 연결됐습니다.':'연결 도구가 아직 보이지 않습니다.'}</p>{reconnectOpened&&<button type="button" className={styles.secondary} onClick={()=>void bridge({type:'GT_RECONNECT_SAVE'}).then(()=>load(true)).catch(cause=>setError(cause.message))}>로그인 완료 다시 확인</button>}</details>}
   </section>
   <section className={styles.panel}><h2>제작 현황</h2>{!jobs.length?<p>제작 중인 회차가 없습니다.</p>:jobs.map(job=><article className={styles.job} key={job.id}><span>{formatMonthlyWeek(job.packet.weekStart)}-{podcastEditionNumber(job.packet.issueKey)} · {labels[job.phase]??job.phase}</span><h3>{job.packet.title}</h3>{job.message&&<p>{job.message}</p>}{job.execution_mode==='browser'&&job.phase==='queued'&&<p>이전 브라우저 제작 요청입니다. 새 자동 제작은 위 버튼에서 시작해 주세요.</p>}<div className={styles.actions}>{job.audio_path&&<button disabled={busy} onClick={()=>void act(job,'listen')}>완성본 듣기</button>}{job.phase==='ready'&&canPublish&&<button disabled={busy} onClick={()=>void act(job,'publish')}>게시하기</button>}{job.phase==='published'&&<><a href="/public/weekly/podcast">공개 페이지 보기 ↗</a><button disabled={busy} onClick={()=>void act(job,'unpublish')}>게시 취소</button></>}{!['ready','published','cancelled','unpublished'].includes(job.phase)&&<button disabled={busy} onClick={()=>void act(job,'cancel')}>제작 중단</button>}</div>{audio?.id===job.id&&<audio controls src={audio.url} preload="none"/>}</article>)}</section>
   {episodes.filter(episode=>episode.status==='published'&&!jobs.some(job=>job.packet.issueKey===episode.issue_key)).length>0&&<section className={styles.panel}><h2>이전 공개 회차</h2>{episodes.filter(episode=>episode.status==='published'&&!jobs.some(job=>job.packet.issueKey===episode.issue_key)).map(episode=><p key={episode.issue_key}>{episode.title} · {episode.week_start}–{episode.week_end}</p>)}</section>}
  </>}
 </div>;
}
