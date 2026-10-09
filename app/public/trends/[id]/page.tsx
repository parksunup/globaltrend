import Link from "next/link";
import { notFound } from "next/navigation";
import { stories } from "../../demo-data";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";
export default async function TrendDetail({params}: {params: Promise<{id:string}>}) {
 const {id}=await params;const story=stories.find(item=>item.id===id);if(!story)notFound();
 return <main className={styles.site}><PublicHeader active="/public" /><section className={styles.searchPage}><article className={styles.trendDetail}><Link href="/public/search">← 동향 목록</Link><p className={styles.featureMeta}>{story.region} · {story.institution} · {story.date} · 화면 예시</p><h1>{story.title}</h1><p>{story.summary}</p><div className={styles.tagList}>{story.tags.map(tag=><Link key={tag} href={"/public/search?q="+encodeURIComponent(tag)}>{tag}</Link>)}</div><div className={styles.lawEmptyState}><strong>실제 발행 자료가 아닌 화면 예시입니다</strong><p>원문 링크와 관련 법 조항은 검수·발행된 실제 자료를 연결할 때 제공됩니다.</p></div></article></section><PublicFooter /></main>;
}
