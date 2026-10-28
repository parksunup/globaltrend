import Link from 'next/link';
import {redirect} from 'next/navigation';
import WeeklyEditor from './weekly-editor';
import type {WeeklyCandidate} from './weekly-editor';
import styles from '../../public/public.module.css';
import {createClient} from '../../../lib/supabase/server';
export const dynamic='force-dynamic';
async function save(form:FormData){'use server';
 const db=await createClient();
 const selection=form.getAll('report').map(id=>({report_id:String(id),reason:String(form.get(`reason-${id}`)??'담당자 선정')}));
 const {error}=await db.rpc('save_written_weekly_draft',{p_issue_key:form.get('key'),p_title:form.get('title'),p_start:form.get('start'),p_end:form.get('end'),p_selection:selection});
 if(error)redirect(`/work/weekly?error=${encodeURIComponent(error.message)}`);
 redirect('/work/weekly?saved=1');
}
async function publish(form:FormData){'use server';const db=await createClient();const {error}=await db.rpc('publish_written_weekly_issue',{p_issue_key:form.get('key')});if(error)redirect(`/work/weekly?error=${encodeURIComponent(error.message)}`);redirect('/work/weekly?saved=1');}
export default async function WeeklyEditorPage({searchParams}:{searchParams:Promise<{error?:string;saved?:string;start?:string}>}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return <main><h1>주간호 편집</h1><p>관리자 로그인이 필요합니다.</p><Link href="/work">작업실로</Link></main>;
 const {data:member}=await db.from('team_memberships').select('role,is_active').eq('user_id',user.id).maybeSingle();
 if(!member?.is_active||member.role!=='admin')return <main><h1>주간호 편집</h1><p>주간호 편집·발간은 총괄 관리자만 할 수 있습니다.</p></main>;
 const params=await searchParams;
 const today=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'}));
 today.setDate(today.getDate()-((today.getDay()+6)%7)-7);
 const fallback=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 const requested=params.start&&/^\d{4}-\d{2}-\d{2}$/.test(params.start)?params.start:fallback;
 const monday=new Date(`${requested}T00:00:00Z`);
 if(Number.isNaN(monday.valueOf())||monday.toISOString().slice(0,10)!==requested||monday.getUTCDay()!==1)return <main><p>대상 기간 시작일은 월요일을 선택해 주세요.</p><Link href="/work/weekly">돌아가기</Link></main>;
 const endDate=new Date(monday);endDate.setUTCDate(endDate.getUTCDate()+6);
 const end=endDate.toISOString().slice(0,10);
 const thursday=new Date(monday);thursday.setUTCDate(thursday.getUTCDate()+3);
 const year=thursday.getUTCFullYear();const jan4=new Date(Date.UTC(year,0,4));jan4.setUTCDate(jan4.getUTCDate()-((jan4.getUTCDay()+6)%7));
 const issueKey=`${year}-W${String(1+Math.round((monday.valueOf()-jan4.valueOf())/604800000)).padStart(2,'0')}`;
 const {data:issue,error:issueError}=await db.from('weekly_issues').select('issue_key,title,status,selection_notes').eq('issue_key',issueKey).maybeSingle();
 const candidates:WeeklyCandidate[]=[];let loadError=false;const seen=new Set<string>();
 for(let offset=0;;offset+=200){
  const {data,error}=await db.from('reports').select('id,title_ko,one_line_summary_ko,detailed_summary_ko,status,source_item_id,source_items!inner(title_original,canonical_url,published_at,sources(name))').in('status',['draft','in_review','approved','published']).gte('source_items.published_at',`${requested}T00:00:00+09:00`).lte('source_items.published_at',`${end}T23:59:59.999999+09:00`).order('created_at',{ascending:false}).order('id').range(offset,offset+199);
  if(error){loadError=true;break;}
  for(const r of data??[]){if(seen.has(r.source_item_id))continue;seen.add(r.source_item_id);const source=Array.isArray(r.source_items)?r.source_items[0]:r.source_items;const institution=Array.isArray(source.sources)?source.sources[0]:source.sources;candidates.push({id:r.id,title:r.title_ko,summary:r.one_line_summary_ko??'',details:r.detailed_summary_ko??'',status:r.status,date:source.published_at?.slice(0,10)??'',url:source.canonical_url,source:institution?.name??'공식 출처'});}
  if((data??[]).length<200)break;
 }
 // Include the week's entire collected list, even when its Korean report is not ready.
 for(let offset=0;!loadError;offset+=200){
  const {data,error}=await db.rpc('get_trend_catalog',{p_offset:offset,p_limit:200});
  if(error){loadError=true;break;}
  for(const row of data??[]){if(seen.has(row.item_id)||!row.published_date||row.published_date<requested||row.published_date>end)continue;seen.add(row.item_id);candidates.push({id:`catalog-${row.item_id}`,title:row.title,summary:'원문 수집 완료 · 한국어 초안 작성 전',details:'',date:row.published_date,url:row.official_url,source:row.source_name,status:'초안 미작성',selectable:false});}
  if((data??[]).length<200)break;
 }
 const entries=(Array.isArray(issue?.selection_notes)?issue.selection_notes:[]) as {report_id:string;reason:string}[];
 const initialIds=issue?entries.map(e=>e.report_id):candidates.filter(c=>c.selectable!==false).slice(0,8).map(c=>c.id);
 const notes=Object.fromEntries(entries.map(e=>[e.report_id,e.reason]));
 return <main className={styles.site}><section className={styles.searchPage}><Link href="/work">← 작업실</Link><h1>주간호 편집</h1><form><label>대상 주의 월요일 <input type="date" name="start" defaultValue={requested}/></label><button>해당 주 보기</button></form>
 {params.error&&<p role="alert">저장하지 못했습니다: {params.error}</p>}{params.saved&&<p role="status">저장했습니다.</p>}
 {(loadError||issueError)?<p role="alert">자료를 끝까지 읽지 못해 편집을 중단했습니다. 일부 목록으로 저장하지 않습니다.</p>:issue&&issue.status!=='draft'?<p>이미 발간된 주간호입니다. 자동으로 덮어쓰지 않습니다. <Link href="/public/weekly">공개 주간호 보기</Link></p>:<><p>{issue?'저장된 선정안을 불러왔습니다.':'저장된 선정안이 없어 초안 목록에서 우선 8건을 선택했습니다. 중요도를 검토해 조정해 주세요.'}</p><WeeklyEditor key={issueKey} candidates={candidates} initialIds={initialIds} notes={notes} issueKey={issueKey} title={issue?.title??'개인정보 주간동향'} start={requested} end={end} save={save}/>{issue&&<form action={publish}><input type="hidden" name="key" value={issueKey}/><p>포함 기사의 검수·개별 발행을 마친 후 공개합니다.</p><button>검수 완료 주간호 공개 발간</button></form>}</>}
 </section></main>;
}
