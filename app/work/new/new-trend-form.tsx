"use client";
import {useRef,useState,type FormEvent} from 'react';
import type {TrendImportCandidate} from '../../../lib/trend-import';
import {createWorkspaceNewDraft} from './save';
import styles from '../work.module.css';
export default function NewTrendForm({sources,candidate,candidateSource,readOnlyPreview}:{sources:{id:string;name:string}[];candidate?:TrendImportCandidate;candidateSource?:{id:string;name:string}|null;readOnlyPreview:boolean}) {
 const [message,setMessage]=useState(''),[pending,setPending]=useState(false);const busy=useRef(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy.current)return;busy.current=true;setPending(true);const data=new FormData(event.currentTarget);try{const result=await createWorkspaceNewDraft(data);if(result.ok)window.location.assign('/work?notice=draft_saved');else setMessage(result.message);}catch{setMessage('연결하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.');}finally{busy.current=false;setPending(false);}}
 return <>{message&&<p className={styles.error} role="alert">{message}</p>}
            <form onSubmit={submit} className={styles.form} key={candidate?.id ?? "manual"}>
              <label>수집 출처<select name="source_id" key={candidateSource?.id ?? "manual"} defaultValue={candidateSource?.id ?? ""} required><option value="">출처를 선택하세요</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
              {sources.length === 0 && <p>활성 수집 출처가 없습니다. 출처를 먼저 등록해야 합니다.</p>}
              <label>공식 원문 주소<input name="canonical_url" type="url" placeholder="https://…" defaultValue={candidate?.officialUrl} required /></label>
              <label>원문 제목<input name="original_title" maxLength={500} defaultValue={candidate?.originalTitle} required /></label>
              <label>한국어 제목<input name="title_ko" maxLength={500} defaultValue={candidate?.title} required /></label>
              <label>한국어 한 줄 요약<textarea name="summary_ko" maxLength={3000} defaultValue={candidate?.summary} required rows={3} /></label>
              <label>상세 내용<textarea name="details_ko" maxLength={20000} defaultValue={candidate?.details} rows={5} /></label>
              <div className={styles.fields}><label>원문 게시일<input name="source_published_date" type="date" defaultValue={candidate?.publishedDate} /></label><label>국가·지역 (쉼표로 구분)<input name="jurisdictions" placeholder="EU, 영국" defaultValue={candidate?.jurisdictions.join(", ")} /></label></div>
              <label>주제 (쉼표로 구분)<input name="topics" placeholder="아동, 인공지능" defaultValue={candidate?.topics.join(", ")} /></label>
              <button type="submit" disabled={sources.length === 0 || readOnlyPreview || pending}>{pending?'저장 중…':'초안 저장'}</button>
            </form></>;
}
