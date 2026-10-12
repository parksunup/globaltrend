import TrendSearch from "../trend-search";
import styles from "../public.module.css";
import { PublicHeader, PublicFooter } from "../public-navigation";
import { loadPublicStories } from "../../../lib/public-content";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";
export const dynamic = "force-dynamic";
export default async function PublicSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
 const { q, topic } = await searchParams;
 let stories: Awaited<ReturnType<typeof loadPublicStories>> = [];
 let loadError = false;
 try { stories = await loadPublicStories(); } catch (error) { console.error(error); loadError = true; }
 return <main className={styles.site}><PublicHeader active="/public/search" /><TrendSearch initialQuery={q ?? ""} initialTopic={topic ?? ""} stories={stories} loadError={loadError} draftMode={publicSubmissionPreviewEnabled()} /><PublicFooter /></main>;
}
