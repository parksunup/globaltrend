import { loadPublishedLegalForSearch } from "../public-legal";
import type { LegalTranslationDocument } from "../legal-translation-review";
import { jurisdictionName } from "../jurisdictions";

/**
 * Evidence-only retrieval for the business legal-advisor prototype.
 * It deliberately reads the same published-only bundle as public law search;
 * unpublished translations are never loaded here.
 */
export type LegalEvidence = {
  jurisdiction: string;
  jurisdictionName: string;
  lawId: string;
  lawTitle: string;
  version: string;
  sectionId: string;
  sectionTitle: string;
  quote: string;
  officialUrl: string;
  inAppUrl: string;
  reviewStatus: "published" | "official";
  score: number;
};

export type LegalEvidenceResult = {
  query: string;
  evidence: LegalEvidence[];
  notice: string;
};

const stopWords = new Set([
  "그리고", "또는", "하지만", "위한", "대한", "하는", "있나요", "무엇", "어떻게", "the", "and", "for", "with", "what", "how",
]);

function terms(value: string): string[] {
  const normalized = value.normalize("NFKC").toLocaleLowerCase("ko-KR");
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const result = new Set(words.filter(word => word.length > 1 && !stopWords.has(word)));

  // Korean compounds are often queried without the exact spacing used by a law translation.
  // Add overlapping syllable pairs so a query such as "정보이동" can match "정보 이동권".
  for (const word of words.filter(word => /[\uac00-\ud7a3]/u.test(word) && word.length >= 3)) {
    for (let index = 0; index < word.length - 1; index += 1) result.add(word.slice(index, index + 2));
  }
  return [...result];
}

function rankSection(queryTerms: string[], title: string, text: string, exactQuery: string): number {
  const titleTerms = new Set(terms(title));
  const bodyTerms = new Set(terms(text));
  let score = 0;
  for (const term of queryTerms) {
    if (titleTerms.has(term)) score += 4;
    if (bodyTerms.has(term)) score += 1;
  }
  const normalizedQuery = exactQuery.normalize("NFKC").toLocaleLowerCase("ko-KR").trim();
  const normalizedBody = `${title} ${text}`.normalize("NFKC").toLocaleLowerCase("ko-KR");
  if (normalizedQuery.length >= 3 && normalizedBody.includes(normalizedQuery)) score += 8;
  return score;
}

function searchableDocuments(documents: LegalTranslationDocument[]) {
  return documents.filter(document => document.reviewStatus === "published" || document.reviewStatus === "official");
}

/**
 * Return relevant sections with traceable official-law citations.
 * No generated legal conclusion is returned by this function.
 */
export async function findPublishedLegalEvidence(
  question: string,
  options: { jurisdictions?: string[]; limit?: number } = {},
): Promise<LegalEvidenceResult> {
  const query = question.trim();
  if (!query) {
    return { query, evidence: [], notice: "질문을 입력해 주세요." };
  }

  const bundle = await loadPublishedLegalForSearch();
  const allowedJurisdictions = options.jurisdictions?.length ? new Set(options.jurisdictions) : null;
  const queryTerms = terms(query);
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const evidence = searchableDocuments(bundle.documents)
    .filter(document => !allowedJurisdictions || allowedJurisdictions.has(document.jurisdiction))
    .flatMap(document => document.sections
      .filter(section => section.reviewStatus === "published" || section.reviewStatus === "official")
      .map(section => {
        const quote = section.lines.map(line => `${line.label ? `${line.label} ` : ""}${line.text.trim()}`)
          .filter(Boolean).join("\n");
        const score = rankSection(queryTerms, section.title, `${section.context}\n${quote}`, query);
        return {
          jurisdiction: document.jurisdiction,
          jurisdictionName: jurisdictionName(document.jurisdiction),
          lawId: document.id,
          lawTitle: document.officialName,
          version: document.version,
          sectionId: section.id,
          sectionTitle: section.title,
          quote: quote.length > 1800 ? `${quote.slice(0, 1800).trimEnd()}…` : quote,
          officialUrl: document.officialUrl,
          inAppUrl: `/public/laws/${encodeURIComponent(document.id)}#${encodeURIComponent(section.id)}`,
          reviewStatus: document.reviewStatus as "published" | "official",
          score,
        } satisfies LegalEvidence;
      }))
    .filter(item => item.score > 0 && item.quote)
    .sort((left, right) => right.score - left.score || left.jurisdiction.localeCompare(right.jurisdiction) || left.sectionId.localeCompare(right.sectionId))
    .slice(0, limit);

  return {
    query,
    evidence,
    notice: evidence.length
      ? "공개 발행된 법령 자료에서 찾은 근거입니다. 각 국가의 적용 범위와 최신 개정 여부를 원문 링크에서 함께 확인해야 하며, 이 결과만으로 법률 자문을 대신하지 않습니다."
      : "공개 발행된 법령 자료에서 질문과 직접 연결되는 근거를 찾지 못했습니다. 검색 결과가 없다는 뜻이며 법률상 의무가 없다는 의미는 아닙니다.",
  };
}

/** Prompt boundary for a future approved model adapter. Evidence stays explicit. */
export function formatEvidenceForAnswer(evidence: LegalEvidence[]): string {
  if (!evidence.length) return "근거 자료가 없습니다. 법률상 결론을 추정하지 말고, 어떤 관할권·처리 상황의 자료가 필요한지 사용자에게 확인하세요.";
  return evidence.map((item, index) => [
    `[${index + 1}] ${item.jurisdictionName} · ${item.lawTitle} · ${item.version} · ${item.sectionTitle}`,
    `검수 상태: ${item.reviewStatus}`,
    `근거 원문/번역 발췌:\n${item.quote}`,
    `공식 원문: ${item.officialUrl}`,
  ].join("\n")).join("\n\n");
}
