import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { loadPublicSearchCorpus } from "../unified-search-data";

export type AdvisorSource = {
  id: string;
  title: string;
  text: string;
  kind: "trend" | "law" | "comparison" | "guide" | "casebook" | "assessment";
  jurisdiction: string;
  url: string;
  officialUrl: string;
  version: string;
};

export type AdvisorEvidence = AdvisorSource & { excerpt: string; score: number };

const repoRoot = process.cwd();
const staticDirectory = (...parts: string[]) => path.join(repoRoot, ...parts);
const guideTitles: Record<string, string> = {
  "japan-appi-guide.md": "일본 APPI 기업용 개인정보 보호 안내서",
  "china-pipl-guide.md": "중국 PIPL 기업용 개인정보 보호 안내서",
  "eu-gdpr-guide.md": "EU GDPR 기업용 개인정보 보호 안내서",
  "uk-data-protection-guide.md": "영국 UK GDPR 기업용 개인정보 보호 안내서",
  "california-ccpa-guide.md": "캘리포니아 CCPA/CPRA 기업용 개인정보 보호 안내서",
  "singapore-pdpa-guide.md": "싱가포르 PDPA 기업용 개인정보 보호 안내서",
};
const jurisdictionNames: Record<string, string> = {
  JP: "일본", CN: "중국", EU: "유럽연합", GB: "영국", UK: "영국",
  "US-CA": "미국 캘리포니아주", SG: "싱가포르", KR: "한국",
};
const originalUrls: Record<string, string> = {
  "japan-appi-guide.md": "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/",
  "china-pipl-guide.md": "https://www.cac.gov.cn/2025-02/14/c_1741233507681519.htm",
  "eu-gdpr-guide.md": "https://www.edpb.europa.eu/sme_en",
  "uk-data-protection-guide.md": "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/",
  "california-ccpa-guide.md": "https://cppa.ca.gov/regulations/",
  "singapore-pdpa-guide.md": "https://www.pdpc.gov.sg/guidelines-and-consultation",
};

function cleanMarkdown(value: string): string {
  return value.replace(/\r/g, "").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)").trim();
}

async function staticSources(): Promise<AdvisorSource[]> {
  const sources: AdvisorSource[] = [];
  const guidesDir = staticDirectory("docs", "business-advisor", "guides");
  for (const name of Object.keys(guideTitles)) {
    const text = cleanMarkdown(await readFile(path.join(guidesDir, name), "utf8"));
    sources.push({ id: `guide:${name}`, title: guideTitles[name], text, kind: "guide", jurisdiction: jurisdictionNames[name.startsWith("japan") ? "JP" : name.startsWith("china") ? "CN" : name.startsWith("eu-") ? "EU" : name.startsWith("uk-") ? "UK" : name.startsWith("california") ? "US-CA" : "SG"], url: `/public/business-readiness#${encodeURIComponent(name)}`, officialUrl: originalUrls[name], version: "저장소 학습본·원문 기준일은 안내서에 표시" });
  }

  const referencesDir = staticDirectory("docs", "business-advisor", "references");
  const referenceNames = await readdir(referencesDir);
  const markdownReferences = referenceNames.filter(item => item.toLowerCase().endsWith(".md"));
  const requiredReferences = [/상담사례집.*\.md$/i, /중국.*가이드북.*\.md$/i, /eu.*gdpr.*\.md$/i];
  if (requiredReferences.some(pattern => !markdownReferences.some(name => pattern.test(name)))) throw new Error("사용자 제공 상담사례집·중국 안내서·EU 안내서의 PDF 변환본을 모두 찾지 못했습니다.");
  for (const name of markdownReferences) {
    const text = cleanMarkdown(await readFile(path.join(referencesDir, name), "utf8"));
    const casebook = /상담사례집/.test(name);
    const china = /중국/.test(name);
    sources.push({
      id: `reference:${name}`,
      title: casebook ? "2023 해외 개인정보보호 법률 상담사례집 (PDF 변환본)" : china ? "우리 기업을 위한 중국 개인정보 규제대응 가이드북 (2023, PDF 변환본)" : "우리 기업을 위한 EU GDPR 가이드북 (2022.12 개정, PDF 변환본)",
      text,
      kind: casebook ? "casebook" : "guide",
      jurisdiction: casebook ? "다국가" : china ? "중국" : "유럽연합",
      url: "",
      officialUrl: "",
      version: "사용자 제공 PDF 변환본",
    });
  }

  const questionDir = staticDirectory("data", "business-readiness", "questions");
  const questionFiles = (await readdir(questionDir)).filter(name => name.endsWith(".json"));
  const presentQuestionBanks = new Set(questionFiles.map(name => name.replace(/\.json$/i, "")));
  for (const code of ["JP", "CN", "EU", "UK", "US-CA", "SG"]) if (!presentQuestionBanks.has(code)) throw new Error(`자가점검 질문은행 ${code} 파일을 찾지 못했습니다.`);
  for (const name of questionFiles) {
    const parsed = JSON.parse(await readFile(path.join(questionDir, name), "utf8")) as {
      jurisdiction?: string;
      questions?: Array<{ id: string; category: string; question: string; helpText: string; sourceNote: string; sourceUrl?: string }>;
    };
    const code = name.replace(/\.json$/i, "");
    const text = (parsed.questions ?? []).map(item => [
      `${item.id} · ${item.category}: ${item.question}`,
      item.helpText,
      `근거 메모: ${item.sourceNote}`,
      item.sourceUrl ? `공식 안내: ${item.sourceUrl}` : "",
    ].filter(Boolean).join("\n")).join("\n\n");
    sources.push({ id: `assessment:${code}`, title: `${jurisdictionNames[code] ?? code} 기업용 자가점검 질문은행`, text, kind: "assessment", jurisdiction: jurisdictionNames[code] ?? code, url: "/public/business-readiness", officialUrl: "", version: "질문은행 2026-11" });
  }
  const crosswalkPath = staticDirectory("docs", "jurisdiction-specific-self-assessments-2026-11.md");
  sources.push({ id: "assessment:crosswalk", title: "관할별 자가점검 질문은행과 설계 기준", text: cleanMarkdown(await readFile(crosswalkPath, "utf8")), kind: "assessment", jurisdiction: "다국가", url: "/public/business-readiness", officialUrl: "", version: "2026-11" });
  return sources;
}

async function publicSources(): Promise<{ sources: AdvisorSource[]; status: { publicContent: boolean; publicContentError?: string } }> {
  try {
    const result = await loadPublicSearchCorpus();
    const sources = result.documents.map(document => {
      const kind: AdvisorSource["kind"] = document.kind === "trend" ? "trend" : document.kind === "comparison" ? "comparison" : "law";
      return {
        id: document.id,
        title: document.title,
        text: document.text,
        kind,
        jurisdiction: (document.jurisdictions ?? []).map(code => jurisdictionNames[code] ?? code).join(" · ") || "관할 확인 필요",
        url: document.url,
        officialUrl: document.sourceUrl || "",
        version: document.version || document.date || "",
      } satisfies AdvisorSource;
    });
    return { sources, status: { publicContent: result.sources.trends && result.sources.laws } };
  } catch (error) {
    return { sources: [], status: { publicContent: false, publicContentError: error instanceof Error ? error.message : "공개 자료 저장소에 연결하지 못했습니다." } };
  }
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function words(value: string): string[] {
  const result = new Set<string>();
  for (const word of normalize(value).split(/\s+/).filter(Boolean)) {
    if (word.length > 1) result.add(word);
    if (/^[가-힣]+$/.test(word) && word.length >= 3) {
      for (let i = 0; i < word.length - 1; i += 1) result.add(word.slice(i, i + 2));
    }
  }
  return [...result];
}

function splitPassages(source: AdvisorSource): AdvisorEvidence[] {
  const sections = source.text.split(/\n(?=#{1,6} |\*\*|Page \d|쪽\s*\d)/g);
  const chunks: string[] = [];
  for (const section of sections) {
    const paragraphs = section.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
    let current = "";
    for (const paragraph of paragraphs) {
      if (paragraph.length > 2200) {
        if (current) chunks.push(current), current = "";
        for (let offset = 0; offset < paragraph.length; offset += 1900) chunks.push(paragraph.slice(offset, offset + 2200));
      } else if (!current || current.length + paragraph.length < 2200) {
        current = current ? `${current}\n\n${paragraph}` : paragraph;
      } else {
        chunks.push(current);
        current = paragraph;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks.map((excerpt, index) => ({ ...source, id: `${source.id}#${index + 1}`, excerpt, score: 0 }));
}

let cachedStatic: Promise<AdvisorSource[]> | undefined;
export async function retrieveAdvisorEvidence(question: string, history: Array<{ role: "user" | "assistant"; content: string }> = [], assessmentContext = "") {
  cachedStatic ??= staticSources();
  const [statics, published] = await Promise.all([cachedStatic, publicSources()]);
  const documents = [...statics, ...published.sources];
  const query = [...history.map(item => item.content), assessmentContext, question].filter(Boolean).join("\n");
  const queryWords = words(query);
  const ranked = documents.flatMap(splitPassages).map(item => {
    const title = normalize(item.title);
    const text = normalize(item.excerpt);
    const score = queryWords.reduce((total, term) => total + (title.includes(term) ? 5 : 0) + (text.includes(term) ? 1 : 0), 0);
    return { ...item, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const distinct = new Map<string, AdvisorEvidence>();
  const perSource = new Map<string, number>();
  for (const item of ranked) {
    const sourceId = item.id.split("#")[0];
    const used = perSource.get(sourceId) ?? 0;
    if (used >= 2) continue;
    distinct.set(item.id, item);
    perSource.set(sourceId, used + 1);
    if (distinct.size >= 18) break;
  }
  const evidence = [...distinct.values()];
  return {
    query: question,
    evidence,
    notice: evidence.length
      ? "국제요정의 자가점검·기업 안내서·상담사례·공개 동향·법제 자료에서 대화에 관련된 부분을 찾았습니다. 아래 답변은 이 자료와 가능한 경우 웹 검색 결과를 함께 참고합니다."
      : "국제요정 자료에서 바로 연결되는 대목을 찾지 못했습니다. 질문을 그대로 답하기 위해 웹 검색을 함께 요청합니다. 검색으로도 근거가 부족하면 확인이 더 필요한 점을 밝히도록 합니다.",
    corpus: {
      staticMaterials: statics.length,
      publishedMaterials: published.sources.length,
      publicContentAvailable: published.status.publicContent,
      ...(published.status.publicContentError ? { publicContentError: published.status.publicContentError } : {}),
    },
  };
}
