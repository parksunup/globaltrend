import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LegalTranslationDocument } from "./legal-translation-review";
import type { SubmissionItem } from "./submission-preview";

type OfficialPipa = {
  title: string;
  jurisdiction: string;
  version: string;
  versionLabel: string;
  officialUrl: string;
  scopeNote: string;
  sections: { id: string; group: "main" | "supplementary"; title: string; lines: string[] }[];
};

export function loadOfficialPipa(root = process.cwd()): LegalTranslationDocument {
  const source = readFileSync(join(root, "data", "legal", "official", "pipa-20260911.json"), "utf8");
  const data = JSON.parse(source) as OfficialPipa;
  return {
    id: "pipa",
    jurisdiction: "KR",
    title: data.title,
    officialName: data.title,
    version: data.version,
    reviewStatus: "official",
    articleCount: data.sections.filter((section) => section.group === "main").length,
    officialUrl: data.officialUrl,
    scopeNote: `${data.versionLabel}. ${data.scopeNote}`,
    sections: data.sections.map((section) => ({
      id: section.id,
      group: section.group,
      title: section.title,
      context: `공식 한국어 원문 · ${section.group === "main" ? "본칙" : "부칙"}`,
      reviewStatus: "official",
      lines: section.lines.map((text, index) => ({
        id: `${section.id}-line-${index + 1}`,
        label: "",
        text: index === 0 && text.startsWith(section.title) ? text.slice(section.title.length).trim() : text,
      })),
    })),
  };
}

export function officialPipaInstrument(law: LegalTranslationDocument): SubmissionItem {
  return {
    id: "legal-kr-pipa",
    group: "legal",
    kind: "법제 목록",
    title: law.title,
    subtitle: "대한민국 · 국가법령정보센터 공식 원문",
    summary: law.scopeNote,
    status: "published",
    fields: [{ label: "관할권", value: "KR" }],
    links: [{ label: "공식 원문", url: law.officialUrl }],
    files: ["data/legal/official/pipa-20260911.json"],
  };
}
