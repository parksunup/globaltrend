import Link from 'next/link';
import styles from '../public.module.css';

type Issue={issue_key:string;title:string;description:string;week_start:string;week_end:string;published_at:string|null};
type Report={id:string;title_ko:string;one_line_summary_ko:string|null;detailed_summary_ko:string|null};

export default function WrittenWeeklyReport({issue,reports}:{issue:Issue;reports:Report[]}){
 return <article id={`issue-${issue.issue_key}`} className={styles.weeklyReport} style={{marginBottom:28}}>
  <header className={styles.weeklyReportHeader}>
   <p className={styles.weeklyReportKicker}>{issue.issue_key} · {issue.week_start}–{issue.week_end}</p>
   <h2>{issue.title}</h2>
   {issue.description?<p className={styles.weeklyReportNotice}>{issue.description}</p>:null}
   <p className={styles.weeklyReportMeta}>주요 동향 {reports.length}건</p>
  </header>
  <section className={styles.weeklyContents} aria-label={`${issue.issue_key} 목차`}>
   <div className={styles.weeklySectionHeading}><span>CONTENTS</span><h3>목차</h3></div>
   <ol>{reports.map(report=><li key={report.id}><a href={`#weekly-${issue.issue_key}-${report.id}`}>{report.title_ko}</a></li>)}</ol>
  </section>
  <section className={styles.weeklyArticles} aria-label={`${issue.issue_key} 주요 동향`}>
   {reports.map((report,index)=><article id={`weekly-${issue.issue_key}-${report.id}`} key={report.id} className={styles.weeklyArticle}>
    <header><div><span className={styles.weeklyArticleNo}>{String(index+1).padStart(2,'0')}</span><h4>{report.title_ko}</h4></div></header>
    {report.one_line_summary_ko?<p className={styles.weeklyLead}>{report.one_line_summary_ko}</p>:null}
    {report.detailed_summary_ko?.split(/\n\s*\n/).filter(Boolean).map((paragraph,part)=><p key={part} style={{whiteSpace:'pre-wrap',lineHeight:1.9}}>{paragraph}</p>)}
    <footer><Link href={`/public/trends/${report.id}`}>동향 자세히 보기 →</Link></footer>
   </article>)}
  </section>
 </article>;
}
