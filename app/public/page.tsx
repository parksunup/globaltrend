import Link from "next/link";
import styles from "./public.module.css";

import { loadPublicStories } from "../../lib/public-content";
import { publicSubmissionPreviewEnabled } from "../../lib/public-submission-preview";
import { matchesPublicTopic, publicTopics } from "../../lib/public-topics";
import { PublicHeader, PublicFooter } from "./public-navigation";
import HomeVisitorCounts from "./home-visitor-counts";

export const dynamic = "force-dynamic";

export default async function PublicHome() {
  const draftMode = publicSubmissionPreviewEnabled();
  let allStories: Awaited<ReturnType<typeof loadPublicStories>> = [];
  let loadError = false;
  try { allStories = await loadPublicStories(); } catch (error) { console.error(error); loadError = true; }
  const stories = allStories.slice(0, 3);
  const featured = allStories[3] ?? stories[0];
  const topicCards = publicTopics.map((topic) => ({ ...topic, count: allStories.filter((story) => matchesPublicTopic(story.tags, topic.id)).length })).filter((topic) => topic.count > 0);
  return <main className={styles.site}>
    <PublicHeader active="/public" />
    {draftMode && <div className={styles.draftNotice}>미리보기 환경 · 조사한 자료와 공식 출처를 살펴보실 수 있습니다.</div>}

    <section className={styles.hero}>
      <div className={styles.heroTitle}>
        <p className={styles.overline}>GLOBAL PRIVACY OBSERVATORY</p>
        <h1>글로벌 개인정보 동향</h1>
        <p>세계의 개인정보 이슈를 한눈에, 법과 정책의 변화를 깊이 있게.</p><div className={styles.mobileHeroActions}><Link href="/public/search">동향 찾기</Link><Link href="/public/laws">국가별 법제 보기</Link></div>
      </div>
      <div className={styles.globe} aria-hidden="true" />
      <div className={styles.heroMotto}>PEOPLE<br />LAW<br />SOCIETY<br /><b>A SAFER DIGITAL TOMORROW</b></div>
    </section>

    <section className={styles.observatoryGrid}>
      <div className={styles.timelinePanel}>
        <div className={styles.panelTitle}><h2>주요 동향</h2><span /><Link href="/public/search">더보기 →</Link></div>
        {stories.length ? <ol className={styles.timeline}>{stories.map((story, index) => <li key={story.id} className={index === 0 ? styles.timelineActive : ""}>
          <span className={styles.timelineDot} /><time>{story.date}</time><Link href={`/public/trends/${story.id}`}>{story.region}, {story.title}</Link>
        </li>)}</ol> : <p className={styles.homeEmpty}>{loadError ? "자료를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." : "아직 표시할 동향이 없습니다."}</p>}
      </div>

      <article className={styles.featured}>
        <div className={styles.featureMeta}><span>{featured?.region ?? "GLOBAL"}</span><i>·</i><span>{featured?.tags[0] ?? "PRIVACY"}</span></div>
        <p className={styles.featureKicker}>{draftMode ? "최근 제출된 동향 표본" : "이번 주 주목할 흐름"}</p>
        <h2>{featured ? featured.title : "새로운 동향을 살펴보세요"}</h2>
        <h3>{featured ? featured.summary : "각국의 개인정보 보호 정책과 감독기구 발표를 한눈에 모읍니다."}</h3>
        <div className={styles.featureSource}><span>{featured ? "공식 출처" : "초기 관측 출처"}</span><b>{featured?.institution ?? "EDPB"}</b>{!featured && <><b>OECD</b><b>CURIA</b></>}</div>
        <p className={styles.featureBody}>{featured?.details || "각국의 주요 이슈와 공식 원문 출처를 함께 살펴보세요."}</p>
        <Link className={styles.featureLink} href={featured ? `/public/trends/${featured.id}` : "/public/search"}>{featured ? "동향 자세히 보기" : "동향 검색 열기"} <span>→</span></Link>
      </article>

      <aside className={styles.topicPanel}>
        <div className={styles.panelTitle}><h2>주제별 동향</h2><span /><Link href="/public/search">전체 보기 →</Link></div>
        <div className={styles.topicCards}>
          {topicCards.length ? topicCards.map((topic) => <Link key={topic.id} href={`/public/search?topic=${topic.id}`}>
            <strong>{topic.label}</strong><span>{topic.count}건 보기 →</span>
          </Link>) : <p className={styles.homeEmpty}>분류된 동향이 공개되면 주제별로 표시됩니다.</p>}
        </div>
      </aside>
    </section>

    <section className={styles.weeklyStrip} id="weekly">
      <div className={styles.weeklyLead}><h2>주간호</h2><p>한 주의 주요 개인정보 이슈를 선별해 전합니다.</p></div>
      <Link className={styles.weekCardActive} href="/public/weekly/podcast"><span>WEEKLY PODCAST</span><strong>주간 팟캐스트 듣기 →</strong><small>공개된 에피소드 바로가기</small></Link>
      <Link href="/public/weekly">주간호 전체 보기 →</Link>
    </section>
    <HomeVisitorCounts />
    <PublicFooter />
  </main>;
}
