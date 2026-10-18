import PublicLawCompare from "./public-law-compare";
import { type LegalArticlePreview } from "../../../lib/legal-translation-review";
import { citedLegalPreview } from "../../../lib/legal-release";
import { loadPublicLegal } from "../../../lib/public-legal";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";

export const dynamic = "force-dynamic";

export default async function PublicLawComparePage({ searchParams }: { searchParams: Promise<{ view?: string; countries?: string; criterion?: string }> }) {
  const { view, countries, criterion } = await searchParams;
  const draftMode = publicSubmissionPreviewEnabled();
  const { cells, documents: translations, instruments } = await loadPublicLegal();
  const articlePreviews: Record<string, LegalArticlePreview> = {};
  for (const translation of translations) {
    const law = translation;
    if (!law) continue;
    for (const cell of cells.filter((item) => item.jurisdiction === translation.jurisdiction)) {
      for (const citation of cell.articleNumbers) {
        const preview = citedLegalPreview(law, citation);
        if (preview) articlePreviews[`${translation.id}:${citation}`] = preview;
      }
    }
  }
  return <PublicLawCompare
    cells={cells}
    instruments={instruments}
    translations={translations.map(({ id, jurisdiction, title, officialName, version, reviewStatus, articleCount }) => ({ id, jurisdiction, title, officialName, version, reviewStatus, articleCount }))}
    articlePreviews={articlePreviews}
    draftMode={draftMode}
    initialView={view === "compare" ? "compare" : "full"}
    initialSelected={countries?.split(",").filter(Boolean)}
    initialCriterion={criterion}
  />;
}
