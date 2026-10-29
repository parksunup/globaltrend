'use client';
import {useEffect,useMemo,useState} from 'react';
import type {TeamTrend} from '../../lib/team-trends';
import {rankWeeklyCandidates} from '../../lib/weekly-priority';
import WeeklyEditor,{type WeeklyCandidate} from '../work/weekly/weekly-editor';
import styles from './live-team-workspace.module.css';

const reportId=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function previousMonday(){const current=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'}));current.setDate(current.getDate()-((current.getDay()+6)%7)-7);return `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;}
function week(start:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return null;const monday=new Date(`${start}T00:00:00Z`);if(Number.isNaN(monday.valueOf())||monday.toISOString().slice(0,10)!==start||monday.getUTCDay()!==1)return null;const sunday=new Date(monday);sunday.setUTCDate(sunday.getUTCDate()+6);const thursday=new Date(monday);thursday.setUTCDate(thursday.getUTCDate()+3);const year=thursday.getUTCFullYear(),jan4=new Date(Date.UTC(year,0,4));jan4.setUTCDate(jan4.getUTCDate()-((jan4.getUTCDay()+6)%7));return {start,end:sunday.toISOString().slice(0,10),key:`${year}-W${String(1+Math.round((monday.valueOf()-jan4.valueOf())/604800000)).padStart(2,'0')}`};}
type Issue={issue_key:string;title:string;status:string;selection_notes:{report_id:string;reason:string}[]};
export default function TeamWeeklyPanel({trends,canManage,readOnly=false}:{trends:TeamTrend[];canManage:boolean;readOnly?:boolean}){
 const [start,setStart]=useState(previousMonday);
 const [issue,setIssue]=useState<Issue|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const [dirty,setDirty]=useState(false),[publishing,setPublishing]=useState(false);
 const period=week(start);
 const candidates=useMemo(()=>rankWeeklyCandidates(trends.filter(row=>reportId.test(row.id)&&row.status==='published'&&row.published_date?.slice(0,10)>=start&&row.published_date?.slice(0,10)<=(period?.end??'')).map(row=>({id:row.id,title:row.title_ko,summary:row.summary_ko,details:row.details_ko,date:row.published_date.slice(0,10),source:row.source_name,url:row.official_url,status:row.status,documentType:'',topics:row.topics,jurisdictions:row.jurisdictions} satisfies WeeklyCandidate))),[trends,start,period?.end]);
 useEffect(()=>{if(!period){setLoading(false);setError('월요일 날짜를 선택해 주세요.');return;}let active=true;setLoading(true);setError('');setSaved('');setDirty(false);fetch(`/api/team-workspace/weekly?start=${period.start}`,{cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error??'주간 동향을 불러오지 못했습니다.');if(active)setIssue(result.issue??null);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'주간 동향 조회 실패');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[period?.start]);
 const entries=Array.isArray(issue?.selection_notes)?issue.selection_notes:[];
 const missing=entries.filter(entry=>!candidates.some(candidate=>candidate.id===entry.report_id));
 async function save(form:FormData){
  setError('');setSaved('');
  const selection=form.getAll('report').map(value=>({report_id:String(value),reason:String(form.get(`reason-${value}`)??'담당자 선정')}));
  try{const response=await fetch('/api/team-workspace/weekly',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:period!.start,end:period!.end,key:period!.key,title:String(form.get('title')??''),selection})});
  const result=await response.json();if(!response.ok)throw Error(result.error??'선정안을 저장하지 못했습니다.');
  setIssue(result.issue);setDirty(false);setSaved('선정안을 저장했습니다. 아직 공개되지 않았습니다. 내용을 확인한 뒤 공개 버튼을 누르세요.');}
  catch(cause){setError(cause instanceof Error?cause.message:'선정안을 저장하지 못했습니다.');}
 }
 async function publish(){
  if(!period||!issue||issue.status!=='draft'||dirty||publishing)return;
  if(!window.confirm('저장한 주간 동향을 공개하시겠습니까? 선정된 원고가 모두 공개 가능한 상태여야 합니다.'))return;
  setPublishing(true);setError('');setSaved('');
  try{const response=await fetch('/api/team-workspace/weekly',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publish',start:period.start,end:period.end,key:period.key})});
  const result=await response.json();if(!response.ok)throw Error(result.error??'주간 동향을 공개하지 못했습니다.');
  setIssue(result.issue);setSaved('주간 동향을 공개했습니다. 공개 페이지에서 확인할 수 있습니다.');}
  catch(cause){setError(cause instanceof Error?cause.message:'주간 동향을 공개하지 못했습니다.');}
  finally{setPublishing(false);}
 }
 return <div className={styles.weeklyInline}><div className={styles.weeklyHeading}><div><h2>주간 동향 선정</h2><p>같은 작업실의 원고 중 지난 월요일부터 일요일까지 발표된 동향을 검토합니다.</p></div><label>대상 주 월요일 <input type="date" value={start} onChange={event=>setStart(event.target.value)}/></label></div>
 {loading&&<p>선정안을 불러오는 중입니다…</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{saved&&<p role="status" className={styles.publicationMessage}>{saved}</p>}
 {!loading&&period&&<>
  {issue?.status==='published'?<p>이 주간 동향은 공개 중입니다. <a href="/public/weekly">공개 페이지 보기 →</a></p>:null}
  {issue&&issue.status!=='draft'&&issue.status!=='published'?<p>이 주간 동향은 이 화면에서 수정할 수 없습니다.</p>:null}
  {(!issue||issue.status==='draft')&&missing.length?<p role="alert" className={styles.error}>저장된 선정 자료 {missing.length}건이 현재 원고 목록에 없습니다. 자료를 새로 확인한 뒤 다시 열어 주세요.</p>:null}
  {(!issue||issue.status==='draft')&&!missing.length&&<>
   <p>{issue?'저장된 주간 선정안을 불러왔습니다.':'해당 주에 공개된 동향 중 최대 8건을 기본 선택했습니다. 선정안을 저장하고 내용을 확인한 뒤 공개할 수 있습니다.'}</p>
   <WeeklyEditor key={`${period.key}:${issue?.issue_key??'new'}`} candidates={candidates} initialIds={issue?entries.map(entry=>entry.report_id):candidates.slice(0,8).map(candidate=>candidate.id)} notes={Object.fromEntries(entries.map(entry=>[entry.report_id,entry.reason]))} issueKey={period.key} title={issue?.title??'개인정보 주간동향'} start={period.start} end={period.end} save={save} readOnly={readOnly||!canManage} onDirty={()=>setDirty(true)}/>
   {issue?.status==='draft'&&canManage&&!readOnly?<div className={styles.weeklyPublish}><button type="button" onClick={publish} disabled={dirty||publishing}>{publishing?'공개 중…':'저장한 주간 동향 공개'}</button>{dirty?<p>선정이나 제목을 바꿨습니다. 먼저 선정안 저장을 눌러 주세요.</p>:null}</div>:null}
   {!canManage&&!readOnly?<p>주간 선정안의 저장과 공개는 총괄 관리자 계정에서 할 수 있습니다.</p>:null}
  </>}
 </>}
 </div>;
}
