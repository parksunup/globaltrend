import { notFound } from "next/navigation";
import { submissionPreviewEnabled } from "../../lib/submission-preview";
import DraftViewer from "../components/draft-viewer";

export const dynamic = "force-dynamic";

export default function LegalDraftsPage() {
  if (!submissionPreviewEnabled()) notFound();
  return <DraftViewer />;
}
