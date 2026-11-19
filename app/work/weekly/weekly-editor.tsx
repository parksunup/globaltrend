'use client';
import {useState} from 'react';
import {weeklyPriority} from '../../../lib/weekly-priority';
import {formatMonthlyWeek} from '../../../lib/weekly-label';
import styles from './weekly.module.css';
export type WeeklyCandidate={id:string;title:string;summary:string;details:string;date:string;source:string;url:string;status:string;documentType:string;topics:string[];jurisdictions:string[]};
export default function WeeklyEditor({candidates,initialIds,notes,issueKey,title,start,end,save,readOnly=false,published=false,onDirty}:{candidates:WeeklyCandidate[];initialIds:string[];notes:Record<string,string>;issueKey:string;title:string;start:string;end:string;save:(form:FormData)=>Promise<void>;readOnly?:boolean;published?:boolean;onDirty?:()=>void}){
 const [ids,setIds]=useState(initialIds);
 const [busy,setBusy]=useState(false);
 const [limitMessage,setLimitMessage]=useState(false);
 const byId=new Map(candidates.map(candidate=>[candidate.id,candidate]));
 const selected=ids.map(id=>byId.get(id)).filter((candidate):candidate is WeeklyCandidate=>!!candidate);
 const hasMissing=selected.some(candidate=>candidate.status==='missing');
 const remaining=candidates.filter(candidate=>!ids.includes(candidate.id));
 function toggle(id:string){
  if(ids.includes(id)||ids.length<8)onDirty?.();
  setIds(previous=>{
   if(previous.includes(id)){setLimitMessage(false);return previous.filter(value=>value!==id);}
   if(previous.length>=8){setLimitMessage(true);return previous;}
   setLimitMessage(false);return [...previous,id];
  });
 }
 function check(candidate:WeeklyCandidate){const checked=ids.includes(candidate.id);return <label className={styles.check}><input type="checkbox" checked={checked} disabled={!checked&&candidate.status!=='published'} onChange={()=>toggle(candidate.id)} aria-label={`${candidate.title} 주간호 포함`}/><span>{candidate.status==='published'?'주간호 포함':candidate.status==='missing'?'목록에서 찾지 못함 · 체크 해제해 제외':checked?'공개 취소됨 · 체크 해제해 제외':'공개 취소됨'}</span></label>;}
 return <form className={styles.editor} action={async form=>{setBusy(true);try{await save(form);}finally{setBusy(false);}}}>
  <input type="hidden" name="key" value={issueKey}/><input type="hidden" name="start" value={start}/><input type="hidden" name="end" value={end}/>
  {selected.map(candidate=><span key={candidate.id}><input type="hidden" name="report" value={candidate.id}/><input type="hidden" name={`reason-${candidate.id}`} value={notes[candidate.id]??weeklyPriority(candidate).reasons.join(' · ')}/></span>)}
  <div className={styles.toolbar}><div><strong role="status" aria-live="polite">주요 동향 {selected.length}/8건</strong><p>체크를 해제하면 아래 후보를 선택할 수 있습니다.</p></div><button type="submit" disabled={readOnly||busy||!selected.length||selected.length>8||hasMissing}>{busy?'저장 중…':'선정안 저장'}</button></div>
  {hasMissing&&<p className={styles.alert} role="alert">저장 전에 목록에서 찾지 못한 자료의 체크를 해제해 주세요.</p>}
  {limitMessage&&<p className={styles.alert} role="alert">8건이 모두 선택되었습니다. 위에서 한 건을 해제한 뒤 다른 자료를 선택해 주세요.</p>}
  {readOnly&&<p className={styles.notice}>미리보기에서는 선택만 시험할 수 있으며 저장되지 않습니다.</p>}
  <section className={styles.issue} aria-label="작업실 주간호 편집본">
   <header className={styles.issueHeader}><p className={styles.eyebrow}>{formatMonthlyWeek(start)} · {start}–{end}</p><label className={styles.titleLabel}>주간 동향 제목<input name="title" defaultValue={title} onChange={()=>onDirty?.()} required/></label><p>{published?'공개 중 · 변경 사항은 저장 즉시 반영':'작업실 편집본 · 공개 전'}</p><p>같은 주 한국어 동향 {candidates.length}건 중 주요 동향 {selected.length}건</p></header>
   <div className={styles.issueBody}><h2>이번 주 주요 동향</h2><ol className={styles.contents}>{selected.map(candidate=><li key={candidate.id}>{candidate.status==='missing'?candidate.title:<a href={`#selected-${candidate.id}`}>{candidate.title}</a>}<span>{candidate.source}</span></li>)}</ol>
   <div className={styles.stories}>{selected.map((candidate,index)=><article id={`selected-${candidate.id}`} className={styles.story} key={candidate.id}><header><span className={styles.number}>{String(index+1).padStart(2,'0')}</span><h3>{candidate.title}</h3>{check(candidate)}</header>{candidate.status==='missing'?<p className={styles.alert}>이 자료를 찾을 수 없어 공개된 주간호에서 제외할 수만 있습니다.</p>:<><p className={styles.reason}>선정 근거 · {notes[candidate.id]??weeklyPriority(candidate).reasons.join(' · ')}</p><p className={styles.lead}>{candidate.summary}</p>{candidate.details.split(/\n\s*\n/).filter(Boolean).map((paragraph,part)=><p className={styles.bodyText} key={part}>{paragraph}</p>)}<footer>{candidate.source} · {candidate.date} · {candidate.status} <a href={candidate.url} target="_blank" rel="noreferrer">공식 원문 ↗</a></footer></>}</article>)}{!selected.length&&<p>아래 후보에서 자료를 선택해 주세요.</p>}</div></div>
  </section>
  <section className={styles.remaining} aria-label="같은 주의 나머지 동향"><h2>같은 주의 나머지 동향 <span>{remaining.length}건</span></h2><p>후보는 개인정보·권리 직접성(25), 동향 단계(20), 한국 관련성·실무성(15), 영향 범위·심각성(15), 정책·사회 학습 가치(15), 원문·근거(10)로 100점 평가해 정렬합니다. 과징금 액수에는 가점을 주지 않습니다. 비과징금 후보가 6건 이상이면 기본 선택 8건 중 과징금 사건은 최대 2건입니다. 점수는 편집 참고이며 직접 선택은 언제든 변경할 수 있습니다.</p><div className={styles.candidateList}>{remaining.map(candidate=><article key={candidate.id} className={styles.candidate}><div><p className={styles.priority}>{weeklyPriority(candidate).reasons.join(' · ')}</p><h3>{candidate.title}</h3><p>{candidate.summary}</p><small>{candidate.source} · {candidate.date} · {candidate.status} · <a href={candidate.url} target="_blank" rel="noreferrer">공식 원문</a></small></div>{check(candidate)}</article>)}</div></section>
 </form>;
}
