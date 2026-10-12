import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSubmittedSources, loadSubmittedStories, publicSubmissionPreviewEnabled } from "../lib/public-submission-preview.ts";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../lib/submission-preview.ts";
import { listLegalTranslations } from "../lib/legal-translation-review.ts";

test("integration Preview reads every submitted source and sample", () => {
  const stories = loadSubmittedStories();
  const sources = loadSubmittedSources();
  assert.equal(sources.length, 9);
  assert.equal(stories.length, 21);
  assert.equal(new Set(stories.map((story) => story.id)).size, 21);
  assert.ok(stories.every((story) => story.officialUrl.startsWith("https://")));
  assert.ok(sources.every((source) => source.sampleCount > 0));
});

test("integration Preview reads legal inventory, comparison and full translation", () => {
  const instruments = loadSubmissionPreview().filter((item) => item.kind === "법제 목록");
  const cells = loadSubmissionDocuments().legal;
  const translations = listLegalTranslations();
  assert.equal(instruments.length, 7);
  assert.equal(cells.length, 119);
  assert.equal(new Set(cells.map((cell) => cell.criterionId)).size, 17);
  assert.equal(translations.find((law) => law.id === "appi")?.jurisdiction, "JP");
  assert.equal(translations.find((law) => law.id === "appi")?.articleCount, 250);
});

test("unreviewed submissions are enabled only on the isolated Preview branch", () => {
  const oldEnv = process.env.VERCEL_ENV;
  const oldRef = process.env.VERCEL_GIT_COMMIT_REF;
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "codex/public-integration-preview";
    assert.equal(publicSubmissionPreviewEnabled(), true);
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    assert.equal(publicSubmissionPreviewEnabled(), false);
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_GIT_COMMIT_REF = "codex/public-integration-preview";
    assert.equal(publicSubmissionPreviewEnabled(), false);
  } finally {
    if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
    if (oldRef === undefined) delete process.env.VERCEL_GIT_COMMIT_REF; else process.env.VERCEL_GIT_COMMIT_REF = oldRef;
  }
});
