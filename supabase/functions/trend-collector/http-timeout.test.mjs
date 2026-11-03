import test from "node:test";
import assert from "node:assert/strict";
import { requestTimeoutMs } from "./http-timeout.mjs";

test("CNIL request deadline is 30 seconds", () => {
  assert.equal(requestTimeoutMs("https://www.cnil.fr/fr/actualites"), 30_000);
});

test("other source hosts keep the 15-second request deadline", () => {
  for (const url of [
    "https://www.ftc.gov/news-events/news/",
    "https://ico.org.uk/news/",
    "https://www.cnil.fr.evil.example/news/",
  ]) {
    assert.equal(requestTimeoutMs(url), 15_000, url);
  }
});
