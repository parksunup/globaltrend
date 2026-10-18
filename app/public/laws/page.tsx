import PublicLawCompare from "./public-law-compare";
import { findLegalArticlePreview, listLegalTranslations, loadLegalTranslation, type LegalArticlePreview } from "../../../lib/legal-translation-review";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../../../lib/submission-preview";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";

export const dynamic = "force-dynamic";

export default async function PublicLawComparePage({ searchParams }: { searchParams: Promise<{ view?: string; countries?: string; criterion?: string }> }) {
  const { view, countries, criterion } = await searchParams;
  const draftMode = publicSubmissionPreviewEnabled();
  const cells = draftMode ? loadSubmissionDocuments().legal : [];
  const translations = draftMode ? listLegalTranslations() : [];
  const articlePreviews: Record<string, LegalArticlePreview> = {};
  for (const translation of translations) {
    const law = loadLegalTranslation(translation.id);
    if (!law) continue;
    for (const cell of cells.filter((item) => item.jurisdiction === translation.jurisdiction)) {
      for (const [index, citation] of cell.articleNumbers.entries()) {
        const preview = findLegalArticlePreview(law, citation, cell.translationLinks[index]);
        if (preview) articlePreviews[`${translation.id}:${citation}`] = preview;
      }
    }
  }
  return <PublicLawCompare
    cells={cells}
    instruments={draftMode ? loadSubmissionPreview().filter((item) => item.kind === "법제 목록") : []}
    translations={translations}
    articlePreviews={articlePreviews}
    draftMode={draftMode}
    initialView={view === "compare" ? "compare" : "full"}
    initialSelected={countries?.split(",").filter(Boolean)}
    initialCriterion={criterion}
  />;
}
