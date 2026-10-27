import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";
import { loadWeeklySample } from "../../../lib/weekly-sample";
import type { WeeklyIssueItem } from "../../../lib/weekly-sample";
import WeeklyFormats from './weekly-formats';

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const db = await createClient();
  const { data: issues, error: issuesError } = await db.from("weekly_issues")
    .select("issue_key,title,description,week_start,week_end,published_at")
    .eq("status", "published").order("week_start", { ascending: false }).limit(52);
  const issueRows = issues ?? [];
  const issueKeys = issueRows.map(issue => issue.issue_key);
  const { data: links } = issueKeys.length
    ? await db.from("weekly_issue_reports").select("issue_key,report_id,sort_order")
        .in("issue_key", issueKeys).order("sort_order")
    : { data: [] };
  const reportIds = [...new Set((links ?? []).map(link => link.report_id))];
  const { data: reports } = reportIds.length
    ? await db.from("reports").select("id,title_ko,one_line_summary_ko,detailed_summary_ko")
        .eq("status", "published").in("id", reportIds)
    : { data: [] };
  const reportMap = new Map((reports ?? []).map(report => [report.id, report]));
  const linksByIssue = new Map<string, typeof links>();
  for (const link of links ?? []) {
    const rows = linksByIssue.get(link.issue_key) ?? [];
    rows.push(link);
    linksByIssue.set(link.issue_key, rows);
  }
  const example = publicSubmissionPreviewEnabled() ? loadWeeklySample() : null;
  const schemaNotReady = issuesError?.code === "PGRST205" || issuesError?.code === "42P01";

  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간호</h1><p>한 주의 동향을 정리한 서면 자료와 주요 주제를 깊이 다루는 팟캐스트를 따로 만나보세요.</p></div>
      <WeeklyFormats active="written" />
      <h2>서면 주간 동향</h2>
      <p>한 주의 해외 개인정보 보호 동향을 호별로 모아 읽습니다.</p>
      {issuesError && !schemaNotReady ? <p role="alert">공개 주간호를 불러오지 못했습니다. 잠시 후 다시 이용해 주세요.</p> : null}
      {issueRows.map(issue => {
        const included = (linksByIssue.get(issue.issue_key) ?? [])
          .map(link => reportMap.get(link.report_id)).filter(Boolean);
        return <article key={issue.issue_key} id={`issue-${issue.issue_key}`} className={styles.weeklyReport} style={{marginBottom:28}}>
          <div className={styles.weeklyReportHeader}>
            <p className={styles.weeklyReportKicker}>{issue.issue_key} · {issue.week_start}–{issue.week_end}</p>
            <h2>{issue.title}</h2>
            {issue.description ? <p>{issue.description}</p> : null}
            <p className={styles.weeklyReportMeta}>공개 동향 {included.length}건</p>
          </div>
          {included.length ? <section className={styles.weeklyArticles} aria-label={`${issue.issue_key} 포함 동향`}>
            {included.map(report => report ? <article className={styles.weeklyArticle} key={report.id}>
              <h3><Link href={`/public/trends/${report.id}`}>{report.title_ko}</Link></h3>
              {report.one_line_summary_ko ? <p className={styles.weeklyLead}>{report.one_line_summary_ko}</p> : null}
              {report.detailed_summary_ko ? String(report.detailed_summary_ko).split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index} style={{whiteSpace:'pre-wrap',lineHeight:1.9}}>{paragraph}</p>) : null}
            </article> : null)}
          </section> : <p>이 주간호에 연결된 동향이 없습니다.</p>}
        </article>;
      })}
      {!issueRows.length && !example ? <div className={styles.weeklyEmpty}>
        <strong>{schemaNotReady ? "서면 주간 동향 공개를 준비하고 있습니다" : "아직 공개된 서면 주간 동향이 없습니다"}</strong>
        <p>서면 자료가 게시되면 이곳에서 읽을 수 있습니다. 팟캐스트는 위의 별도 메뉴에서 들으실 수 있습니다.</p>
        <div><Link href="/public/search">동향 살펴보기 →</Link><Link href="/public/laws">국가별 법제 보기 →</Link></div>
      </div> : null}
      {example ? <div className={styles.weeklyReport}>
        <div className={styles.weeklyReportHeader}>
          <p className={styles.draftNotice}>주간호 구성 예시</p>
          <p className={styles.weeklyReportKicker}>개인정보 주간동향 분석</p>
          <h2>{example.title}</h2>
          <p className={styles.weeklyReportMeta}>예시 호 · 해외·국제 {example.issue.contents.length}건 · 국내 0건</p>
          <p className={styles.weeklyReportNotice}>{example.notice}</p>
        </div>
        <section className={styles.weeklyContents} aria-labelledby="weekly-contents-title">
          <div className={styles.weeklySectionHeading}><span>CONTENTS</span><h3 id="weekly-contents-title">목차</h3></div>
          <div className={styles.weeklyTableWrap}><table className={styles.weeklyTable}><thead><tr><th>No.</th><th>분류</th><th>제목</th><th>출처</th></tr></thead><tbody>{example.issue.contents.map((item:WeeklyIssueItem)=><tr key={item.id}><td>{item.number}</td><td>{item.category}</td><td><a href={`#weekly-${item.id}`}>{item.title}</a><small>{item.originalTitle}</small></td><td>{item.organization}</td></tr>)}</tbody></table></div>
        </section>
        <section className={styles.weeklyArticles} aria-labelledby="weekly-articles-title">
          <div className={styles.weeklySectionHeading}><span>OVERSEAS &amp; INTERNATIONAL</span><h3 id="weekly-articles-title">해외·국제 개인정보 주간 동향</h3></div>
          {example.issue.contents.map((item:WeeklyIssueItem)=><article className={styles.weeklyArticle} id={`weekly-${item.id}`} key={item.id}>
            <header><div><span className={styles.weeklyArticleNo}>{item.number}</span><h4>{item.title}</h4></div><span className={styles.weeklyCategory}>{item.category}</span></header>
            <p className={styles.weeklyLead}>{item.leadSummary}</p>
            <ul className={styles.weeklyPoints}>{item.bodyPoints.map((point:{label:string;text:string},index:number)=><li key={`${item.id}-${index}`}>{point.text}</li>)}</ul>
            {item.editorialNote?<aside><strong>편집자 해설</strong><p>{item.editorialNote}</p></aside>:null}
            <footer><span>출처 · {item.originalTitle} ({item.organization}, {item.date})</span><Link href={`/public/trends/${item.id}`}>상세 자료 보기 →</Link><a href={item.officialUrl} target="_blank" rel="noreferrer">원문 보기 ↗</a></footer>
          </article>)}
        </section>
      </div> : null}
    </section>
    <PublicFooter />
  </main>;
}
