import Link from "next/link";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";
export default function WeeklyPage(){return <main className={styles.site}><PublicHeader active="/public/weekly" /><section className={styles.searchPage}><div className={styles.searchIntro}><p className={styles.overline}>WEEKLY BRIEFING</p><h1>주간 동향 자료</h1><p>검수와 발행을 마친 주간 자료를 호별로 모아 읽습니다.</p></div><div className={styles.emptyState}><strong>발행된 주간호가 없습니다</strong><p>현재 주간 자료를 준비하고 있습니다. 발행이 완료되면 이곳에 표시됩니다.</p><Link href="/public/search" className={styles.featureLink}>동향 검색하기 →</Link></div></section><PublicFooter /></main>}
