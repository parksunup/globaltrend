import Link from "next/link";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";
import { loadWeeklySample } from "../../../lib/weekly-sample";

export const dynamic="force-dynamic";

export default function WeeklyPage() {
  const example=publicSubmissionPreviewEnabled()?loadWeeklySample():null;
  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향 자료</h1><p>검수와 발행을 마친 주간 자료를 호별로 모아 읽습니다.</p></div>
      {example?<><p className={styles.draftNotice}>팀 제출 주간 예시 · {example.stories.length}건 · 미검수·미발행. 실제 최신 주간호가 아닙니다.</p><h2>{example.title}</h2><p>{example.notice}</p><ol>{example.stories.map(story=><li key={story.id}><h3><Link href={`/public/trends/${story.id}`}>{story.title}</Link></h3><p>{story.institution} · {story.date}</p><p style={{whiteSpace:"pre-line"}}>{story.summary}</p></li>)}</ol></>:<div className={styles.weeklyEmpty}><strong>첫 주간호를 준비하고 있습니다</strong><p>아직 발행된 주간호는 없습니다. 지금은 개별 동향과 국가별 법제를 살펴보실 수 있습니다.</p><div><Link href="/public/search">동향 살펴보기 →</Link><Link href="/public/laws">국가별 법제 보기 →</Link></div></div>}
    </section>
    <PublicFooter />
  </main>;
}
