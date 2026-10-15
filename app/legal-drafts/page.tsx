import { notFound } from "next/navigation";
import { submissionPreviewEnabled } from "../../lib/submission-preview";
import PublicDraftViewer from "../components/public-draft-viewer";

export const dynamic = "force-dynamic";

export default function LegalDraftsPage() {
  if (!submissionPreviewEnabled()) notFound();
  return <PublicDraftViewer />;
}
