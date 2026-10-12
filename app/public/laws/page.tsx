import PublicLawCompare from "./public-law-compare";
import { listLegalTranslations } from "../../../lib/legal-translation-review";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../../../lib/submission-preview";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";

export const dynamic = "force-dynamic";

export default async function PublicLawComparePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const draftMode = publicSubmissionPreviewEnabled();
  return <PublicLawCompare
    cells={draftMode ? loadSubmissionDocuments().legal : []}
    instruments={draftMode ? loadSubmissionPreview().filter((item) => item.kind === "법제 목록") : []}
    translations={draftMode ? listLegalTranslations() : []}
    draftMode={draftMode}
    initialView={view === "compare" ? "compare" : "full"}
  />;
}
