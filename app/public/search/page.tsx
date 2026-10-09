import Link from "next/link";
import TrendSearch from "../trend-search";
import styles from "../public.module.css";

export default async function PublicSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <main className={styles.site}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/public" aria-label="GlobalTrend 홈"><span className={styles.brandMark}>G</span><span>GLOBAL<span className={styles.brandAccent}>TREND</span></span></Link>
      <nav className={styles.nav} aria-label="주요 메뉴"><Link href="/public">글로벌 동향</Link><Link className={styles.navActive} href="/public/search">동향 검색</Link><Link href="/public/laws">법제 비교</Link></nav>
      <span className={styles.headerNote}><i /> PRIVACY POLICY OBSERVATORY</span>
    </header>
    <TrendSearch initialQuery={q || "아동 개인정보"} />
    <footer className={styles.footer}><span>GLOBAL<span className={styles.brandAccent}>TREND</span></span><p>공식 출처를 바탕으로 한 동향 검색</p><Link href="/public">관측소 홈</Link></footer>
  </main>;
}
