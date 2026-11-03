import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/build-pipa-official.mjs <official HTML file>");

const html = readFileSync(source, "utf8");
const officialUrl = "https://law.go.kr/LSW/lsInfoR.do?chrClsCd=010202&efYd=20260911&lsiSeq=283839";
const decode = (value) => value.replace(/&(#x[\da-f]+|#\d+|nbsp|lt|gt|amp|quot|apos);/gi, (_, entity) => {
  if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
  return { nbsp: " ", lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[entity.toLowerCase()] ?? `&${entity};`;
});
const plain = (value) => decode(value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " "))
  .replace(/[\t\u00a0 ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

if (!html.includes("[시행 2026. 9. 11.] [법률 제21445호")) throw new Error("The official page does not match the selected PIPA edition");
const sections = [];
for (const match of html.matchAll(/<p\s+class="(pty1_[^"]+)"[^>]*>([\s\S]*?)<\/p>/g)) {
  const [, cssClass, body] = match;
  const text = plain(body);
  if (!text) continue;
  if (cssClass === "pty1_p4") {
    const heading = text.match(/^(제\d+조(?:의\d+)?)(?:\(([^)]*)\))?/);
    if (!heading) throw new Error(`Unrecognized article heading: ${text.slice(0, 60)}`);
    sections.push({ id: `pipa-${heading[1]}`, group: "main", title: `${heading[1]}${heading[2] ? `(${heading[2]})` : ""}`, lines: [text] });
  } else if (sections.length) {
    sections.at(-1).lines.push(text);
  }
}
if (sections.length < 120 || sections[0]?.title !== "제1조(목적)" || !sections.some((section) => section.title.startsWith("제75조"))) {
  throw new Error("PIPA article extraction is incomplete");
}
let supplement = null;
for (const match of html.matchAll(/<p\s+class="(pty3(?:_dep[12])?)"[^>]*>([\s\S]*?)<\/p>/g)) {
  const [, cssClass, body] = match;
  const text = plain(body);
  if (!text) continue;
  if (cssClass === "pty3") {
    supplement = { id: `pipa-suppl-${sections.filter((section) => section.group === "supplementary").length + 1}`, group: "supplementary", title: text, lines: [] };
    sections.push(supplement);
  } else if (supplement) {
    supplement.lines.push(text);
  }
}
if (sections.filter((section) => section.group === "supplementary").length < 10) throw new Error("PIPA supplementary provisions are incomplete");
const output = {
  title: "개인정보 보호법",
  jurisdiction: "KR",
  version: "2026-09-11",
  versionLabel: "법률 제21445호, 2026. 3. 10. 일부개정 · 2026. 9. 11. 시행",
  officialUrl,
  sourceSha256: createHash("sha256").update(readFileSync(source)).digest("hex"),
  scopeNote: "국가법령정보센터의 2026. 9. 11. 시행 판본 본칙과 부칙입니다. 본칙 조문 표제 수에는 삭제 조문도 포함됩니다. 이후 시행되는 개정규정과 최신 개정 여부는 공식 원문에서 확인해 주세요.",
  sections,
};
writeFileSync(resolve("data/legal/official/pipa-20260911.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Extracted ${sections.length} PIPA articles from the official HTML`);
