import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { loadSubmissionDocuments, loadSubmissionPreview, type LegalComparisonCell, type SubmissionItem } from "./submission-preview.ts";
import { findLegalArticlePreview, listLegalTranslations, loadLegalTranslation, type LegalTranslationDocument } from "./legal-translation-review.ts";

export type LegalReviewPackage = {
  recordId: string;
  jurisdiction: string;
  contentHash: string;
  versionLabel: string;
  instrument: SubmissionItem;
  availability: "translation" | "official_index" | "withheld" | "missing";
  document: LegalTranslationDocument | null;
  cells: LegalComparisonCell[];
};
export type LegalBundle = {
  cells: LegalComparisonCell[];
  instruments: SubmissionItem[];
  documents: LegalTranslationDocument[];
};

/** Server-built immutable review inputs. Never infer a body from a progress record. */
export function buildLegalReviewPackages(root = process.cwd()): LegalReviewPackage[] {
  const cells = loadSubmissionDocuments(root).legal;
  const translations = listLegalTranslations(root);
  return loadSubmissionPreview(root).filter(item => item.kind === "법제 목록").map(instrument => {
    const jurisdiction = instrument.fields.find(field => field.label === "관할권")?.value ?? "";
    const selectedCells = cells.filter(cell => cell.jurisdiction === jurisdiction);
    const translation = translations.find(law => law.jurisdiction === jurisdiction && instrument.id.endsWith(law.id));
    const document = translation ? loadLegalTranslation(translation.id, root) : null;
    const body = {
      recordId: instrument.id.replace(/^legal-/, ""), jurisdiction, instrument,
      versionLabel: selectedCells[0]?.sourceVersion ?? instrument.summary,
      availability: document ? "translation" as const : jurisdiction === "KR" ? "official_index" as const : jurisdiction === "EU" ? "withheld" as const : "missing" as const,
      document, cells: selectedCells,
    };
    return { ...body, contentHash: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
  });
}

/** Also filters defensively when invoked with a privileged database client. */
export function publishedLegalBundle(rows: { status: string; review_payload: LegalReviewPackage | null }[]): LegalBundle {
  const packages = rows.filter(row => row.status === "published" && row.review_payload).map(row => row.review_payload!);
  return {
    cells: packages.flatMap(p => p.cells.map(cell => ({ ...cell, status: "published" }))),
    instruments: packages.map(p => ({ ...p.instrument, status: "published" })),
    documents: packages.flatMap(p => p.document ? [{ ...p.document,
      scopeNote: p.document.scopeNote?.replace(/사람 검수 (?:전|미착수)\.?\s*/g, "").trim(),
      reviewStatus: "published", sections: p.document.sections.map(section => ({ ...section, reviewStatus: "published" })) }] : []),
  };
}

export function draftLegalBundle(root = process.cwd()): LegalBundle {
  const packages = buildLegalReviewPackages(root);
  return { cells: packages.flatMap(p => p.cells), instruments: packages.map(p => p.instrument), documents: packages.flatMap(p => p.document ? [p.document] : []) };
}

export function reviewedDraftLegalBundle(rows: {status: string; review_payload: LegalReviewPackage | null}[] | null, root = process.cwd()): LegalBundle {
  const published = (rows ?? []).filter(row => row.status === 'published' && row.review_payload).map(row => row.review_payload!);
  const body = ({contentHash: _hash, ...payload}: LegalReviewPackage) => payload;
  const bundles = buildLegalReviewPackages(root).map(p => {
    if (published.some(live => live.contentHash === p.contentHash && isDeepStrictEqual(body(live), body(p)))) return publishedLegalBundle([{status: 'published', review_payload: p}]);
    const state = rows === null ? 'unknown' : 'unreviewed';
    return {cells: p.cells.map(cell => ({...cell, status: state})), instruments: [{...p.instrument, status: state}],
      documents: p.document ? [{...p.document, reviewStatus: rows === null ? 'unknown' : p.document.reviewStatus,
        sections: p.document.sections.map(section => ({...section, reviewStatus: rows === null ? 'unknown' : section.reviewStatus}))}] : []};
  });
  return {cells: bundles.flatMap(b => b.cells), instruments: bundles.flatMap(b => b.instruments), documents: bundles.flatMap(b => b.documents)};
}

/** A CSV's citation and link arrays are not parallel arrays. Match actual article identifiers. */
export function citedLegalPreview(law: LegalTranslationDocument, citation: string, translationLinks: string[] = []) {
  if (law.id === "pipa" && /부칙/.test(citation)) {
    const lawNumber = citation.match(/법률\s*제(\d+)호/)?.[1];
    const articleNumber = citation.match(/제(\d+)조/)?.[1];
    const supplement = law.sections.find(section => section.group === "supplementary" && (!lawNumber || section.title.includes(`제${lawNumber}호`)));
    if (supplement) {
      const articleLine = articleNumber ? supplement.lines.find(line => new RegExp(`(?:^|\\s)제${articleNumber}조(?:\\s|[.(])`).test(line.text)) : undefined;
      const lines = articleLine ? [articleLine] : supplement.lines;
      const text = [supplement.title, ...lines.map(line => line.text)].join("\n");
      return { anchorId: articleLine?.id ?? supplement.id, text: text.length > 360 ? `${text.slice(0, 360).trimEnd()}…` : text };
    }
  }
  const recitalNumber = citation.match(/고려사항\s*(\d+)/i)?.[1];
  if (recitalNumber) {
    const recitalAnchor = `recital-${recitalNumber}`;
    const recital = findLegalArticlePreview(law, citation, `#${recitalAnchor}`);
    if (recital) return recital;
  }
  const tableNumber = citation.match(/별표\s*제?(\d+)/)?.[1];
  if (tableNumber) {
    const tableAnchor = `law-table${tableNumber}`;
    const table = findLegalArticlePreview(law, citation, `#${tableAnchor}`);
    if (table) return table;
  }
  if (/부칙/.test(citation)) {
    const provision = citation.match(/(?:제(\d+)조)?\s*제(\d+)항(?:\s*제(\d+)호)?/);
    const amendment = citation.match(/\(([^)]*법률\s*제\d+호)\)/)?.[1];
    if (provision && amendment) {
      const supplementAnchors = translationLinks.map(link => link.match(/#(suppl\d+(?:-a\d+)?(?:-p\d+)?(?:-i\d+)?)$/i)?.[1]).filter((anchor): anchor is string => Boolean(anchor));
      for (const anchor of supplementAnchors) {
        const sectionId = anchor.match(/^(suppl\d+)/i)?.[1];
        const section = law.sections.find(item => item.id === sectionId);
        const article = anchor.match(/-a(\d+)/i)?.[1];
        const paragraph = anchor.match(/-p(\d+)/i)?.[1];
        const item = anchor.match(/-i(\d+)/i)?.[1];
        if (section?.context.includes(amendment) && (!provision[1] || article === provision[1]) &&
            paragraph === provision[2] && (!provision[3] || item === provision[3])) {
          const preview = findLegalArticlePreview(law, citation, `#${anchor}`);
          if (preview) return preview;
        }
      }
    }
  }
  if (law.id === "pipa") {
    const label = citation.match(/제\d+조(?:의\d+)?/)?.[0];
    const section = label && law.sections.find((item) => item.group === "main" && item.title.startsWith(`${label}(`));
    if (!section) return null;
    const text = [section.title, ...section.lines.map((line) => line.text)].join("\n");
    return { anchorId: section.id, text: text.length > 360 ? `${text.slice(0, 360).trimEnd()}…` : text };
  }
  // Keep the proven article-number lookup as the primary path; explicit anchors
  // supplement it for recitals, schedules, and provisions outside the main body.
  const directPreview = findLegalArticlePreview(law, citation);
  if (directPreview) return directPreview;
  // Use a cell's explicit translation anchor where it identifies the cited provision.
  // The CSV arrays are not parallel, so match the article identifier in the anchor.
  const references: { article: string; paragraph: string | undefined; item: string | undefined }[] = Array.from(citation.matchAll(/제(\d+[a-zA-Z]?)조(?:의(\d+))?(?:\s*제(\d+)항)?(?:\s*제(\d+)호)?/g), match => ({ article: `${match[1]}${match[2] ? `-${match[2]}` : ""}`.toLowerCase(), paragraph: match[3], item: match[4] }));
  if (!references.length) {
    references.push(...Array.from(citation.matchAll(/(?:(?:Article|section)\s+)?(\d+(?:\.\d+)*[a-zA-Z]?)(?:\((\d+)\))?/gi), match => ({ article: match[1].replaceAll(".", "-").toLowerCase(), paragraph: match[2], item: undefined })));
  }
  const linkedAnchors = translationLinks.map(link => link.match(/#([a-zA-Z0-9-]+)$/)?.[1]).filter((anchor): anchor is string => Boolean(anchor));
  const linkedPreviews = linkedAnchors.flatMap(anchor => {
    const id = anchor.match(/(?:^|-)a([\da-z]+(?:-[\da-z]+)*?)(?:-p(\d+))?(?:-i(\d+))?$/i);
    if (!id) return [];
    const article = id[1].toLowerCase();
    const matchingReference = references.find(reference => reference.article === article &&
      (reference.paragraph ? !id[2] || id[2] === reference.paragraph : !id[2]) &&
      (reference.item ? !id[3] || id[3] === reference.item : !id[3]));
    if (!matchingReference) return [];
    const preview = findLegalArticlePreview(law, citation, `#${anchor}`);
    return preview ? [preview] : [];
  });
  if (linkedPreviews.length) {
    const distinct = [...new Map(linkedPreviews.map(preview => [preview.anchorId, preview])).values()];
    const text = distinct.map(preview => preview.text).join("\n\n");
    return { anchorId: distinct[0].anchorId, text: text.length > 360 ? `${text.slice(0, 360).trimEnd()}…` : text };
  }
  if (/규칙|조례|시행령|부칙|별표|부속서|개정법|S\.I\.|\bAct\s+\d+|DPA\s*2018/i.test(citation)) return null;
  return findLegalArticlePreview(law, citation);
}

