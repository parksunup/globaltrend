import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const jurisdictions = ["JP", "CN", "EU", "UK", "US-CA", "SG"];
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const normalizeHeading = (value) => value
  .replace(/^#{1,6}\s+/, "")
  .replace(/[*_`]/g, "")
  .trim()
  .normalize("NFC");

let questionTotal = 0;
let coverageNotes = 0;
const failures = [];

for (const code of jurisdictions) {
  const questionPath = path.join(root, "data", "business-readiness", "questions", `${code}.json`);
  const mappingPath = path.join(root, "docs", "business-advisor", "guides", "ko", "question-guide-references", `${code}.json`);
  const bank = await readJson(questionPath);
  const mapping = await readJson(mappingPath);
  const guidePath = path.resolve(root, mapping.guidePath);

  if (mapping.jurisdiction !== code) failures.push(`${code}: jurisdiction metadata mismatch`);
  if (!guidePath.startsWith(path.join(root, "docs", "business-advisor", "guides"))) failures.push(`${code}: guidePath escapes guide directory`);
  if (!mapping.mappingBasis?.trim()) failures.push(`${code}: mappingBasis is missing`);

  const guide = await readFile(guidePath, "utf8");
  const headings = new Set(guide.split(/\r?\n/).filter((line) => /^#{1,6}\s+/.test(line)).map(normalizeHeading));
  const sections = new Map();
  for (const section of mapping.sections ?? []) {
    if (sections.has(section.id)) failures.push(`${code}: duplicate section id ${section.id}`);
    sections.set(section.id, section);
    if (!headings.has(normalizeHeading(section.title))) failures.push(`${code}: section ${section.id} title is not an actual guide heading: ${section.title}`);
  }

  const questionIds = new Set();
  const bankById = new Map((bank.questions ?? []).map((item) => [item.id, item]));
  for (const item of mapping.questions ?? []) {
    if (questionIds.has(item.questionId)) failures.push(`${code}: duplicate question mapping ${item.questionId}`);
    questionIds.add(item.questionId);
    const source = bankById.get(item.questionId);
    if (!source) failures.push(`${code}: mapping refers to unknown question ${item.questionId}`);
    else if (source.sourceNote !== item.sourceNote) failures.push(`${code}: sourceNote mismatch for ${item.questionId}`);
    const referenced = item.sectionIds ?? [];
    if (!referenced.length && !item.unmappedReason?.trim()) failures.push(`${code}: ${item.questionId} has no guide section or unmappedReason`);
    for (const id of referenced) if (!sections.has(id)) failures.push(`${code}: ${item.questionId} refers to missing section ${id}`);
    if (item.coverageNote || item.unmappedReason) coverageNotes += 1;
  }

  for (const id of bankById.keys()) if (!questionIds.has(id)) failures.push(`${code}: question has no mapping ${id}`);
  for (const id of questionIds) if (!bankById.has(id)) failures.push(`${code}: mapping has no question ${id}`);
  if ((mapping.questions ?? []).length !== bankById.size) failures.push(`${code}: count mismatch; bank=${bankById.size}, mapping=${mapping.questions?.length ?? 0}`);
  questionTotal += bankById.size;
  console.log(`${code}: ${bankById.size} questions mapped, ${mapping.sections?.length ?? 0} real guide headings, ${(mapping.questions ?? []).filter((item) => item.coverageNote || item.unmappedReason).length} coverage notes`);
}

if (failures.length) {
  console.error(`Guide mapping validation failed (${failures.length} issue(s)):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${questionTotal} questions across ${jurisdictions.length} jurisdictions; ${coverageNotes} coverage/unmapped notes preserved.`);
}
