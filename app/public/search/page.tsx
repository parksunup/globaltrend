import TrendSearch from "../trend-search";
import styles from "../public.module.css";
import { PublicHeader, PublicFooter } from "../public-navigation";
import { loadPublishedStories } from "../../../lib/published-trends";
export const dynamic = "force-dynamic";
export default async function PublicSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
 const { q } = await searchParams;
 let stories: Awaited<ReturnType<typeof loadPublishedStories>> = [];
 let loadError = false;
 try { stories = await loadPublishedStories(); } catch (error) { console.error(error); loadError = true; }
 return <main className={styles.site}><PublicHeader active="/public/search" /><TrendSearch initialQuery={q ?? ""} stories={stories} loadError={loadError} /><PublicFooter /></main>;
}
