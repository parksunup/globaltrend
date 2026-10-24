import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";
import { loadWeeklySample } from "../../../lib/weekly-sample";
import type { WeeklyIssueItem } from "../../../lib/weekly-sample";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const db = await createClient();
  const { data: issues, error: issuesError } = await db.from("weekly_issues")
    .select("issue_key,title,description,week_start,week_end,published_at")
    .eq("status", "published").order("week_start", { ascending: false }).limit(52);
  const issueRows = issues ?? [];
  const issueKeys = issueRows.map(issue => issue.issue_key);
  const [{ data: links }, { data: podcasts }] = issueKeys.length
    ? await Promise.all([
        db.from("weekly_issue_reports").select("issue_key,report_id,sort_order")
          .in("issue_key", issueKeys).order("sort_order"),
        db.from("weekly_podcast_episodes").select("issue_key")
          .eq("status", "published").in("issue_key", issueKeys),
      ])
    : [{ data: [] }, { data: [] }];
  const reportIds = [...new Set((links ?? []).map(link => link.report_id))];
  const { data: reports } = reportIds.length
    ? await db.from("reports").select("id,title_ko,one_line_summary_ko")
        .eq("status", "published").in("id", reportIds)
    : { data: [] };
  const reportMap = new Map((reports ?? []).map(report => [report.id, report]));
  const linksByIssue = new Map<string, typeof links>();
  for (const link of links ?? []) {
    const rows = linksByIssue.get(link.issue_key) ?? [];
    rows.push(link);
    linksByIssue.set(link.issue_key, rows);
  }
  const podcastIssues = new Set((podcasts ?? []).map(episode => episode.issue_key));
  const example = publicSubmissionPreviewEnabled() ? loadWeeklySample() : null;
  const schemaNotReady = issuesError?.code === "PGRST205" || issuesError?.code === "42P01";

  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향 자료</h1><p>한 주의 개인정보 보호 동향과 그 주에 발행된 팟캐스트를 호별로 모아 읽습니다.</p></div>
      <p><Link href="/public/weekly/podcast">주간 팟캐스트 듣기 →</Link></p>
      {issuesError && !schemaNotReady ? <p role="alert">공개 주간호를 불러오지 못했습니다. 잠시 후 다시 이용해 주세요.</p> : null}
      {issueRows.map(issue => {
        const included = (linksByIssue.get(issue.issue_key) ?? [])
          .map(link => reportMap.get(link.report_id)).filter(Boolean);
        return <article key={issue.issue_key} className={styles.weeklyReport} style={{marginBottom:28}}>
          <div className={styles.weeklyReportHeader}>
            <p className={styles.weeklyReportKicker}>{issue.issue_key} · {issue.week_start}–{issue.week_end}</p>
            <h2>{issue.title}</h2>
            {issue.description ? <p>{issue.description}</p> : null}
            <p className={styles.weeklyReportMeta}>공개 동향 {included.length}건</p>
            {podcastIssues.has(issue.issue_key) ? <p><Link href="/public/weekly/podcast">이 호 팟캐스트 듣기 →</Link></p> : null}
          </div>
          {included.length ? <section className={styles.weeklyArticles} aria-label={`${issue.issue_key} 포함 동향`}>
            {included.map(report => report ? <article className={styles.weeklyArticle} key={report.id}>
              <h3><Link href={`/public/trends/${report.id}`}>{report.title_ko}</Link></h3>
              {report.one_line_summary_ko ? <p className={styles.weeklyLead}>{report.one_line_summary_ko}</p> : null}
            </article> : null)}
          </section> : <p>이 주간호에 연결된 동향이 없습니다.</p>}
        </article>;
      })}
      {!issueRows.length && !example ? <div className={styles.weeklyEmpty}>
        <strong>{schemaNotReady ? "주간호 공개를 준비하고 있습니다" : "아직 공개된 주간호가 없습니다"}</strong>
        <p>{schemaNotReady ? "주간호 게시 기능을 배포한 뒤 이곳에서 읽을 수 있습니다." : "개별 동향과 국가별 법제를 먼저 살펴보실 수 있습니다."}</p>
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
