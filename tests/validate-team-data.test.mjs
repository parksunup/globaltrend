import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  validateLegalData,
  validateTeamData,
  validateTrendData,
} from "../scripts/validate-team-data.mjs";

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "globaltrend-data-"));
  await mkdir(path.join(root, "data", "legal"), { recursive: true });
  await mkdir(path.join(root, "data", "trends", "source-configs"), { recursive: true });
  return root;
}

async function put(root, relativePath, contents) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, contents, "utf8");
}

const legalHeader = [
  "record_id",
  "jurisdiction_code",
  "short_name",
  "official_name",
  "official_url",
  "version_label",
  "effective_date",
  "korean_translation_status",
  "korean_translation_source_url",
  "reuse_status",
  "review_status",
].join(",");

const validLegalRow = [
  "jp-appi",
  "JP",
  "APPI",
  "Act on the Protection of Personal Information",
  "https://example.invalid/appi",
  "검토 필요",
  "",
  "unreviewed",
  "",
  "unreviewed",
  "unreviewed",
].join(",");

const validTrend = {
  record_id: "edpb-news",
  organization: "EDPB",
  start_url: "https://example.invalid/edpb",
  document_types: ["news"],
  collection_method: "html",
  field_locations: {
    title: "검토 필요",
    published_at: "검토 필요",
    content: "검토 필요",
  },
  exclude_rules: [],
  terms_status: "unreviewed",
  sample_urls: ["https://example.invalid/edpb/sample"],
  review_status: "unreviewed",
};

test("템플릿 파일만 있는 초기 상태는 통과한다", async () => {
  const root = await workspace();
  await put(root, "data/legal/instruments.template.csv", legalHeader);
  await put(root, "data/trends/source-configs/source.template.json", JSON.stringify(validTrend));

  assert.deepEqual(await validateTeamData(root), []);
});

test("법제 결과의 Markdown 또는 검토 메모가 빠지면 실패한다", async () => {
  const root = await workspace();
  await put(root, "data/legal/instruments.csv", `${legalHeader}\n${validLegalRow}\n`);

  const errors = await validateLegalData(root);

  assert.ok(errors.some((error) => error.includes("instruments.md")));
  assert.ok(errors.some((error) => error.includes("review-notes.md")));
});

test("법제 CSV의 필수 열과 값이 빠지면 실패한다", async () => {
  const root = await workspace();
  await put(root, "data/legal/instruments.md", "# 법제 목록\n");
  await put(root, "data/legal/review-notes.md", "# 검토 메모\n");
  await put(root, "data/legal/instruments.csv", "record_id,official_url,review_status\n,https://example.invalid,unreviewed\n");

  const errors = await validateLegalData(root);

  assert.ok(errors.some((error) => error.includes("필수 열")));
  assert.ok(errors.some((error) => error.includes("record_id")));
});

test("법제 CSV의 중복 ID, HTTP URL과 잘못된 상태를 거부한다", async () => {
  const root = await workspace();
  await put(root, "data/legal/instruments.md", "# 법제 목록\n");
  await put(root, "data/legal/review-notes.md", "# 검토 메모\n");
  const badRow = validLegalRow
    .replace("https://example.invalid/appi", "http://example.invalid/appi")
    .replace(/unreviewed$/, "done");
  await put(root, "data/legal/instruments.csv", `${legalHeader}\n${badRow}\n${badRow}\n`);

  const errors = await validateLegalData(root);

  assert.ok(errors.some((error) => error.includes("중복 record_id")));
  assert.ok(errors.some((error) => error.includes("https://")));
  assert.ok(errors.some((error) => error.includes("review_status")));
});

test("법제 Markdown에 CSV의 record_id가 없으면 실패한다", async () => {
  const root = await workspace();
  await put(root, "data/legal/instruments.md", "# 법제 목록\n\n| ID | 법률 |\n| --- | --- |\n| other-law | 다른 법률 |\n");
  await put(root, "data/legal/review-notes.md", "# 검토 메모\n");
  await put(root, "data/legal/instruments.csv", `${legalHeader}\n${validLegalRow}\n`);

  const errors = await validateLegalData(root);

  assert.ok(errors.some((error) => error.includes("jp-appi") && error.includes("Markdown")));
});

test("동향 JSON의 Markdown 짝과 공통 검토 메모가 빠지면 실패한다", async () => {
  const root = await workspace();
  await put(root, "data/trends/source-configs/edpb.json", JSON.stringify(validTrend));

  const errors = await validateTrendData(root);

  assert.ok(errors.some((error) => error.includes("edpb.md")));
  assert.ok(errors.some((error) => error.includes("review-notes.md")));
});

test("동향 JSON의 필수 필드, URL과 상태를 검사한다", async () => {
  const root = await workspace();
  await put(root, "data/trends/source-configs/edpb.md", "# EDPB\n");
  await put(root, "data/trends/review-notes.md", "# 검토 메모\n");
  await put(root, "data/trends/source-configs/edpb.json", JSON.stringify({
    ...validTrend,
    organization: "",
    start_url: "http://example.invalid/edpb",
    terms_status: "done",
  }));

  const errors = await validateTrendData(root);

  assert.ok(errors.some((error) => error.includes("organization")));
  assert.ok(errors.some((error) => error.includes("https://")));
  assert.ok(errors.some((error) => error.includes("terms_status")));
});

test("동향 JSON 사이에서 중복 ID를 거부한다", async () => {
  const root = await workspace();
  await put(root, "data/trends/review-notes.md", "# 검토 메모\n");
  for (const name of ["edpb", "oecd"]) {
    await put(root, `data/trends/source-configs/${name}.md`, `# ${name}\n`);
    await put(root, `data/trends/source-configs/${name}.json`, JSON.stringify(validTrend));
  }

  const errors = await validateTrendData(root);

  assert.ok(errors.some((error) => error.includes("중복 record_id")));
});

test("동향 Markdown에 JSON의 record_id가 없으면 실패한다", async () => {
  const root = await workspace();
  await put(root, "data/trends/review-notes.md", "# 검토 메모\n");
  await put(root, "data/trends/source-configs/edpb.md", "# EDPB\n\n- ID: `other-source`\n");
  await put(root, "data/trends/source-configs/edpb.json", JSON.stringify(validTrend));

  const errors = await validateTrendData(root);

  assert.ok(errors.some((error) => error.includes("edpb-news") && error.includes("Markdown")));
});
