import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSubmittedStories, publicSubmissionPreviewEnabled } from "../../../../lib/public-submission-preview";
import { loadPublishedStory } from "../../../../lib/published-trends";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";

export const dynamic = "force-dynamic";

export default async function TrendDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const draftMode = publicSubmissionPreviewEnabled();
  const story = draftMode ? loadSubmittedStories().find((item) => item.id === id) : await loadPublishedStory(id);
  if (!story) notFound();
  const returnTo = back?.startsWith("/public/search?") ? back : "/public/search";
  return <main className={styles.site}>
    <PublicHeader active="/public" />
    <section className={styles.searchPage}>
      <article className={styles.trendDetail}>
        <Link href={returnTo}>← 동향 목록으로</Link>
        <p className={styles.featureMeta}>{story.region} · {story.institution} · {story.date}</p>
        <h1>{story.title}</h1>
        {draftMode && <p className={styles.draftNotice}>담당자 제출 동향 표본 · 사람 검수 전 초안입니다.</p>}
        <section className={styles.trendSummary}><h2>핵심 요약</h2><p>{story.summary}</p></section>
        {story.details && <section className={styles.trendBody}><h2>자세히 보기</h2><p>{story.details}</p></section>}
        <div className={styles.tagList}>{story.tags.map((tag) => <Link key={tag} href={"/public/search?q=" + encodeURIComponent(tag)}>#{tag}</Link>)}</div>
        <div className={styles.lawEmptyState}><strong>공식 원문</strong><p>{story.originalTitle}</p><a href={story.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a></div>
      </article>
    </section>
    <PublicFooter />
  </main>;
}
