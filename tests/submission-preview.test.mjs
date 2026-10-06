import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { loadSubmissionPreview } from "../lib/submission-preview.ts";

const root = join(import.meta.dirname, "fixtures", "submission-preview");

test("PR branch deliverables are visible without a database import", () => {
  const items = loadSubmissionPreview(root);
  assert.equal(items.length, 5);
  assert.equal(items.filter((item) => item.group === "legal").length, 2);
  assert.equal(items.filter((item) => item.group === "trends").length, 3);
  assert.equal(items.find((item) => item.id === "legal-jp-appi")?.subtitle, "Act on the Protection of Personal Information, Japan");
  assert.equal(items.find((item) => item.id === "fixture-edpb-edpb-example")?.summary, "한국어 요약");
  assert.equal(items.find((item) => item.id === "weekly-sample")?.status, "draft");
  assert.equal(items.find((item) => item.id === "legal-appi-translation")?.fields.find((field) => field.label === "원문 확보")?.value, "false");
  assert.match(items.find((item) => item.id === "legal-appi-translation")?.summary ?? "", /58\/185조/);
});

test("missing submitted files do not create fake entries", () => {
  assert.deepEqual(loadSubmissionPreview(join(import.meta.dirname, "fixtures", "missing")), []);
});
