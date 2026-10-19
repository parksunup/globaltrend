import TrendSearch from "../trend-search";
import styles from "../public.module.css";
import { PublicHeader, PublicFooter } from "../public-navigation";
import { loadPublicStories } from "../../../lib/public-content";
export const dynamic = "force-dynamic";
export default async function PublicSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string; country?: string; period?: string; from?: string; to?: string; mode?: string; sort?: string; restore?: string }> }) {
 const filters = await searchParams;
 const { q, topic } = filters;
 let stories: Awaited<ReturnType<typeof loadPublicStories>> = [];
 let loadError = false;
 try { stories = await loadPublicStories(); } catch (error) { console.error(error); loadError = true; }
 return <main className={styles.site}><PublicHeader active="/public/search" /><TrendSearch initialQuery={q ?? ""} initialTopic={topic ?? ""} initialFilters={filters} stories={stories} loadError={loadError} /><PublicFooter /></main>;
}
