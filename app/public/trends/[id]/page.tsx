import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublishedStory } from "../../../../lib/published-trends";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";
import {reportPoints} from '../../../../lib/trend-editorial';
import { loadPublicLegal } from '../../../../lib/public-legal';
import type { LegalTranslationDocument } from '../../../../lib/legal-translation-review';
import TrendLawCitations from '../trend-law-citations';

export const dynamic = "force-dynamic";

export default async function TrendDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const story = await loadPublishedStory(id);
  if (!story) notFound();
  let legalDocuments: LegalTranslationDocument[] = [];
  if (/(?:GDPR|CCPA|CPRA|PIPL|APPI|PDPA|개인정보보호법|한국\s*개인정보\s*보호법)/i.test(`${story.summary}\n${story.details}`)) {
    try {
      legalDocuments = (await loadPublicLegal()).documents;
    } catch {
      console.warn('Legal citations are unavailable on this trend page.');
    }
  }
  const returnTo = back?.startsWith("/public/search?") ? back : "/public/search";
  return <main className={styles.site}>
    <PublicHeader active="/public" />
    <section className={styles.searchPage}>
      <article className={styles.trendDetail}>
        <Link href={returnTo}>← 동향 목록으로</Link>
        <p className={styles.featureMeta}>{story.region} · {story.institution} · {story.date}</p>
        <h1>{story.title}</h1>
        <section className={styles.trendSummary}><h2>핵심 요약</h2><p><TrendLawCitations text={story.summary} documents={legalDocuments} idPrefix={`${story.id}-summary`} /></p></section>
        {story.details && <section className={styles.trendBody}><h2>주요 내용</h2>{story.details.startsWith('- ')?<ul className={styles.reportDetailPoints}>{reportPoints(story.details).map((point,index)=><li key={index}><p><TrendLawCitations text={point.text} documents={legalDocuments} idPrefix={`${story.id}-${index}`} /></p></li>)}</ul>:<p><TrendLawCitations text={story.details} documents={legalDocuments} idPrefix={`${story.id}-details`} /></p>}</section>}
        <div className={styles.tagList}>{story.tags.map((tag) => <Link key={tag} href={"/public/search?q=" + encodeURIComponent(tag)}>#{tag}</Link>)}</div>
        <div className={styles.lawEmptyState}><strong>공식 원문</strong><p>{story.originalTitle}</p><a href={story.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a></div>
      </article>
    </section>
    <PublicFooter />
  </main>;
}

