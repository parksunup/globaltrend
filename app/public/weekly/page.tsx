import Link from 'next/link';
import {createClient} from '../../../lib/supabase/server';
import {PublicHeader,PublicFooter} from '../public-navigation';
import styles from '../public.module.css';
import WeeklyFormats from './weekly-formats';
import WrittenWeeklyReport from './written-weekly-report';
import WeeklyIssuePicker from './weekly-issue-picker';
import {readAllPages} from '../../../lib/read-all-pages';

export const dynamic='force-dynamic';

export default async function WeeklyPage({searchParams}:{searchParams:Promise<{issue?:string}>}){
 const db=await createClient();
 let issues:{issue_key:string;title:string;description:string;week_start:string;week_end:string;published_at:string|null}[]=[];
 let listError=false;
 try{issues=await readAllPages(async(offset,count)=>{
  const {data,error}=await db.from('written_weekly_issues')
   .select('issue_key,title,description,week_start,week_end,published_at')
   .eq('status','published').order('week_start',{ascending:false}).order('issue_key').range(offset,offset+count-1);
  if(error)throw error;
  return data??[];
 });}catch(error){console.error('Written weekly list unavailable:',error);listError=true;}
 const requested=(await searchParams).issue;
 const selected=issues.find(issue=>issue.issue_key===requested)??issues[0];
 const {data:links,error:linkError}=selected?await db.from('written_weekly_issue_reports')
  .select('issue_key,report_id,sort_order').eq('issue_key',selected.issue_key).order('sort_order',{ascending:true}):{data:[],error:null};
 const ids=[...new Set((links??[]).map(link=>link.report_id))];
 const {data:reports,error:reportError}=ids.length?await db.from('reports')
  .select('id,title_ko,one_line_summary_ko,detailed_summary_ko').eq('status','published').in('id',ids):{data:[],error:null};
 const byId=new Map((reports??[]).map(report=>[report.id,report]));
 const ready=!listError&&!linkError&&!reportError;
 return <main className={styles.site}>
  <PublicHeader active="/public/weekly"/>
  <section className={styles.searchPage}>
   <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향</h1><p>작업실에서 선정해 공개한 해외 개인정보 보호 동향을 읽어보세요.</p></div>
   <WeeklyFormats active="written"/>
   {ready&&<WeeklyIssuePicker issues={issues} selectedKey={selected?.issue_key??''} basePath="/public/weekly" label="공개된 주간 동향 호 선택"/>}
   {ready&&selected?<WrittenWeeklyReport issue={selected} reports={(links??[]).map(link=>byId.get(link.report_id)).filter((report):report is NonNullable<typeof report>=>Boolean(report))}/>:null}
   {!ready?<p role="alert">주간 동향을 불러오지 못했습니다. 잠시 후 다시 이용해 주세요.</p>:null}
   {ready&&!issues.length?<div className={styles.weeklyEmpty}><strong>아직 공개된 주간 동향이 없습니다</strong><p>작업실에서 선정하고 공개한 주간 동향이 이곳에 표시됩니다. 팟캐스트는 별도 메뉴에서 들으실 수 있습니다.</p><Link href="/public/search">동향 검색하기 →</Link></div>:null}
  </section>
  <PublicFooter/>
 </main>;
}
