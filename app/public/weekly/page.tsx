import Link from 'next/link';
import {createClient} from '../../../lib/supabase/server';
import {PublicHeader,PublicFooter} from '../public-navigation';
import styles from '../public.module.css';
import WeeklyFormats from './weekly-formats';
import WrittenWeeklyReport from './written-weekly-report';

export const dynamic='force-dynamic';

export default async function WeeklyPage(){
 const db=await createClient();
 const {data:issues,error}=await db.from('written_weekly_issues')
  .select('issue_key,title,description,week_start,week_end,published_at')
  .eq('status','published').order('week_start',{ascending:false}).limit(52);
 const keys=(issues??[]).map(issue=>issue.issue_key);
 const {data:links,error:linkError}=keys.length?await db.from('written_weekly_issue_reports')
  .select('issue_key,report_id,sort_order').in('issue_key',keys).order('sort_order',{ascending:true}):{data:[],error:null};
 const ids=[...new Set((links??[]).map(link=>link.report_id))];
 const {data:reports,error:reportError}=ids.length?await db.from('reports')
  .select('id,title_ko,one_line_summary_ko,detailed_summary_ko').eq('status','published').in('id',ids):{data:[],error:null};
 const byId=new Map((reports??[]).map(report=>[report.id,report]));
 const ready=!error&&!linkError&&!reportError;
 return <main className={styles.site}>
  <PublicHeader active="/public/weekly"/>
  <section className={styles.searchPage}>
   <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향</h1><p>작업실에서 선정해 공개한 해외 개인정보 보호 동향을 읽어보세요.</p></div>
   <WeeklyFormats active="written"/>
   {ready?(issues??[]).map(issue=><WrittenWeeklyReport key={issue.issue_key} issue={issue} reports={(links??[]).filter(link=>link.issue_key===issue.issue_key).map(link=>byId.get(link.report_id)).filter((report):report is NonNullable<typeof report>=>Boolean(report))}/>):<p role="alert">주간 동향을 불러오지 못했습니다. 잠시 후 다시 이용해 주세요.</p>}
   {ready&&!(issues??[]).length?<div className={styles.weeklyEmpty}><strong>아직 공개된 주간 동향이 없습니다</strong><p>작업실에서 선정하고 공개한 주간 동향이 이곳에 표시됩니다. 팟캐스트는 별도 메뉴에서 들으실 수 있습니다.</p><Link href="/public/search">동향 검색하기 →</Link></div>:null}
  </section>
  <PublicFooter/>
 </main>;
}
