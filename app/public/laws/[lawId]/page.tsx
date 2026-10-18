import { notFound } from "next/navigation";
import { loadPublicLegal } from "../../../../lib/public-legal";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import PublicLawReader from "../public-law-reader";
import styles from "../../public.module.css";

export const dynamic = "force-dynamic";

export default async function PublicLawTextPage({ params, searchParams }: { params: Promise<{ lawId: string }>; searchParams: Promise<{ back?: string }> }) {
  const { lawId } = await params;
  const { back } = await searchParams;
  const returnTo = back?.startsWith("/public/laws?") ? back : "/public/laws?view=full";
  const law = (await loadPublicLegal()).documents.find(item => item.id === lawId);
  if (!law) notFound();
  return <main className={styles.site}>
    <PublicHeader active="/public/laws" />
    <PublicLawReader law={law} returnTo={returnTo} />
    <PublicFooter />
  </main>;
}
