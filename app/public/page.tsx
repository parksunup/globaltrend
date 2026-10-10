import Link from "next/link";
import styles from "./public.module.css";

import { loadPublishedStories } from "../../lib/published-trends";
import { PublicHeader, PublicFooter } from "./public-navigation";

const topics = [
  { label: "국가", query: "국가별 개인정보 보호", className: "topicCountry" },
  { label: "법제", query: "개인정보 법제", className: "topicLaw" },
  { label: "주제", query: "개인정보", className: "topicCenter" },
  { label: "인공지능", query: "인공지능 개인정보", className: "topicAI" },
  { label: "생체정보", query: "생체정보", className: "topicBio" },
  { label: "데이터 이전", query: "개인정보 국외 이전", className: "topicTransfer" },
  { label: "플랫폼 규제", query: "플랫폼 규제 개인정보", className: "topicPlatform" },
  { label: "아동·청소년", query: "아동 개인정보", className: "topicChildren" },
  { label: "정보주체 권리", query: "정보주체 권리", className: "topicRights" },
  { label: "데이터 거버넌스", query: "데이터 거버넌스", className: "topicGovernance" },
];

export const dynamic = "force-dynamic";

export default async function PublicHome() {
  let allStories: Awaited<ReturnType<typeof loadPublishedStories>> = [];
  let loadError = false;
  try { allStories = await loadPublishedStories(); } catch (error) { console.error(error); loadError = true; }
  const stories = allStories.slice(0, 6);
  const featured = stories[0];
  return <main className={styles.site}>
    <PublicHeader active="/public" />

    <section className={styles.hero}>
      <div className={styles.heroTitle}>
        <span className={styles.edition}>시안 E · 관측소형</span>
        <p className={styles.overline}>GLOBAL PRIVACY OBSERVATORY</p>
        <h1>글로벌 개인정보 동향</h1>
        <p>세계의 개인정보 이슈를 한눈에, 법과 정책의 변화를 깊이 있게.</p>
      </div>
      <div className={styles.globe} aria-hidden="true">
        <svg viewBox="0 0 760 330" role="presentation">
          <defs><radialGradient id="globeGlow"><stop offset="0" stopColor="#183456" stopOpacity=".72"/><stop offset="1" stopColor="#0a1727" stopOpacity="0"/></radialGradient><pattern id="globeDots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#7db6df" opacity=".5"/></pattern></defs>
          <ellipse cx="385" cy="273" rx="300" ry="220" fill="url(#globeGlow)"/>
          <circle cx="385" cy="273" r="230" fill="url(#globeDots)" stroke="#3d6687" strokeOpacity=".5"/>
          <ellipse cx="385" cy="273" rx="230" ry="88" fill="none" stroke="#426b8b" strokeOpacity=".55"/>
          <ellipse cx="385" cy="273" rx="230" ry="160" fill="none" stroke="#426b8b" strokeOpacity=".38"/>
          <ellipse cx="385" cy="273" rx="105" ry="230" fill="none" stroke="#426b8b" strokeOpacity=".42"/>
          <ellipse cx="385" cy="273" rx="178" ry="230" fill="none" stroke="#426b8b" strokeOpacity=".28"/>
          <path d="M70 257 Q208 150 346 192 T650 130" fill="none" stroke="#dca64f" strokeOpacity=".8"/>
          <path d="M170 150 Q310 255 440 175 T720 210" fill="none" stroke="#67c9ef" strokeOpacity=".7"/>
          <circle cx="188" cy="154" r="4" fill="#70d9ff"/><circle cx="295" cy="189" r="5" fill="#f2bb62"/><circle cx="476" cy="174" r="4" fill="#f2bb62"/><circle cx="612" cy="129" r="4" fill="#72d8ff"/>
        </svg>
      </div>
      <div className={styles.heroMotto}>PEOPLE<br />LAW<br />SOCIETY<br /><b>A SAFER DIGITAL TOMORROW</b></div>
    </section>

    <section className={styles.observatoryGrid}>
      <div className={styles.timelinePanel}>
        <div className={styles.panelTitle}><h2>주요 동향</h2><span /><Link href="/public/search">더보기 →</Link></div>
        {stories.length ? <ol className={styles.timeline}>{stories.map((story, index) => <li key={story.id} className={index === 0 ? styles.timelineActive : ""}>
          <span className={styles.timelineDot} /><time>{story.date}</time><Link href={`/public/trends/${story.id}`}>{story.region}, {story.title}</Link>
        </li>)}</ol> : <p className={styles.homeEmpty}>{loadError ? "자료를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." : "발행된 동향이 없습니다. 팀 검수를 마친 자료가 공개되면 이곳에 표시됩니다."}</p>}
      </div>

      <article className={styles.featured}>
        <div className={styles.featureMeta}><span>{featured?.region ?? "GLOBAL"}</span><i>·</i><span>{featured?.tags[0] ?? "PRIVACY"}</span></div>
        <p className={styles.featureKicker}>이번 주 주목할 흐름</p>
        <h2>{featured ? featured.title : "새로운 동향을 살펴보세요"}</h2>
        <h3>{featured ? featured.summary : "각국의 개인정보 보호 정책과 감독기구 발표를 한눈에 모읍니다."}</h3>
        <div className={styles.featureSource}><span>{featured ? "공식 출처" : "초기 관측 출처"}</span><b>{featured?.institution ?? "EDPB"}</b>{!featured && <><b>OECD</b><b>CURIA</b></>}</div>
        <p className={styles.featureBody}>{featured?.details || "검수된 자료가 공개되면 핵심 내용과 공식 원문 출처를 함께 확인할 수 있습니다."}</p>
        <Link className={styles.featureLink} href={featured ? `/public/trends/${featured.id}` : "/public/search"}>{featured ? "동향 자세히 보기" : "동향 검색 열기"} <span>→</span></Link>
      </article>

      <aside className={styles.topicPanel}>
        <div className={styles.panelTitle}><h2>주요 토픽</h2><span /><Link href="/public/search">전체 보기 →</Link></div>
        <div className={styles.topicNetwork}>
          <svg viewBox="0 0 440 370" aria-hidden="true"><g fill="none" stroke="#29445c" strokeWidth="1" strokeDasharray="3 5"><path d="M55 88 205 35 357 90 220 180 55 88"/><path d="m55 88 18 190 147-98 140 110  -3-200"/><path d="m205 35 15 145 137-90"/><path d="M73 278 220 180 357 290"/><path d="m73 278 140 60 144-48"/></g><g fill="#73cde8"><circle cx="205" cy="35" r="3"/><circle cx="357" cy="90" r="3"/><circle cx="220" cy="180" r="4"/><circle cx="73" cy="278" r="3"/><circle cx="357" cy="290" r="3"/></g></svg>
          {topics.map((topic) => <Link key={topic.label} className={styles[topic.className as keyof typeof styles]} href={topic.label === "법제" ? "/public/laws" : topic.label === "국가" ? "/public/search#country-filter" : `/public/search?q=${encodeURIComponent(topic.query)}`}>{topic.label}</Link>)}
        </div>
      </aside>
    </section>

    <section className={styles.weeklyStrip} id="weekly">
      <div className={styles.weeklyLead}><h2>주간호</h2><p>한 주의 주요 개인정보 이슈를 선별해 전합니다.</p></div>
      <div className={styles.weekCardActive}><span>WEEKLY BRIEFING</span><strong>주간호 준비 중</strong><small>발행된 주간호가 아직 없습니다.</small></div>
      <Link href="/public/weekly">주간호 전체 보기 →</Link>
    </section>
    <PublicFooter />
    <p className={styles.demoBanner}>공개 동향은 관리자 검수와 발행을 마친 자료만 표시합니다.</p>
  </main>;
}
