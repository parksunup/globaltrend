'use client';
import { useEffect, useState } from 'react';
import type { LiveWorkspace, TeamRole } from '../../lib/live-team-workspace';
import SubmissionPreview from './submission-preview';
import TranslationReview from './translation-review';
import SubmissionFeedback from './submission-feedback';
import styles from './live-team-workspace.module.css';

export default function LiveTeamWorkspace({role:initialRole='trends',lawId,view}:{role?:TeamRole;lawId?:string;view?:'compare'}) {
  const [role,setRole] = useState<TeamRole>(initialRole), [data,setData] = useState<LiveWorkspace|null>(null);
  const [error,setError] = useState(''), [loading,setLoading] = useState(true), [refresh,setRefresh] = useState(0);
  const [law,setLaw] = useState(lawId??''), [checked,setChecked] = useState('');
  useEffect(()=>{
    let active = true, timer:ReturnType<typeof setTimeout>;
    let etag = '';
    setData(null); setLoading(true); setError('');
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch('/api/team-workspace?role='+role,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
        if (response.status !== 304) {
          const result = await response.json();
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
  const selectedLaw = data?.translations.find(document=>document.id===law);
  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/team">담당자 작업 확인</a><h1>올린 작업을 바로 확인하세요</h1>
      <p>배정된 GitHub 브랜치에 저장·업로드(push)한 자료를 자동으로 읽습니다. PR 병합이나 자료별 사이트 재배포는 필요하지 않습니다.</p>
      <p>2분 간격으로 자동 확인하며, 캐시 갱신까지 몇 분 걸릴 수 있습니다. ChatGPT 대화만 하거나 업로드하지 않은 파일은 보이지 않습니다. 여기서 확인하는 것과 대외 공개·발행은 별개입니다.</p>
      <nav aria-label="담당 선택"><button aria-pressed={role==='trends'} onClick={()=>{setRole('trends');setLaw('');}}>동향 담당</button><button aria-pressed={role==='legal'} onClick={()=>{setRole('legal');setLaw('');}}>법제 담당</button><a href="/public">공개 페이지</a></nav>
      <div role="status" aria-live="polite">{loading?'최신 제출 자료를 불러오는 중입니다…':data?data.branch+' · 자료 '+data.commitSha.slice(0,7)+' · 연결 확인 '+checked:'아직 최신 자료를 읽지 못했습니다.'}</div>
      <button onClick={()=>setRefresh(value=>value+1)}>다시 연결</button>
      {data && <a href={'https://github.com/parksunup/globaltrend/tree/'+data.commitSha+'/data/'+(role==='legal'?'legal':'trends')} target="_blank" rel="noopener noreferrer">지금 보고 있는 원본 ↗</a>}
    </header>
    {error && <div role="alert" className={styles.error}><strong>{data?'최신 확인에 실패했습니다. 아래는 마지막으로 읽은 자료입니다.':'자료 읽기에 실패했습니다.'}</strong><p>{error}</p>{data&&<p>마지막 자료 확인: {new Date(data.checkedAt).toLocaleString('ko-KR')}</p>}</div>}
    {data && <>
      {role==='legal' && <section className={styles.documents} aria-label="전체 번역 선택"><h2>법률별 전체 번역</h2><p>미발행·공개 보류 상태도 제출된 본문은 여기에서 읽을 수 있습니다. 빈 조문이나 읽기 오류는 검토할 문제로 남깁니다.</p>
        <div><button aria-pressed={!law} onClick={()=>setLaw('')}>비교표·전체 제출 목록</button>{data.translations.map(document=><button key={document.id} aria-pressed={law===document.id} onClick={()=>setLaw(document.id)}>{document.title} · {document.articleCount}조</button>)}</div>
        {data.translationErrors.map(entry=><p role="alert" key={entry.id}>{entry.id}: {entry.error}</p>)}
        {law&&!selectedLaw&&<p role="alert">요청한 법률의 읽을 수 있는 조문 데이터가 없습니다. 아래 제출 자료와 파일 오류를 확인해 주세요.</p>}
      </section>}
      {selectedLaw ? <TranslationReview {...selectedLaw} lawId={selectedLaw.id} branch={data.branch} commitSha={data.commitSha}/> : <SubmissionPreview items={data.items} documents={data.documents} branch={data.branch} commitSha={data.commitSha} initialDocument={view==='compare'}/>}
      <section className={styles.documents}><h2>작성 지침·검토 기록·보조 자료</h2><p>담당자가 제출한 Markdown 자료도 파일을 따로 열지 않고 읽을 수 있습니다.</p>
        {data.notes.length?data.notes.map(note=><details key={note.path}><summary>{note.path}</summary><pre>{note.text}</pre><SubmissionFeedback itemId={'file-'+note.path} branch={data.branch} commitSha={data.commitSha}/></details>):<p>제출된 보조 문서가 없습니다.</p>}
      </section>
    </>}
  </main>;
}
