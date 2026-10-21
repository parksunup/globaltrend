import { advance, type State } from "./runtime.ts";
const eq = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  }
};
const config = {
  source: "edpb",
  source_id: "source",
  listing: "https://www.edpb.europa.eu/news_en",
  hosts: ["www.edpb.europa.eu"],
  language: "en",
};
Deno.test("failed detail preserves exact position and range for retry", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-21",
    page: config.listing,
    rows: [{ url: "https://www.edpb.europa.eu/news/x", title: "x" }],
    offset: 0,
  };
  const result = await advance(config, state, {
    request: () => Promise.reject(new Error("http_403")),
  }, async () => {
    throw new Error("unexpected ingest");
  });
  eq(result.state.offset, 0);
  eq(result.state.since, state.since);
  eq(result.result.status, "failed");
  eq(result.continue, true);
});
Deno.test("successful duplicate advances only after ingest and preserves incomplete coverage", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-21",
    page: config.listing,
    rows: [{ url: "https://www.edpb.europa.eu/news/x", title: "x" }],
    offset: 0,
  };
  let stored = 0;
  const html =
    '<h1 class="node-article-full__title">x</h1><time class="node-article-full__date">21 October 2026</time><div class="node-article-full__body">Original complete article body long enough.</div>';
  const result = await advance(config, state, {
    request: async () => ({
      bytes: new TextEncoder().encode(html),
      url: state.rows![0].url,
      type: "text/html",
    }),
  }, async () => {
    stored++;
    return { item_created: false, content_changed: false };
  });
  eq(stored, 1);
  eq(result.state.offset, 1);
  eq(result.result.saved, "duplicate");
  eq(result.result.coverage_complete, false);
});
Deno.test("unknown date is stored unready and remains an explicit incomplete item", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-21",
    page: config.listing,
    rows: [{ url: "https://www.edpb.europa.eu/news/x", title: "x" }],
    offset: 0,
  };
  const html =
    '<h1 class="node-article-full__title">x</h1><div class="node-article-full__body">Original complete article body long enough.</div>';
  const result = await advance(config, state, {
    request: async () => ({
      bytes: new TextEncoder().encode(html),
      url: state.rows![0].url,
      type: "text/html",
    }),
  }, async (item) => {
    eq(item.metadata.ai_ready, false);
    return {};
  });
  eq(result.state.unknown_dates, 1);
  eq(result.result.status, "partial");
});
Deno.test("third non-database detail failure parks a durable retry and lets the source continue", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-21",
    page: config.listing,
    rows: [{ url: "https://www.edpb.europa.eu/news/x", title: "x" }],
    offset: 0,
    failures: 2,
  };
  const step = await advance(config, state, {
    request: () => Promise.reject(new Error("unsupported_document_type")),
  }, async () => ({}));
  eq(step.state.offset, 1);
  eq(step.state.parked?.rows?.[0].url, state.rows![0].url);
  eq(step.result.status, "failed");
});
Deno.test("adapter changes restart discovery in the original range and retain legacy cursor", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-21",
    legacy_cursor: { page: config.listing + "?page=6", offset: 20 },
  };
  let called = "";
  const step = await advance(config, state, {
    request: async (url) => {
      called = url;
      return {
        bytes: new TextEncoder().encode('<main><a href="/news/a">a</a></main>'),
        url,
        type: "text/html",
      };
    },
  }, async () => ({}));
  eq(called, config.listing);
  eq(step.state.legacy_cursor, state.legacy_cursor);
  eq(step.state.since, state.since);
});
Deno.test("text-only press release PDF preserves unread annotation targets", async () => {
  const fixture =
    (await import("./pdf_fixture.json", { with: { type: "json" } })).default;
  const { extractPressReleasePDF } = await import("./runtime.ts");
  const item = await extractPressReleasePDF(
    Uint8Array.from(atob(fixture.base64), (c) => c.charCodeAt(0)),
    {
      url: "https://example.test/synthetic.pdf",
      title: "Synthetic press release",
    },
  );
  eq(item.metadata.read_scope, "press_release_pdf_not_judgment");
  eq(item.metadata.ai_ready, false);
  eq(item.metadata.unread_attachments, [
    "https://example.test/unread-decision",
  ]);
  eq(item.published_date, "2026-10-21");
});
