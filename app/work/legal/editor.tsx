"use client";
import {useActionState,useState} from 'react';
import type {LegalReviewPackage} from '../../../lib/legal-release';
import {saveLegalWorkingCopy} from './save-working-copy';
import styles from '../work.module.css';
export default function LegalEditor({id,revision,payload,readOnly,published}:{id:string;revision:string;payload:LegalReviewPackage;readOnly:boolean;published:boolean}) {
 const [changes,setChanges]=useState<Record<string,string>>({});const [result,action,pending]=useActionState(saveLegalWorkingCopy,{ok:false,message:'',revision});
 const field=(key:string,label:string,value:string,rows=4)=><label>{label}<textarea rows={rows} defaultValue={value} disabled={readOnly||pending} onChange={e=>setChanges(prev=>({...prev,[key]:e.target.value}))}/></label>;
 return <form action={action} className={styles.form}>
 <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={result.revision}/><input type="hidden" name="changes" value={JSON.stringify(changes)}/>
 <p>{published?'현재 공개본은 그대로 유지됩니다. 수정본 저장 후 자료 목록에서 공개할 수 있습니다.':'수정한 내용은 작업본으로 저장됩니다. 저장만으로 공개되지 않습니다.'}</p>
 {result.message&&<p className={result.ok?styles.notice:styles.error} role="status">{result.message}</p>}
 {field('summary','자료 설명',payload.instrument.summary,3)}
 <h2>한국어 번역 전문</h2>{payload.document?<>
 {field('scopeNote','판본·번역 범위 설명',payload.document.scopeNote??'',3)}
 {payload.document.sections.map(s=><details key={s.id} className={styles.card}><summary>{s.title}</summary>{s.lines.map(l=><div key={l.id}>{field('line:'+l.id,l.label||s.title,l.text,5)}</div>)}</details>)}</>:<p>한국어 공식 원문을 별도로 열람하는 자료입니다. 비교 내용을 수정할 수 있습니다.</p>}
 <h2>17개 기준 비교표</h2>{payload.cells.map(c=><details key={c.id} className={styles.card}><summary>{c.criterionOrder}. {c.criterionName}</summary>{field('cell:'+c.id+':summary','비교 요약',c.summary,5)}{field('cell:'+c.id+':exceptions','주의·예외',c.exceptions??'',3)}{field('cell:'+c.id+':articleNumbers','관련 조항 (줄마다 하나)',c.articleNumbers.join('\n'),3)}</details>)}
 <div className={styles.bulkBar}><span>{Object.keys(changes).length}곳 변경</span><button disabled={readOnly||pending||!Object.keys(changes).length}>{pending?'저장 중…':'수정본 저장'}</button><a href="/work?kind=law">자료 목록으로</a></div>
 </form>;
}
