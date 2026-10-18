import Link from "next/link";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";
import { loadWeeklySample } from "../../../lib/weekly-sample";
import type { WeeklyIssueItem } from "../../../lib/weekly-sample";

export const dynamic="force-dynamic";

export default function WeeklyPage() {
  const example=publicSubmissionPreviewEnabled()?loadWeeklySample():null;
  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향 자료</h1><p>검수와 발행을 마친 주간 자료를 호별로 모아 읽습니다.</p></div>
      {example?<div className={styles.weeklyReport}>
        <div className={styles.weeklyReportHeader}>
          <p className={styles.draftNotice}>주간호 구성 예시 · 주간호 자체는 미발행</p>
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
      </div>:<div className={styles.weeklyEmpty}><strong>첫 주간호를 준비하고 있습니다</strong><p>아직 발행된 주간호는 없습니다. 지금은 개별 동향과 국가별 법제를 살펴보실 수 있습니다.</p><div><Link href="/public/search">동향 살펴보기 →</Link><Link href="/public/laws">국가별 법제 보기 →</Link></div></div>}
    </section>
    <PublicFooter />
  </main>;
}
