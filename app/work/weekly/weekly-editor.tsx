'use client';
import {useState} from 'react';
import styles from '../../public/public.module.css';
export type WeeklyCandidate={id:string;title:string;summary:string;details:string;date:string;source:string;url:string;status:string;selectable?:boolean};
export default function WeeklyEditor({candidates,initialIds,notes,issueKey,title,start,end,save}:{candidates:WeeklyCandidate[];initialIds:string[];notes:Record<string,string>;issueKey:string;title:string;start:string;end:string;save:(form:FormData)=>Promise<void>}){
 const [ids,setIds]=useState(initialIds);
 const [busy,setBusy]=useState(false);
 const selected=ids.map(id=>candidates.find(c=>c.id===id)).filter((c):c is WeeklyCandidate=>!!c);
 const remaining=candidates.filter(c=>!ids.includes(c.id));
 function toggle(id:string){setIds(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);}
 function check(c:WeeklyCandidate){return <label style={{display:'inline-flex',gap:8,alignItems:'center',padding:10,cursor:'pointer'}}><input type="checkbox" disabled={c.selectable===false} checked={ids.includes(c.id)} onChange={()=>toggle(c.id)} aria-label={`${c.title} 주간호 포함`}/>{c.selectable===false?'한국어 초안 작성 전':'주간호 포함'}</label>;}
 return <form action={async form=>{setBusy(true);try{await save(form);}finally{setBusy(false);}}}>
 <input type="hidden" name="key" value={issueKey}/><input type="hidden" name="start" value={start}/><input type="hidden" name="end" value={end}/>
 {selected.map(c=><span key={c.id}><input type="hidden" name="report" value={c.id}/><input type="hidden" name={`reason-${c.id}`} value={notes[c.id]??'작업실에서 주요 동향으로 선정'}/></span>)}
 <div style={{position:'sticky',top:0,zIndex:5,background:'#101f2d',borderBottom:'1px solid #476173',padding:16,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
 <strong role="status" aria-live="polite">주간호 선정 {selected.length}건 / 기준 약 8건</strong><button type="submit" disabled={busy||!selected.length}>{busy?'저장 중…':'이 구성으로 주간호 초안 저장'}</button><span>체크를 바꾸면 아래 미리보기에 바로 반영됩니다.</span></div>
 <article className={styles.weeklyReport}><header className={styles.weeklyReportHeader}><p className={styles.weeklyReportKicker}>{issueKey} · {start}–{end}</p><label>주간호 제목<input name="title" defaultValue={title} required style={{display:'block',width:'100%',fontSize:26,margin:'12px 0'}}/></label><p className={styles.draftNotice}>작업실 편집본 · 검수 전 · 미공개</p><p>해당 주 동향 {candidates.length}건 중 {selected.length}건 선정</p></header>
 <section className={styles.weeklyContents}><h2>이번 주 주요 동향</h2><div className={styles.weeklyTableWrap}><table className={styles.weeklyTable}><thead><tr><th>번호</th><th>제목</th><th>출처</th><th>선정</th></tr></thead><tbody>{selected.map((c,i)=><tr key={c.id}><td>{i+1}</td><td><a href={`#selected-${c.id}`}>{c.title}</a></td><td>{c.source}</td><td>{check(c)}</td></tr>)}</tbody></table></div></section>
 <section className={styles.weeklyArticles} aria-label="공개 주간호 형태 미리보기">{selected.map((c,i)=><article className={styles.weeklyArticle} id={`selected-${c.id}`} key={c.id}><header><span className={styles.weeklyArticleNo}>{i+1}</span><h3>{c.title}</h3>{check(c)}</header><p className={styles.weeklyLead}>{c.summary}</p>{c.details.split(/\n\s*\n/).filter(Boolean).map((p,index)=><p key={index} style={{whiteSpace:'pre-wrap',lineHeight:1.9}}>{p}</p>)}<footer><span>{c.source} · {c.date} · {c.status}</span><a href={c.url} target="_blank" rel="noreferrer">공식 원문 ↗</a></footer></article>)}{!selected.length&&<p>아래 목록에서 기사를 선택해 주세요.</p>}</section></article>
 <section aria-label="같은 주의 나머지 동향" style={{marginTop:48}}><h2>같은 주의 나머지 동향 {remaining.length}건</h2><p>주간호에 넣지 않은 자료도 동향 검색에 계속 남습니다. 체크하면 위 주간호에 추가됩니다.</p>{remaining.map(c=><article key={c.id} className={styles.weeklyArticle} style={{padding:20,borderBottom:'1px solid #476173'}}><header><h3>{c.title}</h3>{check(c)}</header><p>{c.summary}</p><p>{c.source} · {c.date} · {c.status} <a href={c.url} target="_blank" rel="noreferrer">원문 ↗</a></p></article>)}</section>
 </form>;
}
