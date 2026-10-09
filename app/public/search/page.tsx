import TrendSearch from "../trend-search";
import styles from "../public.module.css";
import { PublicHeader, PublicFooter } from "../public-navigation";
export default async function PublicSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
 const { q } = await searchParams;
 return <main className={styles.site}><PublicHeader active="/public/search" /><TrendSearch initialQuery={q ?? ""} /><PublicFooter /></main>;
}
