'use client';
import {useState} from 'react';
import {weeklyPriority} from '../../../lib/weekly-priority';
import styles from './weekly.module.css';
export type WeeklyCandidate={id:string;title:string;summary:string;details:string;date:string;source:string;url:string;status:string;documentType:string;topics:string[];jurisdictions:string[]};
export default function WeeklyEditor({candidates,initialIds,notes,issueKey,title,start,end,save,readOnly=false}:{candidates:WeeklyCandidate[];initialIds:string[];notes:Record<string,string>;issueKey:string;title:string;start:string;end:string;save:(form:FormData)=>Promise<void>;readOnly?:boolean}){
 const [ids,setIds]=useState(initialIds);
 const [busy,setBusy]=useState(false);
 const [limitMessage,setLimitMessage]=useState(false);
 const byId=new Map(candidates.map(candidate=>[candidate.id,candidate]));
 const selected=ids.map(id=>byId.get(id)).filter((candidate):candidate is WeeklyCandidate=>!!candidate);
 const remaining=candidates.filter(candidate=>!ids.includes(candidate.id));
 function toggle(id:string){
  setIds(previous=>{
   if(previous.includes(id)){setLimitMessage(false);return previous.filter(value=>value!==id);}
   if(previous.length>=8){setLimitMessage(true);return previous;}
   setLimitMessage(false);return [...previous,id];
  });
 }
 function check(candidate:WeeklyCandidate){return <label className={styles.check}><input type="checkbox" checked={ids.includes(candidate.id)} onChange={()=>toggle(candidate.id)} aria-label={`${candidate.title} 주간호 포함`}/><span>주간호 포함</span></label>;}
 return <form className={styles.editor} action={async form=>{setBusy(true);try{await save(form);}finally{setBusy(false);}}}>
  <input type="hidden" name="key" value={issueKey}/><input type="hidden" name="start" value={start}/><input type="hidden" name="end" value={end}/>
  {selected.map(candidate=><span key={candidate.id}><input type="hidden" name="report" value={candidate.id}/><input type="hidden" name={`reason-${candidate.id}`} value={notes[candidate.id]??weeklyPriority(candidate).reasons.join(' · ')}/></span>)}
  <div className={styles.toolbar}><div><strong role="status" aria-live="polite">주요 동향 {selected.length}/8건</strong><p>체크를 해제하면 아래 후보를 선택할 수 있습니다.</p></div><button type="submit" disabled={readOnly||busy||!selected.length||selected.length>8}>{busy?'저장 중…':'선정안 저장'}</button></div>
  {limitMessage&&<p className={styles.alert} role="alert">8건이 모두 선택되었습니다. 위에서 한 건을 해제한 뒤 다른 자료를 선택해 주세요.</p>}
  {readOnly&&<p className={styles.notice}>미리보기에서는 선택만 시험할 수 있으며 저장되지 않습니다.</p>}
  <section className={styles.issue} aria-label="작업실 주간호 편집본">
   <header className={styles.issueHeader}><p className={styles.eyebrow}>{issueKey} · {start}–{end}</p><label className={styles.titleLabel}>주간호 제목<input name="title" defaultValue={title} required/></label><p>검수용 편집본 · 공개 전</p><p>같은 주 한국어 동향 {candidates.length}건 중 주요 동향 {selected.length}건</p></header>
   <div className={styles.issueBody}><h2>이번 주 주요 동향</h2><ol className={styles.contents}>{selected.map(candidate=><li key={candidate.id}><a href={`#selected-${candidate.id}`}>{candidate.title}</a><span>{candidate.source}</span></li>)}</ol>
   <div className={styles.stories}>{selected.map((candidate,index)=><article id={`selected-${candidate.id}`} className={styles.story} key={candidate.id}><header><span className={styles.number}>{String(index+1).padStart(2,'0')}</span><h3>{candidate.title}</h3>{check(candidate)}</header><p className={styles.reason}>선정 근거 · {notes[candidate.id]??weeklyPriority(candidate).reasons.join(' · ')}</p><p className={styles.lead}>{candidate.summary}</p>{candidate.details.split(/\n\s*\n/).filter(Boolean).map((paragraph,part)=><p className={styles.bodyText} key={part}>{paragraph}</p>)}<footer>{candidate.source} · {candidate.date} · {candidate.status} <a href={candidate.url} target="_blank" rel="noreferrer">공식 원문 ↗</a></footer></article>)}{!selected.length&&<p>아래 후보에서 자료를 선택해 주세요.</p>}</div></div>
  </section>
  <section className={styles.remaining} aria-label="같은 주의 나머지 동향"><h2>같은 주의 나머지 동향 <span>{remaining.length}건</span></h2><p>중요도 기준으로 정렬했습니다. 주간호에서 한 건을 뺀 뒤 여기에 체크하면 위 편집본에 들어갑니다.</p><div className={styles.candidateList}>{remaining.map(candidate=><article key={candidate.id} className={styles.candidate}><div><p className={styles.priority}>{weeklyPriority(candidate).reasons.join(' · ')}</p><h3>{candidate.title}</h3><p>{candidate.summary}</p><small>{candidate.source} · {candidate.date} · {candidate.status} · <a href={candidate.url} target="_blank" rel="noreferrer">공식 원문</a></small></div>{check(candidate)}</article>)}</div></section>
 </form>;
}
