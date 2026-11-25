import Link from "next/link";
import styles from "./public.module.css";
import searchStyles from "./unified-search.module.css";

import { loadPublishedStories } from "../../lib/published-trends";
import { publicSubmissionPreviewEnabled } from "../../lib/public-submission-preview";
import { matchesPublicTopic, publicTopics } from "../../lib/public-topics";
import { PublicHeader, PublicFooter } from "./public-navigation";
import {createClient} from '../../lib/supabase/server';
import {loadLatestPublicPodcast} from '../../lib/public-podcast';
import HomePodcastPlayer from './home-podcast-player';
import HomeVisitorCounts from "./home-visitor-counts";
import {rankWeeklyCandidates} from '../../lib/weekly-priority';
import {readAllPages} from "../../lib/read-all-pages";
import {formatMonthlyWeek} from '../../lib/weekly-label';

function timelineLabel(region: string, title: string) {
  const titleStart = title.trimStart().toLocaleLowerCase();
  const duplicatedRegion = region.split(/[·,，]/).map(part => part.trim()).filter(Boolean)
    .some(part => titleStart.startsWith(part.toLocaleLowerCase()) && /[\s,，·:：\-–—]/.test(titleStart[part.length] ?? ""));
  return duplicatedRegion ? title : `${region}, ${title}`;
}

export const dynamic = "force-dynamic";

export default async function PublicHome() {
  const draftMode = publicSubmissionPreviewEnabled();
  const db = await createClient();

  async function loadWeeklySelection() {
    const {data: issue, error: issueError} = await db.from("written_weekly_issues")
      .select("issue_key,week_start").eq("status", "published")
      .order("week_start", {ascending: false}).order("issue_key", {ascending: false}).limit(1).maybeSingle();
    if (issueError) throw issueError;
    if (!issue) return null;
    const [feature, links] = await Promise.all([
      db.from("homepage_featured_weekly_reports").select("report_id").eq("issue_key", issue.issue_key).maybeSingle(),
      db.from("written_weekly_issue_reports").select("report_id,sort_order").eq("issue_key", issue.issue_key).order("sort_order"),
    ]);
    if (feature.error) throw feature.error;
    if (links.error) throw links.error;
    const ids = (links.data ?? []).map(link => link.report_id);
    const byId = new Map((await loadPublishedStories(undefined, {ids})).map(story => [story.id, story]));
    const stories = ids.flatMap(id => {
      const story = byId.get(id);
      return story ? [story] : [];
    }).sort((a, b) => {
      const date = (value: string) => value === "날짜 미상" ? "" : value;
      return date(b.date).localeCompare(date(a.date));
    });
    return {stories, weeklyStart: issue.week_start, featuredReportId: feature.data?.report_id ?? null};
  }

  async function loadTopicCounts(): Promise<Record<string, number>> {
    const {data, error} = await db.rpc("public_trend_topic_counts", {
      p_topics: Object.fromEntries(publicTopics.map(topic => [topic.id, topic.terms])),
    });
    if (!error) return data ?? {};
    if (error.code !== "PGRST202") throw error;
    // Preview databases may not have the migration yet. Fetch tags only.
    const tags = await readAllPages(async (offset, count) => {
      const {data, error} = await db.from("reports").select("topics")
        .eq("status", "published").order("id").range(offset, offset + count - 1);
      if (error) throw error;
      return data ?? [];
    });
    return Object.fromEntries(publicTopics.map(topic => [
      topic.id, tags.filter(row => matchesPublicTopic(row.topics ?? [], topic.id)).length,
    ]));
  }

  const [weekly, podcastResult, topics] = await Promise.allSettled([
    loadWeeklySelection(),
    loadLatestPublicPodcast(db),
    loadTopicCounts(),
  ]);
  const weeklyIssueError = weekly.status === "rejected";
  if (weeklyIssueError) console.error("Unable to load the published weekly selection:", weekly.reason);
  const {stories = [], weeklyStart = "", featuredReportId = null} = weekly.status === "fulfilled" ? weekly.value ?? {} : {};
  const podcast = podcastResult.status === "fulfilled" ? podcastResult.value.podcast : null;
  const topicError = topics.status === "rejected";
  const topicCounts = topics.status === "fulfilled" ? topics.value : {};
  if (topicError) console.error("Unable to load public topic counts:", topics.reason);
  const documentTypes:Record<string,string>={'법령':'legislation','가이드라인':'guidance','판례':'judgment','결정':'decision','의견':'opinion','보고서':'report','기관 발표':'press_release','뉴스':'news'};
  const rankedWeekly=rankWeeklyCandidates(stories.map(story=>({
    ...story,date:story.date==='날짜 미상'?'00000000':story.date,documentType:documentTypes[story.kind]??'',topics:story.tags,jurisdictions:story.jurisdictions??[],story,
  })));
  const featuredEntry=featuredReportId?rankedWeekly.find(candidate=>candidate.id===featuredReportId)??rankedWeekly[0]:rankedWeekly[0];
  const featured=featuredEntry?.story;
  const timelineStories=featured?stories.filter(story=>story.id!==featured.id):stories;
  const topicCards = publicTopics.map((topic) => ({ ...topic, count: Number(topicCounts?.[topic.id] ?? 0) })).filter((topic) => topic.count > 0);
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

    <section className={searchStyles.compact} aria-label="통합 검색 안내"><div><strong>궁금한 개인정보 이슈가 있나요?</strong><p>질문으로 동향과 국가별 법제·근거를 함께 찾아보세요.</p></div><Link href="/public/unified-search">통합 검색 →</Link></section>
    {podcast&&<HomePodcastPlayer podcast={podcast}/>}

    <section className={styles.observatoryGrid}>
      <div className={styles.timelinePanel}>
        <div className={styles.panelTitle}><h2>주간 동향</h2><span /><Link href="/public/weekly">전체 보기 →</Link></div>
        {timelineStories.length ? <ol className={styles.timeline}>{timelineStories.map((story, index) => <li key={story.id} className={index === 0 ? styles.timelineActive : ""}>
          <span className={styles.timelineDot} /><time>{story.date}</time><Link href={`/public/trends/${story.id}`}>{timelineLabel(story.region, story.title)}</Link>
        </li>)}</ol> : <p className={styles.homeEmpty}>{weeklyIssueError ? "주간 동향을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." : "아직 공개된 주간 동향이 없습니다."}</p>}
      </div>

      <article className={styles.featured}>
        <div className={styles.featureMeta}><span>{featured?.region ?? "GLOBAL"}</span><i>·</i><span>{featured?.tags[0] ?? "PRIVACY"}</span>{featured&&<><i>·</i><time>{featured.date}</time></>}</div>
        <p className={styles.featureKicker}>{featured ? `${weeklyStart?formatMonthlyWeek(weeklyStart)+' · ':''}${featuredReportId?'담당자 추천 자료':'주간 동향 중 중요도 우선 자료'}` : "공개된 주간 동향이 없습니다"}</p>
        <h2>{featured ? featured.title : "주간 동향을 준비하고 있습니다"}</h2>
        <h3>{featured ? featured.summary : "작업실에서 주간 동향을 공개하면 이곳에 표시됩니다."}</h3>
        {featured&&<div className={styles.featureSource}><span>공식 출처</span><b>{featured.institution}</b></div>}
        <p className={styles.featureBody}>{featured?.details || ""}</p>
        <Link className={styles.featureLink} href={featured ? `/public/trends/${featured.id}` : "/public/search"}>{featured ? "동향 자세히 보기" : "동향 검색 열기"} <span>→</span></Link>
      </article>

      <aside className={styles.topicPanel}>
        <div className={styles.panelTitle}><h2>주제별 동향</h2><span /><Link href="/public/search">전체 보기 →</Link></div>
        <div className={styles.topicCards}>
          {topicCards.length ? topicCards.map((topic) => <Link key={topic.id} href={`/public/search?topic=${topic.id}`}>
            <strong>{topic.label}</strong><span>{topic.count}건 보기 →</span>
          </Link>) : <p className={styles.homeEmpty}>{topicError ? "주제별 건수를 불러오지 못했습니다." : "분류된 동향이 공개되면 주제별로 표시됩니다."}</p>}
        </div>
      </aside>
    </section>

    <HomeVisitorCounts />
    <PublicFooter />
  </main>;
}


