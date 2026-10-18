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

/** A CSV's citation and link arrays are not parallel arrays. Match actual article identifiers. */
export function citedLegalPreview(law: LegalTranslationDocument, citation: string) {
  if (/규칙|조례|시행령|부칙|별표|부속서|개정법|S\.I\.|\bAct\s+\d+|DPA\s*2018/i.test(citation)) return null;
  return findLegalArticlePreview(law, citation);
}
