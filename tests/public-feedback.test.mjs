import test from "node:test";
import assert from "node:assert/strict";
import { FeedbackQueryError, parseFeedbackQuery } from "../lib/public-feedback.ts";

test("feedback queries retain the exact branch and item across old commits", () => {
  const result = parseFeedbackQuery(new URLSearchParams({ branch: "feat/trend-source-contracts", item: "trend-CNIL-EXTIA", commit: "old" }));
  assert.deepEqual(result, { branch: "feat/trend-source-contracts", item: "trend-CNIL-EXTIA", offset: 0, limit: 100 });
});
test("empty optional item queries read the whole branch", () => {
  assert.equal(parseFeedbackQuery(new URLSearchParams({ branch: "feat/legal-corpus-foundation", item: "" })).item, undefined);
});
test("feedback pagination is bounded and does not accept malformed offsets", () => {
  for (const params of [{ offset: "-1" }, { offset: "1.5" }, { limit: "0" }, { limit: "201" }, { offset: "1000001" }]) {
    assert.throws(() => parseFeedbackQuery(new URLSearchParams({ branch: "main", ...params })), FeedbackQueryError);
  }
  assert.equal(parseFeedbackQuery(new URLSearchParams({ branch: "main", limit: "200", offset: "200" })).offset, 200);
});
test("feedback cannot accidentally list every branch or accept invalid branch names", () => {
  for (const branch of ["", "feat/trend source", "main\nother"]) {
    assert.throws(() => parseFeedbackQuery(new URLSearchParams({ branch })), FeedbackQueryError);
  }
});
