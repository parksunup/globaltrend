import Link from "next/link";
import styles from "./public.module.css";

import { loadPublicStories } from "../../lib/public-content";
import { publicSubmissionPreviewEnabled } from "../../lib/public-submission-preview";
import { matchesPublicTopic, publicTopics } from "../../lib/public-topics";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../../lib/submission-preview";
import { PublicHeader, PublicFooter } from "./public-navigation";

export const dynamic = "force-dynamic";

export default async function PublicHome() {
  const draftMode = publicSubmissionPreviewEnabled();
  const legalItems = draftMode ? loadSubmissionPreview().filter((item) => item.kind === "법제 목록") : [];
  const comparisonCount = draftMode ? loadSubmissionDocuments().legal.length : 0;
  let allStories: Awaited<ReturnType<typeof loadPublicStories>> = [];
  let loadError = false;
  try { allStories = await loadPublicStories(); } catch (error) { console.error(error); loadError = true; }
  const stories = allStories.slice(0, 6);
  const featured = stories[0];
  const topicCards = publicTopics.map((topic) => ({ ...topic, count: allStories.filter((story) => matchesPublicTopic(story.tags, topic.id)).length })).filter((topic) => topic.count > 0);
  return <main className={styles.site}>
    <PublicHeader active="/public" />
    {draftMode && <div className={styles.draftNotice}>통합 테스트 · 담당자 제출 자료 · 사람 검수 전 초안입니다. 발행된 기사나 확정 법률 해설이 아닙니다. <Link href="/team">검수 화면 보기 →</Link></div>}
    {draftMode && <section className={styles.submissionStats} aria-label="담당자 제출 자료 현황"><Link href="/public/search"><strong>{allStories.length}건</strong><span>동향 표본</span></Link><Link href="/public/laws"><strong>{legalItems.length}개</strong><span>조사한 법률</span></Link><Link href="/public/laws?view=compare"><strong>{comparisonCount}칸</strong><span>17개 기준 비교표</span></Link></section>}

    <section className={styles.hero}>
      <div className={styles.heroTitle}>
        <p className={styles.overline}>GLOBAL PRIVACY OBSERVATORY</p>
        <h1>글로벌 개인정보 동향</h1>
        <p>세계의 개인정보 이슈를 한눈에, 법과 정책의 변화를 깊이 있게.</p>
      </div>
      <div className={styles.globe} aria-hidden="true" />
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
        <p className={styles.featureKicker}>{draftMode ? "최근 제출된 동향 표본" : "이번 주 주목할 흐름"}</p>
        <h2>{featured ? featured.title : "새로운 동향을 살펴보세요"}</h2>
        <h3>{featured ? featured.summary : "각국의 개인정보 보호 정책과 감독기구 발표를 한눈에 모읍니다."}</h3>
        <div className={styles.featureSource}><span>{featured ? "공식 출처" : "초기 관측 출처"}</span><b>{featured?.institution ?? "EDPB"}</b>{!featured && <><b>OECD</b><b>CURIA</b></>}</div>
        <p className={styles.featureBody}>{featured?.details || "검수된 자료가 공개되면 핵심 내용과 공식 원문 출처를 함께 확인할 수 있습니다."}</p>
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
      <div className={styles.weekCardActive}><span>WEEKLY BRIEFING</span><strong>주간호 준비 중</strong><small>발행된 주간호가 아직 없습니다.</small></div>
      <Link href="/public/weekly">주간호 전체 보기 →</Link>
    </section>
    <PublicFooter />
    <p className={styles.demoBanner}>{draftMode ? "이 화면의 동향·법제 자료는 검수 전 초안이며 정식 공개 자료가 아닙니다." : "공개 동향은 관리자 검수와 발행을 마친 자료만 표시합니다."}</p>
  </main>;
}
