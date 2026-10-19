import { notFound } from "next/navigation";
import { submissionPreviewEnabled } from "../../lib/submission-preview";
import { loadLegalTranslation } from "../../lib/legal-translation-review";
import { loadReviewedSubmissionView } from "../../lib/publication-display";
import { loadReviewedLegalDrafts } from "../../lib/public-legal";
import PublicDraftViewer from "../components/public-draft-viewer";

export const dynamic = "force-dynamic";

export default async function LegalDraftsPage() {
  if (!submissionPreviewEnabled()) notFound();
  const [{documents}, bundle] = await Promise.all([loadReviewedSubmissionView(), loadReviewedLegalDrafts().catch(() => null)]);
  const gdpr = bundle?.documents.find(document => document.id === "gdpr") ?? loadLegalTranslation("gdpr");
  return <PublicDraftViewer documents={documents} gdpr={gdpr} branch={process.env.VERCEL_GIT_COMMIT_REF} commitSha={process.env.VERCEL_GIT_COMMIT_SHA}/>;
}
