import Link from "next/link";
import styles from "./public.module.css";

const topics = [
  { number: "01", label: "아동·청소년", query: "아동 개인정보" },
  { number: "02", label: "인공지능", query: "인공지능 개인정보" },
  { number: "03", label: "국외 이전", query: "개인정보 국외 이전" },
  { number: "04", label: "집행·제재", query: "개인정보 제재" },
];

export default function PublicHome() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/public" aria-label="GlobalTrend 홈">
          <span className={styles.brandMark}>G</span><span>GLOBAL<span className={styles.brandAccent}>TREND</span></span>
        </Link>
        <nav className={styles.nav} aria-label="주요 메뉴">
          <Link className={styles.navActive} href="/public">글로벌 동향</Link>
          <Link href="/public/search">동향 검색</Link>
          <Link href="/public/laws">법제 비교</Link>
        </nav>
        <span className={styles.headerNote}><i /> PRIVACY POLICY OBSERVATORY</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> GLOBAL PRIVACY OBSERVATORY <span className={styles.eyebrowLine} /></p>
          <h1>국경을 넘어 움직이는<br /><em>개인정보의 흐름</em>을 읽다</h1>
          <p className={styles.heroLead}>각국 감독기구와 국제기구의 발표를 모아<br className={styles.desktopBreak} /> 지금 중요한 변화를 한눈에 살펴봅니다.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/public/search">동향 찾아보기 <span aria-hidden="true">↗</span></Link>
            <Link className={styles.textButton} href="/public/laws">국가별 법제 비교 <span aria-hidden="true">→</span></Link>
          </div>
          <div className={styles.sourceLine}><span>INITIAL WATCHLIST</span><b>EDPB</b><b>OECD</b><b>CURIA · CJEU</b></div>
        </div>
        <div className={styles.orbit} aria-hidden="true">
          <div className={styles.orbitOuter} /><div className={styles.orbitMid} /><div className={styles.orbitInner} />
          <div className={styles.orbitCore}><span>GT</span><small>OBSERVATORY</small></div>
          <i className={styles.orbitPointOne} /><i className={styles.orbitPointTwo} /><i className={styles.orbitPointThree} />
          <span className={styles.orbitLabelOne}>EUROPE<br /><b>EDPB</b></span>
          <span className={styles.orbitLabelTwo}>GLOBAL<br /><b>OECD</b></span>
          <span className={styles.orbitLabelThree}>COURT<br /><b>CURIA</b></span>
          <div className={styles.orbitCaption}><span>01 / SIGNALS</span><b>관측 범위</b><small>규제 · 판례 · 정책 발표</small></div>
        </div>
      </section>

      <section className={styles.statusStrip} aria-label="관측 범위">
        <div><span className={styles.statusDot} /><p>현재 관측 중인 공식 출처</p><strong>3<span>곳</span></strong></div>
        <div><span className={styles.statusDot} /><p>비교 대상으로 준비 중인 법제</p><strong>7<span>개</span></strong></div>
        <div className={styles.statusMessage}><span>운영 준비 중</span><p>검수된 자료부터 이 화면에 차례로 공개됩니다.</p><Link href="/public/search">검색 화면 미리보기 →</Link></div>
      </section>

      <section className={styles.topicSection}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>EXPLORE BY TOPIC</p><h2>어떤 흐름을 찾고 계신가요?</h2></div>
          <Link href="/public/search">전체 동향 검색 <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.topicGrid}>
          {topics.map((topic) => <Link key={topic.number} href={`/public/search?q=${encodeURIComponent(topic.query)}`} className={styles.topicCard}>
            <span>{topic.number}</span><strong>{topic.label}</strong><i aria-hidden="true">↗</i>
          </Link>)}
        </div>
      </section>
      <footer className={styles.footer}><span>GLOBAL<span className={styles.brandAccent}>TREND</span></span><p>국제 개인정보 보호 동향을 읽고, 법제와 연결합니다.</p><Link href="/">팀 검수 화면</Link></footer>
    </main>
  );
}
