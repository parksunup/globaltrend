import TrendSearch from "../trend-search";
import styles from "../public.module.css";
import { PublicHeader, PublicFooter } from "../public-navigation";
import { loadPublishedStories, type PublishedStory } from "../../../lib/published-trends";
import { searchTrendPage, type TrendSearchFilters } from "../../../lib/trend-search-page";

export const dynamic = "force-dynamic";

export default async function PublicSearchPage({ searchParams }: { searchParams: Promise<TrendSearchFilters> }) {
  const supplied = await searchParams;
  const filters = Object.fromEntries(Object.entries(supplied).filter(([, value]) => typeof value === "string")) as TrendSearchFilters;
  let stories: PublishedStory[] = [];
  let loadError = false;
  try {
    stories = await loadPublishedStories(undefined, {includeDetails: false});
  } catch (error) {
    console.error("Unable to load public search results:", error);
    loadError = true;
  }
  return <main className={styles.site}><PublicHeader active="/public/search" /><TrendSearch filters={filters} result={searchTrendPage(stories, filters)} loadError={loadError} /><PublicFooter /></main>;
}
