import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublishedStory } from "../../../../lib/published-trends";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";
export const dynamic = "force-dynamic";

export default async function TrendDetail({params}: {params: Promise<{id:string}>}) {
 const {id}=await params;const story=await loadPublishedStory(id);if(!story)notFound();
 return <main className={styles.site}><PublicHeader active="/public" /><section className={styles.searchPage}><article className={styles.trendDetail}><Link href="/public/search">← 동향 목록</Link><p className={styles.featureMeta}>{story.region} · {story.institution} · {story.date}</p><h1>{story.title}</h1><p>{story.summary}</p>{story.details && <p>{story.details}</p>}<div className={styles.tagList}>{story.tags.map(tag=><Link key={tag} href={"/public/search?q="+encodeURIComponent(tag)}>{tag}</Link>)}</div><div className={styles.lawEmptyState}><strong>공식 원문</strong><p>{story.originalTitle}</p><a href={story.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a></div></article></section><PublicFooter /></main>;
}
