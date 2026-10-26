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

type Workspace = LiveWorkspace & {trends:TeamTrend[];warnings:string[];databaseAvailable:boolean};
export default function LiveTeamWorkspace({role:initialRole='trends',lawId,view}:{role?:TeamRole;lawId?:string;view?:'compare'|'full'}) {
  const [role,setRole] = useState<TeamRole>(initialRole), [data,setData] = useState<Workspace|null>(null);
  const [error,setError] = useState(''), [loading,setLoading] = useState(true), [refresh,setRefresh] = useState(0);
  const [law,setLaw] = useState(lawId??''), [checked,setChecked] = useState('');
  const [tab,setTab] = useState(lawId?'full':view??'compare');
  const [query,setQuery] = useState(''), [article,setArticle] = useState('');
  const [origin,setOrigin] = useState(''), [copied,setCopied] = useState('');
  const [loginRequired,setLoginRequired] = useState(false),[connection,setConnection]=useState<{token:string}>(),[connecting,setConnecting]=useState(false);
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
  return <main className={styles.page}>
    <header className={styles.header}>
      <h1>{role==='legal'?'법제':'동향'} 작업실</h1>
      <p>자료를 읽고, 고칠 점을 평소 사용하시는 Codex에 말씀해 주세요. Codex가 저장한 수정본을 이 화면에서 다시 확인하실 수 있습니다.</p>
      <nav aria-label="담당 선택"><button aria-pressed={role==='trends'} onClick={()=>{setRole('trends');setQuery('');}}>동향 담당</button><button aria-pressed={role==='legal'} onClick={()=>setRole('legal')}>법제 담당</button><a href="/public">공개 페이지 ↗</a></nav>
      <div role="status" aria-live="polite">{loading?'최신 자료를 불러오는 중입니다…':loginRequired?'팀 계정 로그인이 필요합니다.':data?'자료 '+data.commitSha.slice(0,7)+' · 연결 확인 '+checked:'아직 최신 자료를 읽지 못했습니다.'}</div>
      <button onClick={()=>setRefresh(value=>value+1)}>지금 새로 확인</button>
      {role==='trends'&&data?.databaseAvailable&&<button onClick={async()=>{await createClient().auth.signOut();setData(null);setConnection(undefined);setRefresh(value=>value+1);}}>로그아웃</button>}
      <details className={styles.help}><summary>Codex에 수정 요청하는 방법 · 예시 프롬프트</summary>
        <ol><li>아래 자료를 읽고 수정할 내용을 자유롭게 메모하세요. 항목마다 의견을 등록할 필요는 없습니다.</li><li>아래 프롬프트를 복사해 본인의 Codex에 붙여 넣고, 마지막에 수정 요청을 적으세요.</li><li>Codex가 저장을 마치면 이 화면에서 결과를 확인하세요. 동향 DB 원고는 작업실에, 법제·GitHub 조사 자료는 기존 담당 브랜치에 저장합니다. 화면은 2분마다 확인합니다.</li></ol>
        <p>PR 병합이나 자료별 사이트 재배포는 필요하지 않습니다. Supabase 관리자 권한과 Vercel 팀 가입도 필요하지 않습니다. 동향 초안은 사이트 팀 계정으로 로그인해서 읽습니다. 본인의 Codex에는 기존 담당 브랜치에 저장할 GitHub 권한이 있어야 합니다.</p>
        <p>이 작업실의 수정은 작업 초안입니다. 대외 발행은 별도로 진행합니다.</p>
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
    {data && role==='trends' && <section className={styles.documents} aria-label="동향 원고">
      <h2>동향 원고 {data.trends.length}건{!data.databaseAvailable?' · 일부 자료':''}</h2><label>원고 검색 <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="제목·국가·출처 검색"/></label><p>{trends.length}건 표시</p>
      <div className={styles.trendGrid}><div className={styles.articleList}>{trends.map(item=><button key={item.id} aria-pressed={selected?.id===item.id} onClick={()=>setArticle(item.id)}><strong>{item.title_ko}</strong><small>{item.published_date} · {item.source_name}</small><span>{item.summary_ko}</span>{item.editState==='applied'&&<small>Codex 수정본</small>}{item.editState==='conflict'&&<small>원고 변경됨 · 수정본 대조 필요</small>}</button>)}</div>
      <article className={styles.article} aria-label="선택한 동향 원고">{selected?<><p>{selected.published_date} · {selected.source_name}</p><h2>{selected.title_ko}</h2><p className={styles.lede}>{selected.summary_ko}</p><div className={styles.prose}>{selected.details_ko}</div><a href={selected.official_url} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>{selected.proposedEdit&&<details><summary>최신 원고와 대조가 필요한 Codex 수정본</summary><h3>{selected.proposedEdit.title_ko}</h3><p>{selected.proposedEdit.summary_ko}</p><div className={styles.prose}>{selected.proposedEdit.details_ko}</div></details>}</>:<p>검색 조건에 맞는 원고가 없습니다.</p>}</article></div>
    </section>}
    {data && role==='legal' && <section className={styles.documents} aria-label="법제 자료">
      <nav className={styles.tabs} aria-label="법제 보기"><button aria-pressed={tab==='compare'} onClick={()=>setTab('compare')}>17개 기준 비교표</button><button aria-pressed={tab==='full'} onClick={()=>setTab('full')}>법률별 전체 번역</button></nav>
      {tab==='compare'?<SubmissionDocumentsView documents={data.documents} branch={data.branch} commitSha={data.commitSha} showFeedback={false}/>:<>
        <label>법률 선택 <select value={selectedLaw?.id??''} onChange={event=>setLaw(event.target.value)}>{data.translations.map(document=><option key={document.id} value={document.id}>{document.title} · {document.articleCount}조</option>)}</select></label>
        {data.translationErrors.map(entry=><p role="alert" key={entry.id}>{entry.id}: {entry.error}</p>)}
        {law&&!data.translations.some(document=>document.id===law)&&<p role="alert">요청한 법률을 읽지 못했습니다. 현재 읽을 수 있는 법률을 표시합니다.</p>}
        {selectedLaw?<TranslationReview key={selectedLaw.id} {...selectedLaw} lawId={selectedLaw.id} branch={data.branch} commitSha={data.commitSha} showFeedback={false}/>:<p>아직 읽을 수 있는 전체 번역이 없습니다.</p>}
      </>}
    </section>}
  </main>;
}
