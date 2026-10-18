import Link from "next/link";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";

export default function WeeklyPage() {
  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향 자료</h1><p>검수와 발행을 마친 주간 자료를 호별로 모아 읽습니다.</p></div>
      <div className={styles.weeklyEmpty}><strong>첫 주간호를 준비하고 있습니다</strong><p>아직 발행된 주간호는 없습니다. 지금은 개별 동향과 국가별 법제를 살펴보실 수 있습니다.</p><div><Link href="/public/search">동향 살펴보기 →</Link><Link href="/public/laws">국가별 법제 보기 →</Link></div></div>
    </section>
    <PublicFooter />
  </main>;
}
