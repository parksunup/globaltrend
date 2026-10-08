import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import TranslationReview, { type TranslationSection } from "../components/translation-review";
import { submissionPreviewEnabled } from "../../lib/submission-preview";

type Node = {
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
  source?: { original_url?: string; selected_revision_enforcement_date?: string; scope_note?: string };
  translation?: { human_review_status?: string };
  provisions?: Node[];
};

function loadSections(): { corpus: Corpus; sections: TranslationSection[] } | null {
  const path = join(process.cwd(), "data", "legal", "translations", "appi.json");
  if (!existsSync(path)) return null;
  try {
    const corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
    if (!Array.isArray(corpus.provisions)) return null;
    const nodes = corpus.provisions.sort((a, b) => a.source_order - b.source_order);
    const byId = new Map(nodes.map((node) => [node.node_id, node]));
    const supplementary = new Map(nodes.filter((node) => node.tag === "SupplProvision").map((node) => [node.scope, node.korean_title ?? "부칙"]));
    const roots = nodes.filter((node) => node.tag === "Article" || node.tag === "AppdxTable");
    const sectionById = new Map<string, TranslationSection>();
    for (const node of roots) {
      const group = node.tag === "AppdxTable" ? "appendix" : node.scope === "main" ? "main" : "supplementary";
      const title = node.korean_title || (node.tag === "Article" ? `제${node.number}조` : `별표 ${node.number}`);
      sectionById.set(node.node_id, {
        id: node.node_id,
        group,
        title,
        context: group === "supplementary" ? supplementary.get(node.scope) ?? "부칙" : group === "appendix" ? "별표" : "본칙",
        reviewStatus: node.human_review_status ?? "not_started",
        lines: [],
      });
    }
    for (const node of nodes) {
      if (typeof node.korean_text !== "string" || !node.korean_text.trim()) continue;
      let parent = byId.get(node.parent_id ?? "");
      while (parent && !sectionById.has(parent.node_id)) parent = byId.get(parent.parent_id ?? "");
      const section = parent && sectionById.get(parent.node_id);
      if (!section) continue;
      const label = node.tag === "Paragraph" ? `${node.number}항` :
        node.tag === "Item" ? `${node.number}호` :
        node.tag === "Subitem1" ? `${node.number}목` :
        node.tag === "TableColumn" ? "표 셀" : "";
      section.lines.push({ id: node.node_id, label, text: node.korean_text });
    }
    return { corpus, sections: [...sectionById.values()] };
  } catch {
    return null;
  }
}

export default function LegalTranslationPage() {
  const loaded = submissionPreviewEnabled() ? loadSections() : null;
  if (!loaded) return <main style={{ maxWidth: 720, margin: "5rem auto", padding: "0 1.5rem" }}>
    <Link href="/">← 검수 화면</Link>
    <h1>한국어 번역 초안</h1>
    <p>이 배포본에는 검수할 번역 전문이 없습니다. 법제 담당 브랜치의 Preview에서 확인해 주세요.</p>
  </main>;
  const { corpus, sections } = loaded;
  return <TranslationReview
    sections={sections}
    officialName={corpus.official_name ?? "개인정보 보호에 관한 법률"}
    officialUrl={corpus.source?.original_url ?? ""}
    version={corpus.source?.selected_revision_enforcement_date ?? "판본 확인 필요"}
    scopeNote={corpus.source?.scope_note ?? ""}
    reviewStatus={corpus.translation?.human_review_status ?? "not_started"}
    branch={process.env.VERCEL_GIT_COMMIT_REF}
    commitSha={process.env.VERCEL_GIT_COMMIT_SHA}
  />;
}
