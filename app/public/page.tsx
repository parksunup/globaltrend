import Link from "next/link";
import QuestionStart from "./explore/question-start";
import styles from "./public.module.css";

import { loadPublicStories } from "../../lib/public-content";
import { publicSubmissionPreviewEnabled } from "../../lib/public-submission-preview";
import { matchesPublicTopic, publicTopics } from "../../lib/public-topics";
import { PublicHeader, PublicFooter } from "./public-navigation";
import {createClient} from '../../lib/supabase/server';
import {loadLatestPublicPodcast} from '../../lib/public-podcast';
import HomePodcastPlayer from './home-podcast-player';
import HomeVisitorCounts from "./home-visitor-counts";
import {rankWeeklyCandidates,weeklyPriority} from '../../lib/weekly-priority';
import {formatMonthlyWeek} from '../../lib/weekly-label';

export const dynamic = "force-dynamic";

export default async function PublicHome() {
  const draftMode = publicSubmissionPreviewEnabled();
  let allStories: Awaited<ReturnType<typeof loadPublicStories>> = [];
  let loadError = false;
  try { allStories = await loadPublicStories(); } catch (error) { console.error(error); loadError = true; }
  const db=await createClient();
  const {podcast}=await loadLatestPublicPodcast(db);
  let stories: typeof allStories = [];
  let weeklyIssueError = false;
  let weeklyStart = '';
  let featuredReportId:string|null=null;
  try {
    const {data:issue,error:issueError}=await db.from('written_weekly_issues')
      .select('issue_key,week_start').eq('status','published')
      .order('week_start',{ascending:false}).order('issue_key',{ascending:false}).limit(1).maybeSingle();
    if(issueError)throw issueError;
    if(issue){
      weeklyStart=issue.week_start;
      const {data:manualFeature,error:featureError}=await db.from('homepage_featured_weekly_reports').select('report_id').eq('issue_key',issue.issue_key).maybeSingle();
      if(featureError)throw featureError;
      featuredReportId=manualFeature?.report_id??null;
      const {data:links,error:linksError}=await db.from('written_weekly_issue_reports')
        .select('report_id,sort_order').eq('issue_key',issue.issue_key).order('sort_order',{ascending:true});
      if(linksError)throw linksError;
      const byId=new Map(allStories.map(story=>[story.id,story] as const));
      stories=(links??[]).map(link=>byId.get(link.report_id)).filter((story):story is (typeof allStories)[number]=>Boolean(story))
        .sort((a,b)=>{
          const dateA=a.date==='날짜 미상'?'00000000':a.date.replaceAll('.','');
          const dateB=b.date==='날짜 미상'?'00000000':b.date.replaceAll('.','');
          return dateB.localeCompare(dateA);
        });
    }
  } catch(error) { console.error('Unable to load the published weekly selection:',error); weeklyIssueError=true; }
  const documentTypes:Record<string,string>={'법령':'legislation','가이드라인':'guidance','판례':'judgment','결정':'decision','의견':'opinion','보고서':'report','기관 발표':'press_release','뉴스':'news'};
  const rankedWeekly=rankWeeklyCandidates(stories.map(story=>({
    ...story,date:story.date==='날짜 미상'?'00000000':story.date,documentType:documentTypes[story.kind]??'',topics:story.tags,jurisdictions:story.jurisdictions??[],story,
  })));
  const featuredEntry=featuredReportId?rankedWeekly.find(candidate=>candidate.id===featuredReportId)??rankedWeekly[0]:rankedWeekly[0];
  const featured=featuredEntry?.story;
  const featuredReasons=featuredEntry?weeklyPriority(featuredEntry).reasons:[];
  const timelineStories=featured?stories.filter(story=>story.id!==featured.id):stories;
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

    <QuestionStart/>
    {podcast&&<HomePodcastPlayer podcast={podcast}/>}

    <section className={styles.observatoryGrid}>
      <div className={styles.timelinePanel}>
        <div className={styles.panelTitle}><h2>주간 동향</h2><span /><Link href="/public/weekly">전체 보기 →</Link></div>
        {timelineStories.length ? <ol className={styles.timeline}>{timelineStories.map((story, index) => <li key={story.id} className={index === 0 ? styles.timelineActive : ""}>
          <span className={styles.timelineDot} /><time>{story.date}</time><Link href={`/public/trends/${story.id}`}>{story.region}, {story.title}</Link>
        </li>)}</ol> : <p className={styles.homeEmpty}>{loadError||weeklyIssueError ? "주간 동향을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." : "아직 공개된 주간 동향이 없습니다."}</p>}
      </div>

      <article className={styles.featured}>
        <div className={styles.featureMeta}><span>{featured?.region ?? "GLOBAL"}</span><i>·</i><span>{featured?.tags[0] ?? "PRIVACY"}</span>{featured&&<><i>·</i><time>{featured.date}</time></>}</div>
        <p className={styles.featureKicker}>{featured ? `${weeklyStart?formatMonthlyWeek(weeklyStart)+' · ':''}${featuredReportId?'담당자 추천 자료':'주간 동향 중 중요도 우선 자료'}` : "공개된 주간 동향이 없습니다"}</p>
        <h2>{featured ? featured.title : "주간 동향을 준비하고 있습니다"}</h2>
        <h3>{featured ? featured.summary : "작업실에서 주간 동향을 공개하면 이곳에 표시됩니다."}</h3>
        {featured&&<div className={styles.featureSource}><span>선정 기준</span><b>{featuredReasons.join(' · ')}</b><span>공식 출처</span><b>{featured.institution}</b></div>}
        <p className={styles.featureBody}>{featured?.details || ""}</p>
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

    <HomeVisitorCounts />
    <PublicFooter />
  </main>;
}


