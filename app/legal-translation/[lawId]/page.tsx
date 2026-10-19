import { loadReviewedLegalDrafts } from "../../../lib/public-legal";
import { notFound } from "next/navigation";
import TranslationReview from "../../components/translation-review";
import { loadLegalTranslation } from "../../../lib/legal-translation-review";
import { submissionPreviewEnabled } from "../../../lib/submission-preview";

export const dynamic = "force-dynamic";

export default async function LegalTranslationPage({ params }: { params: Promise<{ lawId: string }> }) {
  const { lawId } = await params;
  const published = await loadReviewedLegalDrafts().then(bundle => bundle.documents.find(document => document.id === lawId)).catch(() => null);
  const document = published ?? (submissionPreviewEnabled() ? loadLegalTranslation(lawId) : null);
  if (!document) notFound();
  return <TranslationReview
    lawId={document.id}
    title={document.title}
    sections={document.sections}
    officialName={document.officialName}
    officialUrl={document.officialUrl}
    version={document.version}
    scopeNote={document.scopeNote}
    reviewStatus={document.reviewStatus}
    branch={process.env.VERCEL_GIT_COMMIT_REF}
    commitSha={process.env.VERCEL_GIT_COMMIT_SHA}
  />;
}
