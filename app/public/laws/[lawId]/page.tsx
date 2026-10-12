import { notFound } from "next/navigation";
import { loadLegalTranslation } from "../../../../lib/legal-translation-review";
import { publicSubmissionPreviewEnabled } from "../../../../lib/public-submission-preview";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import PublicLawReader from "../public-law-reader";
import styles from "../../public.module.css";

export const dynamic = "force-dynamic";

export default async function PublicLawTextPage({ params }: { params: Promise<{ lawId: string }> }) {
  if (!publicSubmissionPreviewEnabled()) notFound();
  const { lawId } = await params;
  const law = loadLegalTranslation(lawId);
  if (!law) notFound();
  return <main className={styles.site}>
    <PublicHeader active="/public/laws" />
    <PublicLawReader law={law} />
    <PublicFooter />
  </main>;
}
