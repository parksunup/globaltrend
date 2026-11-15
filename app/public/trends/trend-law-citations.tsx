import RelatedArticlePreview from "../laws/related-article-preview";
import { citedLegalPreview } from "../../../lib/legal-release";
import type { LegalTranslationDocument } from "../../../lib/legal-translation-review";

const lawLabels: { pattern: RegExp; lawId: string }[] = [
  { pattern: /UK\s*GDPR/gi, lawId: "uk-gdpr" },
  { pattern: /(?<!UK\s)GDPR/gi, lawId: "gdpr" },
  { pattern: /\b(?:CCPA|CPRA)\b/gi, lawId: "ccpa" },
  { pattern: /\bPIPL\b|중국\s*개인정보보호법/gi, lawId: "pipl" },
  { pattern: /\bAPPI\b|일본\s*(?:개인정보보호법|개인정보\s*보호법|개인정보의\s*보호에\s*관한\s*법률)/gi, lawId: "appi" },
  { pattern: /\bPDPA\b|싱가포르\s*(?:개인정보보호법|개인정보\s*보호법)/gi, lawId: "pdpa" },
  { pattern: /한국\s*(?:개인정보보호법|개인정보\s*보호법)|개인정보보호법/gi, lawId: "pipa" },
];

type Citation = { start: number; end: number; lawId: string; label: string; article: string; anchorId: string; text: string };

function citationsIn(text: string, documents: LegalTranslationDocument[]): Citation[] {
  const labels = lawLabels.flatMap(({ pattern, lawId }) => [...text.matchAll(pattern)].map(match => ({ start: match.index ?? 0, lawId }))).sort((left, right) => left.start - right.start);
  const refs = [...text.matchAll(/제\d+조(?:의\d+)?(?:\s*제\d+항(?:\s*제\d+호)?)?|(?:Article|section)\s+\d+(?:\.\d+)*(?:\([a-z0-9]+\))?/gi)];
  const result: Citation[] = [];
  for (const ref of refs) {
    const start = ref.index ?? 0;
    const end = start + ref[0].length;
    const lastBoundary = Math.max(text.lastIndexOf(".", start), text.lastIndexOf("。", start), text.lastIndexOf("!", start), text.lastIndexOf("?", start), text.lastIndexOf("\n", start));
    const lawLabel = labels.filter(label => label.start < start && label.start > lastBoundary).at(-1);
    if (!lawLabel) continue;
    const law = documents.find(document => document.id === lawLabel.lawId);
    if (!law) continue;
    const article = ref[0].replace(/^(?:Article|section)\s+/i, "").split(/[\s(]/)[0];
    const articleCitation = /^제/.test(ref[0]) ? ref[0] : article;
    const preview = citedLegalPreview(law, articleCitation);
    if (!preview) continue;
    result.push({ start, end, lawId: law.id, label: ref[0], article: articleCitation, anchorId: preview.anchorId, text: preview.text });
  }
  return result;
}

export default function TrendLawCitations({ text, documents, idPrefix }: {
  text: string;
  documents: LegalTranslationDocument[];
  idPrefix: string;
}) {
  const citations = citationsIn(text, documents);
  if (!citations.length) return <>{text}</>;
  const parts: import("react").ReactNode[] = [];
  let cursor = 0;
  citations.forEach((citation, index) => {
    if (citation.start < cursor) return;
    parts.push(text.slice(cursor, citation.start));
    const destination = `/public/laws/${citation.lawId}#${citation.anchorId}`;
    parts.push(<RelatedArticlePreview key={`${citation.start}-${index}`} citation={citation.label} destination={destination} internal text={citation.text} tooltipId={`trend-law-${idPrefix}-${index}`} />);
    cursor = citation.end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

