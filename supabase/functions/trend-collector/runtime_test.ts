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

Deno.test("exhausted listing reports a finished scan separately from period coverage", async () => {
  const state: State = {
    since: "2026-10-16",
    until: "2026-10-23",
    adapter_version: "edge-v2",
    page: config.listing,
    rows: [],
    offset: 0,
    next: null,
    unknown_dates: 3,
  };
  const step = await advance(config, state, {
    request: () => Promise.reject(new Error("unexpected network")),
  }, async () => {
    throw new Error("unexpected ingest");
  });
  eq(step.result.listing_scan_complete, true);
  eq(step.result.coverage_complete, false);
  eq(step.result.unresolved_date_count, 3);
  eq(step.result.coverage_blockers, [
    "listing_exhaustiveness_unverified",
    "unknown_publication_dates",
  ]);
  eq(step.continue, false);
});

Deno.test("ICO restarts an unfiltered cursor in its period and validates full pages", async () => {
  const c = { ...config, source: "ico", listing: "https://ico.org.uk/news/", hosts: ["ico.org.uk"] };
  for (const size of [20, 0, 25]) {
    const state: State = { since: "2026-09-21", until: "2026-10-23", page: c.listing + "?page=13" };
    let payload: {pageNumber: number; filters: unknown} | undefined;
    const step = await advance(c, state, { request: async (url, method, body) => {
      if (method === "POST") {
        payload = JSON.parse(body!);
        return { bytes: new TextEncoder().encode(JSON.stringify({ results: Array.from({ length: size }, (_, i) => ({ url: `/news/${i}`, title: "A" })), pagination: { showingPageNumber: 1, totalPages: 17, hasMore: true, perPage: 25, totalResults: 421 } })), url, type: "application/json" };
      }
      return { bytes: new TextEncoder().encode('<div id="filter-page-container" data-node-id="2816"></div><select id="filter-page-order"><option selected value="newest">Latest</option></select>'), url, type: "text/html" };
    } }, async () => { throw new Error("unexpected ingest"); });
    eq(payload!.pageNumber, 1);
    eq(payload!.filters, [{ key: "from", values: [state.since] }, { key: "to", values: [state.until] }]);
    eq(step.result.coverage_complete, false);
    eq(step.state.page, c.listing + "?from=2026-09-21&to=2026-10-23");
    if (size < 25) eq(step.result.reason, "ico_listing_page_incomplete");
    else {
      eq(step.result.discovered, 25);
      eq(step.state.next, c.listing + "?from=2026-09-21&to=2026-10-23&page=2");
    }
  }
});

Deno.test("ICO keeps a scoped detail cursor and unresolved counters when resuming", async () => {
  const c = { ...config, source: "ico", listing: "https://ico.org.uk/news/", hosts: ["ico.org.uk"] };
  const state: State = { since: "2026-09-21", until: "2026-10-23", adapter_version: "edge-v2",
    page: c.listing + "?from=2026-09-21&to=2026-10-23&page=2",
    rows: [{ url: "https://ico.org.uk/news/a/", title: "A" }], offset: 0,
    unknown_dates: 4, failures: 1 };
  let requested = "";
  const step = await advance(c, state, { request: (url) => {
    requested = url;
    return Promise.reject(new Error("http_503"));
  } }, async () => { throw new Error("unexpected ingest"); });
  eq(requested, "https://ico.org.uk/news/a/");
  eq(step.state.offset, 0);
  eq(step.state.unknown_dates, 4);
  eq(step.state.failures, 2);
  eq(step.result.coverage_complete, false);
});
const cnilConfig = {
  ...config,
  source: "cnil",
  listing: "https://www.cnil.fr/fr/actualites",
  hosts: ["www.cnil.fr"],
};
const cnilOldRow = {
  url: "https://www.cnil.fr/fr/old",
  title: "Old",
  date_observations: [{
    meaning: "listing_published_display",
    locator: "listing .list-inner .attributes p.date",
    value: "27 mars 2024",
  }],
};
Deno.test("CNIL excludes old cards without detail reads and preserves pagination and backlog", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-23",
    adapter_version: "edge-cnil-v3",
    page: cnilConfig.listing,
    legacy_cursor: { page: cnilConfig.listing + "?page=15", offset: 0 },
    rows: [cnilOldRow],
    offset: 0,
    next: cnilConfig.listing + "?page=1",
    unknown_dates: 2,
  };
  const http = { request: () => Promise.reject(new Error("http_403")) };
  const step = await advance(cnilConfig, state, http, async () => {
    throw new Error("unexpected ingest");
  });
  eq(step.result.saved, "out_of_range");
  eq(step.result.read_scope, "listing_date_only");
  eq(step.result.stage, "listing_date_filter");
  eq(step.state.offset, 1);
  eq(step.state.next, state.next);
  eq(step.state.unknown_dates, 2);
  eq(step.continue, true);
  eq(step.result.coverage_complete, false);
  const backlog = await advance(
    cnilConfig,
    { ...state, is_backlog: true },
    http,
    async () => ({}),
  );
  eq(backlog.result.status, "failed");
  eq(backlog.state.offset, 0);
});
Deno.test("CNIL legacy rows refresh current page preserving unresolved counters", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-23",
    adapter_version: "edge-v2",
    page: cnilConfig.listing + "?page=15",
    rows: [{ url: cnilOldRow.url, title: "Old" }],
    offset: 0,
    failures: 1,
    unknown_dates: 2,
  };
  const html =
    '<main><div class="list-inner"><h3 class="ctn-gen-liste-titre"><a href="/fr/old">Old</a></h3><div class="attributes"><p class="date">27 mars 2024</p></div></div><a rel="next" href="?page=16">Next</a></main>';
  const step = await advance(cnilConfig, state, {
    request: async (url) => {
      eq(url, state.page);
      return { bytes: new TextEncoder().encode(html), url, type: "text/html" };
    },
  }, async () => ({}));
  eq(step.result.stage, "listing");
  eq(step.state.rows?.[0].date_observations?.[0].value, "27 mars 2024");
  eq(step.state.failures, 1);
  eq(step.state.unknown_dates, 2);
});
Deno.test("CNIL batches only consecutive old cards and leaves ambiguous or newer rows pending", async () => {
  const state: State = {
    since: "2026-09-21",
    until: "2026-10-23",
    adapter_version: "edge-cnil-v3",
    rows: [cnilOldRow, { ...cnilOldRow, url: "https://www.cnil.fr/fr/old2" }, {
      url: "https://www.cnil.fr/fr/ambiguous",
      title: "Ambiguous",
      date_observations: [
        ...cnilOldRow.date_observations,
        { ...cnilOldRow.date_observations[0], value: "20 octobre 2026" },
      ],
    }],
    offset: 0,
    failures: 1,
    unknown_dates: 2,
  };
  const step = await advance(cnilConfig, state, {
    request: () => Promise.reject(new Error("http_403")),
  }, async () => ({}));
  eq(step.result.listing_date_excluded, 2);
  eq(step.state.offset, 2);
  eq(step.state.failures, 1);
  const pending = await advance(cnilConfig, step.state, {
    request: () => Promise.reject(new Error("http_403")),
  }, async () => ({}));
  eq(pending.result.status, "failed");
  eq(pending.state.offset, 2);
});
Deno.test("CNIL reads detail when one listing field contains extra or multiple dates", async () => {
  for (const value of [
    "27 mars 2024 — mise à jour le 20 octobre 2026",
    "Publié le 27 mars 2024",
    "27 mars 2024 et 20 octobre 2026",
  ]) {
    const row = {
      ...cnilOldRow,
      date_observations: [{
        ...cnilOldRow.date_observations[0],
        value,
      }],
    };
    const detail = "https://www.cnil.fr/fr/old";
    let requested = "";
    const state: State = {
      since: "2026-09-21",
      until: "2026-10-23",
      adapter_version: "edge-cnil-v3",
      page: cnilConfig.listing,
      rows: [row],
      offset: 0,
    };
    const step = await advance(cnilConfig, state, {
      request: async (url) => {
        requested = url;
        return {
          bytes: new TextEncoder().encode(
            '<main><h1>Old</h1><div class="ctn-gen-auteur">20 octobre 2026</div><div class="ctn-gen-body">Personal data protection evidence.</div></main>',
          ),
          url,
          type: "text/html",
        };
      },
    }, async () => ({ item_created: true }));
    eq(requested, detail);
    eq(step.result.stage, "detail");
    eq(step.result.unknown_date, true);
    eq(step.state.offset, 1);
    eq(step.result.coverage_complete, false);
  }
});
Deno.test("exhausted Edge scans restart discovery with extended range and unresolved work intact", async () => {
  for (const cfg of [config, cnilConfig]) {
    const state: State = {
      since: "2026-09-21",
      until: "2026-10-23",
      adapter_version: cfg.source === "cnil" ? "edge-cnil-v3" : "edge-v2",
      page: cfg.listing,
      rows: [],
      offset: 0,
      next: null,
      failures: 1,
      unknown_dates: 2,
    };
    const stopped = await advance(cfg, state, {
      request: () => Promise.reject(new Error("unexpected")),
    }, async () => ({}));
    eq(stopped.state.exhausted, true);
    eq(stopped.continue, false);
    // collector_edge_take supplies today's upper bound; it does not clear state.
    const resumed = await advance(cfg, {
      ...stopped.state,
      until: "2026-10-24",
    }, {
      request: async (url) => ({
        bytes: new TextEncoder().encode(
          cfg.source === "cnil"
            ? '<main><div class="list-inner"><h3 class="ctn-gen-liste-titre"><a href="/fr/new">New</a></h3><div class="attributes"><p class="date">24 octobre 2026</p></div></div></main>'
            : '<main><a href="/news/new">New</a></main>',
        ),
        url,
        type: "text/html",
      }),
    }, async () => ({}));
    eq(resumed.result.stage, "listing");
    eq(resumed.state.exhausted, false);
    eq(resumed.state.since, state.since);
    eq(resumed.state.until, "2026-10-24");
    eq(resumed.state.unknown_dates, 2);
    eq(resumed.state.failures, 1);
    eq(resumed.result.coverage_complete, false);
  }
});

const pdpcPDFConfig = {
  ...config, source: "pdpc", listing: "https://www.pdpc.gov.sg/media-events",
  hosts: ["www.pdpc.gov.sg"],
};
const pdpcAsset = "https://www.pdpc.gov.sg/assets/25e68133-795e-4c3f-bbea-7456b01c8506";
const pdpcPDFState = (): State => ({
  since: "2026-10-16", until: "2026-10-23", is_backlog: true,
  rows: [{url: pdpcAsset, title: "Official data breach report", date_observations: [{
    meaning: "listing_published_display", locator: "listing card", value: "11 Apr 2025",
  }]}], offset: 0,
});
Deno.test("PDPC official asset PDF is text only and never inherits a CURIA dateline", async () => {
  const fixture = (await import("./pdf_fixture.json", { with: { type: "json" } })).default;
  let stored = 0;
  const step = await advance(pdpcPDFConfig, pdpcPDFState(), {
    request: async () => ({ bytes: Uint8Array.from(atob(fixture.base64), c => c.charCodeAt(0)), url: pdpcAsset, type: "application/pdf" }),
  }, async item => {
    stored++;
    eq(item.metadata.read_scope, "pdf_text_only");
    eq(item.metadata.requires_review, true);
    eq(item.metadata.ai_ready, false);
    eq(item.published_date, null);
    eq(item.metadata.date_observations[0].meaning, "listing_date_candidate");
    eq(item.metadata.related_documents[0].read, false);
    return {};
  });
  eq(stored, 1);
  eq(step.state.offset, 1);
  eq(step.result.unknown_date, true);
  eq(step.result.coverage_complete, false);
});
Deno.test("PDPC image PDF preserves OCR failure and backlog position without ingest", async () => {
  const fixture = (await import("./pdf_blank_fixture.json", { with: { type: "json" } })).default;
  const state = pdpcPDFState(); state.failures = 2;
  const step = await advance(pdpcPDFConfig, state, {
    request: async () => ({ bytes: Uint8Array.from(atob(fixture.base64), c => c.charCodeAt(0)), url: pdpcAsset, type: "application/pdf" }),
  }, async () => { throw new Error("unexpected ingest"); });
  eq(step.result.status, "failed");
  eq(step.result.reason, "pdf_text_missing_or_ocr_required");
  eq(step.state.offset, 0);
  eq(step.state.failures, 3);
  eq(step.state.rows, state.rows);
  eq(step.state.parked, undefined);
  eq(step.continue, true);
});
Deno.test("PDPC PDF requires an official asset and nonempty listing title", async () => {
  const fixture = (await import("./pdf_fixture.json", { with: { type: "json" } })).default;
  for (const [url, title, reason] of [
    ["https://www.pdpc.gov.sg/media-events/a", "Report", "unapproved_pdpc_pdf_asset"],
    [pdpcAsset, "", "pdf_listing_evidence_missing"],
    ["https://evil.test/assets/25e68133-795e-4c3f-bbea-7456b01c8506", "Report", "unapproved_url"],
  ]) {
    const state = pdpcPDFState(); state.rows = [{url, title}];
    const step = await advance(pdpcPDFConfig, state, {
      request: async () => ({bytes: Uint8Array.from(atob(fixture.base64), c => c.charCodeAt(0)), url, type: "application/pdf"}),
    }, async () => { throw new Error("unexpected ingest"); });
    eq(step.result.reason, reason);
    eq(step.state.offset, 0);
  }
});
