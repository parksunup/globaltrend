import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { TranslationSection } from "../app/components/translation-review";

type Provision = {
  node_id: string;
  parent_id?: string;
  tag: string;
  number?: string;
  scope?: string;
  source_order: number;
  korean_title?: string;
  korean_text?: string | null;
  human_review_status?: string;
};
type Corpus = {
  jurisdiction_code?: string;
  official_name?: string;
  korean_title?: string;
  source?: { original_url?: string; selected_revision_enforcement_date?: string; scope_note?: string };
  translation?: { human_review_status?: string; language?: string };
  provisions?: Provision[];
};

export type LegalTranslationSummary = {
  id: string;
  jurisdiction: string;
  title: string;
  officialName: string;
  version: string;
  reviewStatus: string;
  articleCount: number;
};

export type LegalTranslationDocument = LegalTranslationSummary & {
  officialUrl: string;
  scopeNote: string;
  sections: TranslationSection[];
};

const validId = /^[a-z0-9][a-z0-9-]*$/;

function translationsDir(root: string) {
  return join(root, "data", "legal", "translations");
}

export type LegalTranslationEntry = LegalTranslationSummary | { id: string; error: string };

function inspectCorpus(root: string, id: string): { corpus: Corpus | null; error: string } {
  if (!validId.test(id)) return { corpus: null, error: "파일 이름이 올바르지 않습니다." };
  const path = join(translationsDir(root), `${id}.json`);
  if (!existsSync(path)) return { corpus: null, error: "번역 파일이 없습니다." };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { corpus: null, error: "JSON 문법을 읽을 수 없습니다." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { corpus: null, error: "법률 데이터는 객체여야 합니다." };
  }
  const corpus = data as Corpus;
  if (!Array.isArray(corpus.provisions) || corpus.provisions.length === 0 ||
      !corpus.provisions.every((node) => node && typeof node.node_id === "string" &&
        node.node_id.trim() && typeof node.tag === "string" && node.tag.trim() &&
        Number.isFinite(node.source_order))) {
    return { corpus: null, error: "조문 배열(provisions)의 형식이 올바르지 않습니다." };
  }
  return { corpus, error: "" };
}

function readCorpus(root: string, id: string): Corpus | null {
  return inspectCorpus(root, id).corpus;
}

function summary(id: string, corpus: Corpus): LegalTranslationSummary {
  const provisions = corpus.provisions ?? [];
  return {
    id,
    jurisdiction: typeof corpus.jurisdiction_code === "string" ? corpus.jurisdiction_code : "",
    title: typeof corpus.korean_title === "string" && corpus.korean_title.trim() ? corpus.korean_title.trim() : `${id.toUpperCase()} 한국어 번역 초안`,
    officialName: typeof corpus.official_name === "string" && corpus.official_name.trim() ? corpus.official_name.trim() : id.toUpperCase(),
    version: corpus.source?.selected_revision_enforcement_date || "판본 확인 필요",
    reviewStatus: corpus.translation?.human_review_status || "검토 필요",
    articleCount: provisions.filter((node) => node.tag === "Article").length,
  };
}

export function listLegalTranslationEntries(root = process.cwd()): LegalTranslationEntry[] {
  const dir = translationsDir(root);
  if (!existsSync(dir)) return [];
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  return names
    .filter((name) => name.endsWith(".json") && validId.test(name.slice(0, -5)))
    .map((name) => {
      const id = name.slice(0, -5);
      const result = inspectCorpus(root, id);
      return result.corpus ? summary(id, result.corpus) : { id, error: result.error };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function listLegalTranslations(root = process.cwd()): LegalTranslationSummary[] {
  return listLegalTranslationEntries(root).filter((entry): entry is LegalTranslationSummary => !("error" in entry));
}

export function loadLegalTranslation(id: string, root = process.cwd()): LegalTranslationDocument | null {
  const corpus = readCorpus(root, id);
  if (!corpus) return null;
  const nodes = [...corpus.provisions!].sort((a, b) => a.source_order - b.source_order);
  const byId = new Map(nodes.map((node) => [node.node_id, node]));
  const supplementary = new Map(nodes.filter((node) => node.tag === "SupplProvision").map((node) => [node.scope, node.korean_title ?? "부칙"]));
  const roots = nodes.filter((node) => ["Article", "AppdxTable", "SupplProvision", "Recital", "Preamble", "Footnote"].includes(node.tag));
  const sectionById = new Map<string, TranslationSection>();
  for (const node of roots) {
    const group = ["Recital", "Preamble", "Footnote"].includes(node.tag) ? "reference" : node.tag === "AppdxTable" ? "appendix" : node.tag === "SupplProvision" || node.scope !== "main" ? "supplementary" : "main";
    sectionById.set(node.node_id, {
      id: node.node_id,
      group,
      title: node.korean_title || (node.tag === "Article" ? `제${node.number}조` : node.tag === "AppdxTable" ? `별표 ${node.number}` : "부칙"),
      context: group === "reference" ? "서문·고려사항·주석" : group === "supplementary" ? supplementary.get(node.scope) ?? "부칙" : group === "appendix" ? "별표·부속서" : "본칙",
      reviewStatus: node.human_review_status ?? "not_started",
      lines: [],
    });
  }
  for (const node of nodes) {
    if (typeof node.korean_text !== "string" || !node.korean_text.trim()) continue;
    let parent = byId.get(node.parent_id ?? "");
    while (parent && !sectionById.has(parent.node_id)) parent = byId.get(parent.parent_id ?? "");
    let section = sectionById.get(node.node_id) ?? (parent && sectionById.get(parent.node_id));
    if (!section) {
      const fallbackId = `unassigned-${node.scope || "main"}`;
      section = sectionById.get(fallbackId);
      if (!section) {
        const group = node.scope === "appendix" ? "appendix" : node.scope && node.scope !== "main" ? "supplementary" : "main";
        section = { id: fallbackId, group, title: "기타 번역 본문", context: "구조 확인 필요", reviewStatus: "not_started", lines: [] };
        sectionById.set(fallbackId, section);
      }
    }
    const label = node.tag === "Paragraph" ? `${node.number}항` :
      node.tag === "Item" ? `${node.number}호` :
      node.tag === "Subitem1" ? `${node.number}목` :
      node.tag === "TableColumn" ? "표 셀" : "";
    section.lines.push({ id: node.node_id, label, text: node.korean_text });
  }
  return {
    ...summary(id, corpus),
    officialUrl: corpus.source?.original_url || "",
    scopeNote: corpus.source?.scope_note || "",
    sections: [...sectionById.values()],
  };
}


export type LegalArticlePreview = { text: string; anchorId: string };

function excerpt(lines: TranslationSection["lines"], anchorId: string): LegalArticlePreview | null {
  const text = lines.map((line) => `${line.label ? `${line.label} ` : ""}${line.text.trim()}`).filter(Boolean).join("\n");
  if (!text) return null;
  return { text: text.length > 360 ? `${text.slice(0, 360).trimEnd()}…` : text, anchorId };
}

export function findLegalArticlePreview(law: LegalTranslationDocument, citation: string, translationLink?: string): LegalArticlePreview | null {
  const linkedId = translationLink?.match(/#([a-z0-9-]+)$/)?.[1];
  if (linkedId) {
    const linkedSection = law.sections.find((item) => item.id === linkedId);
    if (linkedSection) return excerpt(linkedSection.lines, linkedId);
    const section = law.sections.find((item) => item.lines.some((line) => line.id === linkedId));
    if (!section) return null;
    return excerpt(section.lines.filter((line) => line.id === linkedId || line.id.startsWith(`${linkedId}-`)), linkedId);
  }
  // Supplementary provisions and appendices need their explicit location; do not substitute a main article.
  if (/부칙|별표/.test(citation)) return null;
  const match = citation.match(/제(\d+)조(?:의(\d+))?(?:\s*제(\d+)항)?(?:\s*제(\d+)호)?/);
  if (!match) return null;
  const articleId = `main-a${match[1]}${match[2] ? `-${match[2]}` : ""}`;
  const section = law.sections.find((item) => item.group === "main" && item.id === articleId);
  if (!section) return null;
  if (!match[3] && !match[4]) return excerpt(section.lines, articleId);
  const requestedId = `${articleId}${match[3] ? `-p${match[3]}` : ""}${match[4] ? `-i${match[4]}` : ""}`;
  if (!section.lines.some((line) => line.id === requestedId)) return null;
  return excerpt(section.lines.filter((line) => line.id === requestedId || line.id.startsWith(`${requestedId}-`)), requestedId);
}
