'use client';
import { useEffect, useState } from 'react';
import type { LiveWorkspace, TeamRole } from '../../lib/live-team-workspace';
import type { TeamTrend } from '../../lib/team-trends';
import { teamWorkspacePrompt } from '../../lib/team-workspace-prompts';
import SubmissionDocumentsView from './submission-documents';
import TranslationReview from './translation-review';
import TeamLogin from './team-login';
import { createClient } from '../../lib/supabase/client';
import styles from './live-team-workspace.module.css';

type Workspace = LiveWorkspace & {trends:TeamTrend[];warnings:string[];databaseAvailable:boolean;canPublish:boolean;legalPublications:{recordId:string;title:string;jurisdiction:string;status:'published'|'draft'|'ready';publishedId?:string}[]};
export default function LiveTeamWorkspace({role:initialRole='trends',lawId,view}:{role?:TeamRole;lawId?:string;view?:'compare'|'full'}) {
  const [role,setRole] = useState<TeamRole>(initialRole), [data,setData] = useState<Workspace|null>(null);
  const [error,setError] = useState(''), [loading,setLoading] = useState(true), [refresh,setRefresh] = useState(0);
  const [law,setLaw] = useState(lawId??''), [checked,setChecked] = useState('');
  const [tab,setTab] = useState(lawId?'full':view??'compare');
  const [query,setQuery] = useState(''), [article,setArticle] = useState('');
  const [origin,setOrigin] = useState(''), [copied,setCopied] = useState('');
  const [loginRequired,setLoginRequired] = useState(false),[connection,setConnection]=useState<{token:string}>(),[connecting,setConnecting]=useState(false);
  const [publicationBusy,setPublicationBusy]=useState(''),[publicationMessage,setPublicationMessage]=useState('');
  const [selectedTrendIds,setSelectedTrendIds]=useState<string[]>([]);
  useEffect(()=>setOrigin(window.location.origin),[]);
  useEffect(()=>{
    let active = true, timer:ReturnType<typeof setTimeout>;
    let etag = '';
    setData(null); setLoading(true); setError('');setLoginRequired(false);setCopied('');
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch('/api/team-workspace?role='+role,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
        if (response.status !== 304) {
          const result = await response.json();
          if(active&&result.loginRequired){setLoginRequired(true);setData(null);setConnection(undefined);etag='';setError('');setLoading(false);return;}
          if (!response.ok) throw Error(result.error||'최신 자료를 확인하지 못했습니다.');
          if (active) {setData(result);etag=response.headers.get('etag')??'';setError(result.error??'');}
        } else if (active) setError('');
        if (active) {setChecked(new Date().toLocaleString('ko-KR'));setLoading(false);}
      } catch (cause) {
        if (active) {setError(cause instanceof Error?cause.message:'최신 자료 확인 실패');setLoading(false);}
      } finally {if(active) timer=setTimeout(update,120_000);}
    }
    void update();
    return ()=>{active=false;controller.abort();clearTimeout(timer);};
  },[role,refresh]);
  const selectedLaw = data?.translations.find(document=>document.id===law)??data?.translations[0];
  const trends = (data?.trends??[]).filter(item=>[item.title_ko,item.summary_ko,item.source_name,...item.jurisdictions].join(' ').toLowerCase().includes(query.toLowerCase()));
  const selected = trends.find(item=>item.id===article)??trends[0];
  const prompt = origin?teamWorkspacePrompt(role,origin,connection):'';
  async function copyPrompt() {
    if(connecting)return;setConnecting(true);
    let nextPrompt=prompt;
    try {
      if(role==='trends') {
        const response=await fetch('/api/team-workspace/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revoke:false})});
        const result=await response.json();if(!response.ok)throw Error(result.error);
        setConnection(result);nextPrompt=teamWorkspacePrompt(role,origin,result);
      }
      try{await navigator.clipboard.writeText(nextPrompt);setCopied('복사했습니다. Codex에 붙여 넣으세요.');}
      catch{setCopied('아래 내용을 선택해 복사해 주세요.');}
    } catch(cause){setCopied(cause instanceof Error?cause.message:'연결하지 못했습니다.');}
    finally{setConnecting(false);}
  }
  async function setPublicationStatus(itemId:string,action:'publish'|'unpublish',officialUrl?:string) {
    if(!data||!data.canPublish||publicationBusy)return;
    const label=action==='publish'?'공개':'공개 취소';
    if(!window.confirm(`이 자료를 ${label}하시겠습니까? ${action==='publish'?'공개 페이지에 바로 반영됩니다.':'공개 페이지에서 내려가며 작업 자료는 보존됩니다.'}`))return;
    const key=role+':'+itemId;setPublicationBusy(key);setPublicationMessage('');
    try {
      const response=await fetch('/api/team-workspace/publication',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,action,itemId,officialUrl,branchSha:data.commitSha})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'공개 상태를 바꾸지 못했습니다.');
      setPublicationMessage(`공개 상태를 ${action==='publish'?'공개':'비공개'}로 변경했습니다.`);setRefresh(value=>value+1);
    } catch(error) {setPublicationMessage(error instanceof Error?error.message:'공개 상태를 바꾸지 못했습니다.');}
    finally {setPublicationBusy('');}
  }
  async function publishSelectedTrends() {
    if(!data?.canPublish||!selectedTrendIds.length||publicationBusy)return;
    const selectedRows=data.trends.filter(item=>selectedTrendIds.includes(item.id));
    const blocked=selectedRows.filter(item=>item.status==='published'||item.editState==='conflict');
    const eligible=selectedRows.filter(item=>item.status!=='published'&&item.editState!=='conflict');
    if(!eligible.length){setPublicationMessage('선택한 원고 중 공개할 수 있는 자료가 없습니다. 이미 공개된 자료나 기준 원고가 바뀐 자료는 제외됩니다.');return;}
    if(!window.confirm(`${eligible.length}건을 공개하시겠습니까? 공개 후 공개 페이지에서 누구나 볼 수 있습니다.${blocked.length?` 공개 중이거나 수정 대조가 필요한 ${blocked.length}건은 제외됩니다.`:''}`))return;
    setPublicationBusy('batch');setPublicationMessage('');let succeeded=0;const failed:string[]=[];
    for(const item of eligible){try{const response=await fetch('/api/team-workspace/publication',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'trends',action:'publish',itemId:item.id,officialUrl:item.official_url,branchSha:data.commitSha})});const result=await response.json();if(!response.ok)throw Error(result.error||'공개하지 못했습니다.');succeeded++;}catch(error){failed.push(`${item.title_ko}: ${error instanceof Error?error.message:'오류'}`);}}
    setSelectedTrendIds([]);setPublicationMessage(`일괄 공개 결과: ${succeeded}건 성공${failed.length?`, ${failed.length}건 실패 — ${failed.join(' / ')}`:''}${blocked.length?`, ${blocked.length}건 제외`:''}.`);setRefresh(value=>value+1);setPublicationBusy('');
  }
  return <main className={styles.page}>
    <header className={styles.header}>
      <h1>{role==='legal'?'법제':'동향'} 작업실</h1>
      <p>자료를 읽고, 고칠 점을 평소 사용하시는 Codex에 말씀해 주세요. Codex가 저장한 수정본을 이 화면에서 다시 확인하실 수 있습니다.</p>
      <nav aria-label="담당 선택"><button aria-pressed={role==='trends'} onClick={()=>{setRole('trends');setQuery('');}}>동향 담당</button><button aria-pressed={role==='legal'} onClick={()=>setRole('legal')}>법제 담당</button><a href="/team/podcast">팟캐스트 제작</a><a href="/public">공개 페이지 ↗</a></nav>
      <div role="status" aria-live="polite">{loading?'최신 자료를 불러오는 중입니다…':loginRequired?'팀 계정 로그인이 필요합니다.':data?'자료 '+data.commitSha.slice(0,7)+' · 연결 확인 '+checked:'아직 최신 자료를 읽지 못했습니다.'}</div>
      <button onClick={()=>setRefresh(value=>value+1)}>지금 새로 확인</button>
      {role==='trends'&&data?.databaseAvailable&&<button onClick={async()=>{await createClient().auth.signOut();setData(null);setConnection(undefined);setRefresh(value=>value+1);}}>로그아웃</button>}
      <details className={styles.help}><summary>Codex에 수정 요청하는 방법 · 예시 프롬프트</summary>
        {role==='trends'?<><h2>동향 담당자 안내</h2><ol><li>로그인한 뒤 원고 제목을 눌러 제목·요약·본문을 읽습니다. 검색칸에 나라나 기관 이름을 쓰면 원하는 원고를 찾기 쉽습니다.</li><li>고칠 점을 메모하고 ‘Codex 연결 프롬프트 복사’를 누릅니다.</li><li>본인 Codex 대화창에 붙여 넣고, 맨 끝에 고칠 점을 평소 말하듯 적어 보냅니다.</li><li>Codex가 저장을 마치면 여기로 돌아와 ‘지금 새로 확인’을 누릅니다. 바뀐 원고를 다시 읽습니다.</li><li>공개하려면 공개할 원고 옆 네모를 체크합니다. 여러 건을 고르거나, ‘현재 검색 결과 중 공개 가능한 자료 선택’을 눌러 한꺼번에 고를 수 있습니다.</li><li>‘선택한 원고 공개’ 옆 숫자가 맞는지 확인하고 누른 뒤, 확인 창에서 한 번 더 확인합니다.</li></ol><p>자동수집 원고도 초안 작성까지 끝나면 이 목록에 나타납니다. 목록에 있다고 이미 공개된 것은 아닙니다.</p></>:<><h2>법제 담당자 안내</h2><ol><li>‘17개 기준 비교표’에서 나라별로 적힌 내용을 읽습니다. 각 칸을 눌러 근거와 관련 조항을 확인합니다.</li><li>‘법률별 전체 번역’을 누르고, 살펴볼 법률을 고릅니다. 번역문을 처음부터 끝까지 읽으며 빠진 조문이나 어색한 표현을 메모합니다.</li><li>‘Codex 연결 프롬프트 복사’를 눌러 본인 Codex에 붙여 넣고, 고칠 점을 평소 말하듯 적어 보냅니다.</li><li>Codex가 저장을 마치면 ‘지금 새로 확인’을 누릅니다. 비교표와 번역문이 바뀌었는지 다시 확인합니다.</li><li>비교표를 공개하려면 표 아래에서 해당 법률 옆의 버튼을 누릅니다. 처음 공개할 때는 ‘이 법률 공개’, 공개 중인 자료를 바꿀 때는 ‘이 법률의 수정 내용 공개’를 누릅니다. 해당 법률의 비교표와 전체 번역이 함께 바뀝니다.</li></ol></>}
        <button disabled={!prompt||connecting||(role==='trends'&&(!data?.databaseAvailable||loginRequired))} onClick={copyPrompt}>{connecting?'연결 중…':'Codex 연결 프롬프트 복사'}</button><span role="status">{copied}</span>
        {role==='trends'&&<p>연결키는 별도 만료 없이 유지되며, 이 계정에서 새 키를 발급하거나 ‘Codex 연결 해제’를 누르면 이전 키가 즉시 무효화됩니다. 원고 읽기와 비공개 수정본 저장만 허용하고 발행·삭제·관리 기능은 허용하지 않습니다. 키를 공개 GitHub·PR·파일·로그에 넣지 마세요.</p>}
        {role==='trends'&&data?.databaseAvailable&&<button onClick={async()=>{try{const response=await fetch('/api/team-workspace/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revoke:true})});if(!response.ok)throw Error();setConnection(undefined);setCopied('Codex 작업실 연결을 해제했습니다.');}catch{setCopied('연결 해제에 실패했습니다. 다시 시도해 주세요.');}}}>Codex 연결 해제</button>}
        <textarea aria-label="Codex에 넣을 예시 프롬프트" value={prompt} readOnly rows={14}/>
        <a href={'/api/team-workspace?role='+role} target="_blank" rel="noopener noreferrer">Codex가 읽는 자료 연결 주소 ↗</a>
      </details>
    </header>
    {loginRequired&&<section className={styles.documents}><TeamLogin onSuccess={()=>setRefresh(value=>value+1)}/></section>}
    {error && <div role="alert" className={styles.error}><strong>{data?'연결을 확인하지 못해 마지막 자료를 표시합니다.':'자료 읽기에 실패했습니다.'}</strong><p>{error}</p></div>}
    {data?.warnings?.map(message=><p role="alert" className={styles.error} key={message}>{message}</p>)}
    {data&&!data.canPublish&&<section className={styles.publication}><strong>공개하려면 담당자 등록이 필요합니다</strong><p>로그인했는데 공개 버튼이 보이지 않으면 작업실 관리자에게 “공개할 수 있는 담당자로 등록해 주세요”라고 알려 주세요.</p><TeamLogin onSuccess={()=>setRefresh(value=>value+1)}/></section>}
    {publicationMessage&&<p role="status" className={styles.publicationMessage}>{publicationMessage}</p>}
    {data && role==='trends' && <section className={styles.documents} aria-label="동향 원고">
      <h2>동향 원고 {data.trends.length}건{!data.databaseAvailable?' · 일부 자료':''}</h2><label>원고 검색 <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="제목·국가·출처 검색"/></label><p>{trends.length}건 표시 · 선택 {selectedTrendIds.length}건</p>
      {data.canPublish&&<div className={styles.publication}><label><input type="checkbox" checked={trends.some(item=>item.status!=='published'&&item.editState!=='conflict')&&trends.filter(item=>item.status!=='published'&&item.editState!=='conflict').every(item=>selectedTrendIds.includes(item.id))} onChange={event=>{const available=trends.filter(item=>item.status!=='published'&&item.editState!=='conflict').map(item=>item.id);setSelectedTrendIds(event.target.checked?Array.from(new Set([...selectedTrendIds,...available])):selectedTrendIds.filter(id=>!trends.some(item=>item.id===id)))}}/> 현재 검색 결과 중 공개 가능한 자료 선택</label><button disabled={!selectedTrendIds.length||Boolean(publicationBusy)} onClick={()=>void publishSelectedTrends()}>{publicationBusy==='batch'?'일괄 공개 중…':`선택한 원고 공개 (${selectedTrendIds.length}건)`}</button><p>이미 공개 중이거나 기준 원고가 바뀌어 대조가 필요한 원고는 선택할 수 없습니다.</p></div>}
      <div className={styles.trendGrid}><div className={styles.articleList}>{trends.map(item=><div className={styles.articleChoice} key={item.id}><label><input type="checkbox" aria-label={`${item.title_ko} 선택`} checked={selectedTrendIds.includes(item.id)} disabled={!data.canPublish||item.status==='published'||item.editState==='conflict'} onChange={event=>setSelectedTrendIds(event.target.checked?[...selectedTrendIds,item.id]:selectedTrendIds.filter(id=>id!==item.id))}/></label><button aria-pressed={selected?.id===item.id} onClick={()=>setArticle(item.id)}><strong>{item.title_ko}</strong><small>{item.published_date} · {item.source_name}</small><span>{item.summary_ko}</span>{item.editState==='applied'&&<small>Codex 수정본</small>}{item.editState==='conflict'&&<small>원고 변경됨 · 수정본 대조 필요</small>}</button></div>)}</div>
      <article className={styles.article} aria-label="선택한 동향 원고">{selected?<><p>{selected.published_date} · {selected.source_name}</p><h2>{selected.title_ko}</h2><p className={styles.lede}>{selected.summary_ko}</p><div className={styles.prose}>{selected.details_ko}</div><a href={selected.official_url} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>{selected.proposedEdit&&<details><summary>최신 원고와 대조가 필요한 Codex 수정본</summary><h3>{selected.proposedEdit.title_ko}</h3><p>{selected.proposedEdit.summary_ko}</p><div className={styles.prose}>{selected.proposedEdit.details_ko}</div></details>}{data.canPublish&&<div className={styles.publication}><strong>공개 상태: {selected.status==='published'?'공개 중':'비공개'}</strong><p>Codex 수정본이 있으면 공개할 때 게시본에 반영됩니다. 기준 원고와 충돌한 수정본은 공개되지 않습니다.</p><button disabled={Boolean(publicationBusy)} onClick={()=>void setPublicationStatus(selected.id,selected.status==='published'?'unpublish':'publish',selected.official_url)}>{publicationBusy===role+':'+selected.id?'처리 중…':selected.status==='published'?'공개 취소':'공개하기'}</button></div>}</>:<p>검색 조건에 맞는 원고가 없습니다.</p>}</article></div>
    </section>}
    {data && role==='legal' && <section className={styles.documents} aria-label="법제 자료">
      <div className={styles.publicationList}><div><h2>법제 공개 상태</h2><p>공개하면 그 법률의 17개 기준 비교표와 전체 번역이 함께 반영됩니다.</p></div>{data.legalPublications.map(item=><article key={item.recordId}><div><strong>{item.title}</strong><span>{item.jurisdiction} · {item.status==='published'?'공개 중':item.publishedId?'새 판본 준비됨 · 기존 판본 공개 중':item.status==='draft'?'비공개 · 저장된 초안':'아직 비공개'}</span></div>{data.canPublish&&<div><button disabled={Boolean(publicationBusy)} onClick={()=>void setPublicationStatus(item.recordId,'publish')}>{publicationBusy===role+':'+item.recordId?'처리 중…':item.status==='published'?'공개 내용 갱신':'공개하기'}</button>{item.publishedId&&<button disabled={Boolean(publicationBusy)} onClick={()=>void setPublicationStatus(item.recordId,'unpublish')}>현재 공개 취소</button>}</div>}</article>)}</div>
      <nav className={styles.tabs} aria-label="법제 보기"><button aria-pressed={tab==='compare'} onClick={()=>setTab('compare')}>17개 기준 비교표</button><button aria-pressed={tab==='full'} onClick={()=>setTab('full')}>법률별 전체 번역</button></nav>
      {tab==='compare'?<><SubmissionDocumentsView documents={data.documents} branch={data.branch} commitSha={data.commitSha} showFeedback={false}/><section className={styles.publication} aria-label="비교표 공개"><strong>17개 기준 비교표 수정 내용 공개</strong><p>표를 확인한 뒤, 바뀐 법률을 골라 버튼을 누르세요. 그 법률의 비교표와 전체 번역이 함께 공개됩니다.</p>{data.canPublish&&<div className={styles.publicationList}>{data.legalPublications.map(item=><article key={item.recordId}><div><strong>{item.title}</strong><span>{item.status==='published'?'현재 공개 중':item.publishedId?'이전 내용 공개 중':'아직 공개 전'}</span></div><button disabled={Boolean(publicationBusy)} onClick={()=>void setPublicationStatus(item.recordId,'publish')}>{publicationBusy===role+':'+item.recordId?'반영 중…':item.status==='published'?'이 법률의 수정 내용 공개':'이 법률 공개'}</button></article>)}</div>}</section></>:<>
        <label>법률 선택 <select value={selectedLaw?.id??''} onChange={event=>setLaw(event.target.value)}>{data.translations.map(document=><option key={document.id} value={document.id}>{document.title} · {document.articleCount}조</option>)}</select></label>
        {data.translationErrors.map(entry=><p role="alert" key={entry.id}>{entry.id}: {entry.error}</p>)}
        {law&&!data.translations.some(document=>document.id===law)&&<p role="alert">요청한 법률을 읽지 못했습니다. 현재 읽을 수 있는 법률을 표시합니다.</p>}
        {selectedLaw?<TranslationReview key={selectedLaw.id} {...selectedLaw} lawId={selectedLaw.id} branch={data.branch} commitSha={data.commitSha} showFeedback={false}/>:<p>아직 읽을 수 있는 전체 번역이 없습니다.</p>}
      </>}
    </section>}
  </main>;
}
