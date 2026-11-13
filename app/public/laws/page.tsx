import PublicLawCompare from "./public-law-compare";
import { type LegalArticlePreview } from "../../../lib/legal-translation-review";
import { citedLegalPreview } from "../../../lib/legal-release";
import { loadPublicLegal, loadPublishedLegalForSearch } from "../../../lib/public-legal";
import { publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";

export const dynamic = "force-dynamic";

export default async function PublicLawComparePage({ searchParams }: { searchParams: Promise<{ view?: string; countries?: string; criterion?: string; back?: string; published?: string }> }) {
  const { view, countries, criterion, back, published } = await searchParams;
  const searchReturnTo = (back?.startsWith("/public/search?") || back?.startsWith("/public/unified-search?")) ? back : undefined;
  const publishedOnly = published === "1" || Boolean(searchReturnTo);
  const draftMode = !publishedOnly && publicSubmissionPreviewEnabled();
  const { cells, documents: translations, instruments } = await (publishedOnly ? loadPublishedLegalForSearch() : loadPublicLegal());
  const articlePreviews: Record<string, LegalArticlePreview> = {};
  for (const translation of translations) {
    const law = translation;
    if (!law) continue;
    for (const cell of cells.filter((item) => item.jurisdiction === translation.jurisdiction)) {
      for (const citation of cell.articleNumbers) {
        const links = cells.filter((item) => item.jurisdiction === translation.jurisdiction && item.articleNumbers.includes(citation))
          .flatMap((item) => item.translationLinks);
        const preview = citedLegalPreview(law, citation, links);
        if (preview) articlePreviews[`${translation.id}:${citation}`] = preview;
      }
    }
  }
  return <PublicLawCompare
    cells={cells}
    instruments={instruments}
    translations={translations.map(({ id, jurisdiction, title, officialName, version, reviewStatus, articleCount, officialUrl }) => ({ id, jurisdiction, title, officialName, version, reviewStatus, articleCount, officialUrl }))}
    articlePreviews={articlePreviews}
    draftMode={draftMode}
    publishedOnly={publishedOnly}
    searchReturnTo={searchReturnTo}
    initialView={view === "compare" ? "compare" : "full"}
    initialSelected={countries?.split(",").filter(Boolean)}
    initialCriterion={criterion}
  />;
}

