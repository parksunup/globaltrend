import { notFound } from "next/navigation";
import { loadPublicLegal, loadPublishedLegalForSearch } from "../../../../lib/public-legal";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import PublicLawReader from "../public-law-reader";
import styles from "../../public.module.css";

export const dynamic = "force-dynamic";

export default async function PublicLawTextPage({ params, searchParams }: { params: Promise<{ lawId: string }>; searchParams: Promise<{ back?: string; published?: string }> }) {
  const { lawId } = await params;
  const { back, published } = await searchParams;
  const returnTo = (back?.startsWith("/public/laws?") || back?.startsWith("/public/search?")) ? back : "/public/laws?view=full";
  const publishedOnly = published === "1" || back?.startsWith("/public/search?") || (back?.startsWith("/public/laws?") && new URL(back, "https://local.invalid").searchParams.get("published") === "1");
  const law = (await (publishedOnly ? loadPublishedLegalForSearch() : loadPublicLegal())).documents.find(item => item.id === lawId);
  if (!law) notFound();
  return <main className={styles.site}>
    <PublicHeader active="/public/laws" />
    <PublicLawReader law={law} returnTo={returnTo} />
    <PublicFooter />
  </main>;
}
