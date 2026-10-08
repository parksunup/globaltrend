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
  official_name?: string;
  korean_title?: string;
  source?: { original_url?: string; selected_revision_enforcement_date?: string; scope_note?: string };
  translation?: { human_review_status?: string; language?: string };
  provisions?: Provision[];
};

export type LegalTranslationSummary = {
  id: string;
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

function readCorpus(root: string, id: string): Corpus | null {
  if (!validId.test(id)) return null;
  const path = join(translationsDir(root), `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as Corpus;
    return Array.isArray(data.provisions) && data.provisions.every((node) =>
      typeof node.node_id === "string" && typeof node.tag === "string" && typeof node.source_order === "number"
    ) ? data : null;
  } catch {
    return null;
  }
}

function summary(id: string, corpus: Corpus): LegalTranslationSummary {
  const provisions = corpus.provisions ?? [];
  return {
    id,
    title: corpus.korean_title?.trim() || `${id.toUpperCase()} 한국어 번역 초안`,
    officialName: corpus.official_name?.trim() || id.toUpperCase(),
    version: corpus.source?.selected_revision_enforcement_date || "판본 확인 필요",
    reviewStatus: corpus.translation?.human_review_status || "검토 필요",
    articleCount: provisions.filter((node) => node.tag === "Article").length,
  };
}

export function listLegalTranslations(root = process.cwd()): LegalTranslationSummary[] {
  const dir = translationsDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && validId.test(name.slice(0, -5)))
    .flatMap((name) => {
      const id = name.slice(0, -5);
      const corpus = readCorpus(root, id);
      return corpus ? [summary(id, corpus)] : [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function loadLegalTranslation(id: string, root = process.cwd()): LegalTranslationDocument | null {
  const corpus = readCorpus(root, id);
  if (!corpus) return null;
  const nodes = [...corpus.provisions!].sort((a, b) => a.source_order - b.source_order);
  const byId = new Map(nodes.map((node) => [node.node_id, node]));
  const supplementary = new Map(nodes.filter((node) => node.tag === "SupplProvision").map((node) => [node.scope, node.korean_title ?? "부칙"]));
  const roots = nodes.filter((node) => ["Article", "AppdxTable", "SupplProvision"].includes(node.tag));
  const sectionById = new Map<string, TranslationSection>();
  for (const node of roots) {
    const group = node.tag === "AppdxTable" ? "appendix" : node.tag === "SupplProvision" || node.scope !== "main" ? "supplementary" : "main";
    sectionById.set(node.node_id, {
      id: node.node_id,
      group,
      title: node.korean_title || (node.tag === "Article" ? `제${node.number}조` : node.tag === "AppdxTable" ? `별표 ${node.number}` : "부칙"),
      context: group === "supplementary" ? supplementary.get(node.scope) ?? "부칙" : group === "appendix" ? "별표" : "본칙",
      reviewStatus: node.human_review_status ?? "not_started",
      lines: [],
    });
  }
  for (const node of nodes) {
    if (typeof node.korean_text !== "string" || !node.korean_text.trim()) continue;
    let parent = byId.get(node.parent_id ?? "");
    while (parent && !sectionById.has(parent.node_id)) parent = byId.get(parent.parent_id ?? "");
    let section = parent && sectionById.get(parent.node_id);
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
