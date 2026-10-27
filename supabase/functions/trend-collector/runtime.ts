import { parseHTML } from "npm:linkedom@0.18.12";
import {
  canonical,
  cnilListingDate,
  discover,
  extract,
  icoPublishedDate,
  normalize,
  parseDate,
  type Row,
  sha,
} from "./adapter.ts";
export type Config = {
  source: string;
  source_id: string;
  listing: string;
  hosts: string[];
  language: string;
};
export type State = {
  since: string;
  until: string;
  adapter_version?: string;
  is_backlog?: boolean;
  parked?: State;
  page?: string;
  rows?: Row[];
  next?: string | null;
  offset?: number;
  failures?: number;
  unknown_dates?: number;
  exhausted?: boolean;
  seen_pages?: string[];
  legacy_cursor?: { page?: string; offset?: number } | null;
};
type HTTP = {
  request: (
    url: string,
    method?: string,
    body?: string,
  ) => Promise<{ bytes: Uint8Array; url: string; type: string }>;
};
export type Item = Awaited<ReturnType<typeof extract>>;

/** Keep diagnostic links on approved public hosts and drop arbitrary query data. */
function safeDiagnosticUrl(raw: string, hosts: string[]): string | null {
  try {
    const parsed = new URL(canonical(raw, hosts));
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(parsed.pathname);
    } catch {
      return null;
    }
    const segments = decodedPath.split("/").filter(Boolean);
    if (
      decodedPath.length > 512 ||
      segments.some((segment) =>
        segment.length > 100 || /[@\p{Cc}]/u.test(segment) ||
        /^[A-Za-z0-9_-]{32,}$/.test(segment) ||
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(segment)
      )
    ) return null;

    const safe = new URL(parsed.origin + parsed.pathname);
    const allowedParams = new Set(["page", "offset", "pagenumber", "from", "to"]);
    for (const key of allowedParams) {
      const values = parsed.searchParams.getAll(key);
      if (values.length !== 1) continue;
      const value = values[0];
      const valid = key === "from" || key === "to"
        ? /^\d{4}-\d{2}-\d{2}$/.test(value)
        : /^\d{1,6}$/.test(value);
      if (valid) safe.searchParams.set(key, value);
    }
    safe.searchParams.sort();
    return safe.href;
  } catch {
    return null;
  }
}
async function listing(c: Config, http: HTTP, page: string) {
  const r = await http.request(page);
  const text = new TextDecoder().decode(r.bytes);
  if (c.source === "pdpc") {
    const data = JSON.parse(text);
    const u = new URL(page);
    const n = Number(u.searchParams.get("page") || 1);
    if (
      !Array.isArray(data.data) || !Number.isInteger(data.totalItems) ||
      data.data.length !==
        Math.max(0, Math.min(10, data.totalItems - (n - 1) * 10))
    ) throw new Error("pdpc_listing_page_incomplete");
    const rows: Row[] = data.data.map(
      (x: { href: string; title: string; date: string; topic: string }) => {
        if (
          typeof x.href !== "string" || typeof x.title !== "string" ||
          typeof x.date !== "string" || typeof x.topic !== "string"
        ) throw new Error("pdpc_listing_schema_changed");
        return {
          url: new URL(x.href, page).href,
          title: normalize(x.title),
          topic: normalize(x.topic),
          date_observations: [{
            meaning: "listing_published_display",
            locator: "listing card",
            value: x.date,
          }],
        };
      },
    );
    u.searchParams.set("page", String(n + 1));
    return { rows, next: n * 10 < data.totalItems ? u.href : null };
  }
  if (c.source === "ico") {
    const { document } = parseHTML(text);
    const node = document.querySelector("#filter-page-container[data-node-id]")
      ?.getAttribute("data-node-id");
    const order = document.querySelector("#filter-page-order option[selected]")
      ?.getAttribute("value");
    if (!node || !/^\d+$/.test(node) || order !== "newest") {
      throw new Error("ico_listing_template_changed");
    }
    const query = new URL(page).searchParams;
    if ([...query.keys()].some((k) => !["from", "to", "page"].includes(k)) ||
      ["page", "from", "to"].some((k) => query.getAll(k).length > 1)) throw new Error("unverified_listing_query");
    const n = Number(query.get("page") || 1);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error("invalid_listing_page");
    const filters = ["from", "to"].filter((k) => query.has(k)).map((key) => ({ key, values: query.getAll(key) }));
    const response = await http.request(
      new URL("/api/search", page).href,
      "POST",
      JSON.stringify({
        rootPageId: Number(node),
        filters,
        pageNumber: n,
        order: "newest",
      }),
    );
    const data = JSON.parse(new TextDecoder().decode(response.bytes));
    if (
      !Array.isArray(data.results) ||
      data.pagination?.showingPageNumber !== n ||
      !Number.isInteger(data.pagination.totalResults) || data.pagination.totalResults < 0 ||
      !Number.isInteger(data.pagination.perPage) || data.pagination.perPage <= 0 ||
      !Number.isInteger(data.pagination.totalPages) ||
      data.pagination.totalPages !== Math.max(1, Math.ceil(data.pagination.totalResults / data.pagination.perPage)) ||
      typeof data.pagination?.hasMore !== "boolean" ||
      data.pagination.hasMore !== (n < data.pagination.totalPages)
    ) throw new Error("ico_pagination_changed_or_stale");
    if (data.results.length !== Math.max(0, Math.min(data.pagination.perPage, data.pagination.totalResults - (n - 1) * data.pagination.perPage))) {
      throw new Error("ico_listing_page_incomplete");
    }
    const rows: Row[] = data.results.map(
      (x: { url: string; title: string }) => {
        if (typeof x.url !== "string" || typeof x.title !== "string") {
          throw new Error("ico_schema_changed");
        }
        return { url: new URL(x.url, page).href, title: normalize(x.title) };
      },
    );
    const u = new URL(page);
    u.searchParams.set("page", String(n + 1));
    return { rows, next: data.pagination.hasMore ? u.href : null };
  }
  if (
    ![
      "text/html",
      "application/xhtml+xml",
      "application/rss+xml",
      "text/xml",
      "application/xml",
    ].includes(r.type)
  ) throw new Error("unsupported_listing_type");
  return discover(c.source, text, r.url);
}
export async function extractPressReleasePDF(
  bytes: Uint8Array,
  row: Row,
): Promise<Item> {
  return extractTextPDF(bytes, row, "curia");
}
export async function extractPDPCPDF(bytes: Uint8Array, row: Row): Promise<Item> {
  const target = new URL(canonical(row.url, ["www.pdpc.gov.sg"]));
  if (!/^\/assets\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(target.pathname)) {
    throw new Error("unapproved_pdpc_pdf_asset");
  }
  if (!normalize(row.title || "")) throw new Error("pdf_listing_evidence_missing");
  return extractTextPDF(bytes, row, "pdpc");
}
async function extractTextPDF(bytes: Uint8Array, row: Row, source: "curia" | "pdpc"): Promise<Item> {
  // Text-only PDF adapter; no Node canvas, OCR, browser, Python or paid service.
  const lib = await import("npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs");
  const worker = await import(
    "npm:pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs"
  );
  (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = worker;
  const doc = await lib.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    useWorkerFetch: false,
  }).promise;
  try {
    if (doc.numPages < 1 || doc.numPages > 50) {
      throw new Error("pdf_page_limit");
    }
    const pages: { page: number; text: string }[] = [];
    const related: {
      url: string;
      title: string;
      page: number;
      read: boolean;
    }[] = [];
    const unresolved: { href: string; title: string; reason: string }[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = normalize(
        content.items.map((x: unknown) =>
          "str" in (x as object) ? (x as { str: string }).str : ""
        ).join(" "),
      );
      if (text.length < 20) throw new Error("pdf_text_missing_or_ocr_required");
      pages.push({ page: i, text });
      for (const annotation of await page.getAnnotations()) {
        const raw = annotation.url || annotation.unsafeUrl;
        if (typeof raw !== "string") continue;
        try {
          const target = new URL(raw);
          if (target.protocol === "https:") {
            related.push({
              url: target.href,
              title: "PDF link",
              page: i,
              read: false,
            });
          }
        } catch {
          unresolved.push({
            href: raw,
            title: "PDF link",
            reason: "malformed_source_href",
          });
        }
      }
    }
    const body = normalize(pages.map((x) => x.text).join(" "));
    if (body.length > 80000) {
      throw new Error("long_document_requires_chunked_reading");
    }
    // A PDPC listing date is not yet verified as the PDF publication date.
    const obs = source === "pdpc"
      ? (row.date_observations || []).map(o => ({...o, meaning: "listing_date_candidate"}))
      : [...(row.date_observations || [])];
    const dateline = pages[0].text.match(
      /Luxembourg,\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/,
    );
    if (source === "curia" && dateline) {
      obs.push({
        meaning: "press_release_dateline",
        locator: "PDF page 1 dateline",
        value: dateline[1],
      });
    }
    const dates = [
      ...new Set(
        obs.map((o) => {
          if (
            o.meaning === "published_attribute" &&
            /^\d\d\/\d\d\/\d{4}$/.test(o.value)
          ) {
            const [d, m, y] = o.value.split("/");
            return parseDate(`${y}-${m}-${d}`);
          }
          return parseDate(o.value);
        }).filter(Boolean),
      ),
    ];
    const date = source === "curia" && dates.length === 1 ? dates[0] : null;
    return {
      title_original: row.title,
      content_text: body,
      content_hash: await sha(body),
      published_date: date,
      metadata: {
        normalization_version: "edge-pdf-text-nfc-v1",
        parser_version: source === "curia" ? "edge-curia-pdf-v1" : "edge-pdpc-asset-pdf-text-v1",
        read_scope: source === "curia" ? "press_release_pdf_not_judgment" : "pdf_text_only",
        date_observations: obs,
        requires_review: true,
        related_documents: related,
        unresolved_links: unresolved,
        unread_attachments: related.map((x) => x.url),
        factual_status: source === "curia" ? "nonbinding_press_release_not_judgment" : "official_pdf_text_not_visual_or_independent_legal_finding",
        ai_ready: false,
        pdf_pages: pages,
      } as Item["metadata"],
    };
  } finally {
    await doc.destroy();
  }
}
export async function advance(
  c: Config,
  original: State,
  http: HTTP,
  ingest: (item: Item, url: string) => Promise<Record<string, unknown>>,
) {
  const state: State = structuredClone(original);
  const result: Record<string, unknown> = {
    source: c.source,
    status: "partial",
    coverage_complete: false,
    since: state.since,
    until: state.until,
  };
  let requestStage: "listing" | "detail" = "listing";
  const diagnosticHttp: HTTP = {
    request: async (raw, method, body) => {
      result.stage = `${requestStage}_fetch`;
      const diagnosticUrl = safeDiagnosticUrl(raw, c.hosts);
      if (diagnosticUrl) result.url = diagnosticUrl;
      else delete result.url;
      const response = await http.request(raw, method, body);
      result.stage = `${requestStage}_parse`;
      return response;
    },
  };
  try {
    if (
      !["edge-v2", "edge-cnil-v3"].includes(state.adapter_version || "") &&
      !state.is_backlog &&
      state.legacy_cursor
    ) {
      state.page = c.listing;
      delete state.rows;
      state.offset = 0;
      state.seen_pages = [];
    }
    // Refresh legacy CNIL row snapshots once, at their current page. Never
    // transfer a stale offset to rows with newly observed dates. Backlog is exact.
    if (
      c.source === "cnil" && !state.is_backlog &&
      state.adapter_version !== "edge-cnil-v3"
    ) {
      delete state.rows;
      state.offset = 0;
      state.seen_pages = [];
    }
    state.adapter_version = c.source === "cnil" ? "edge-cnil-v3" : "edge-v2";
    state.page ||= c.listing;
    if (c.source === "ico" && !state.is_backlog) {
      // A finished full scan's unresolved count describes that past scan. The
      // next scan must recompute it from zero; in-flight scans and exact
      // backlog retries keep their accumulated count unchanged.
      if (state.exhausted && !state.rows) state.unknown_dates = 0;
      for (const value of [state.since, state.until]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parseDate(value) !== value) {
          throw new Error("invalid_ico_listing_range");
        }
      }
      if (state.since > state.until) throw new Error("invalid_ico_listing_range");
      const scoped = new URL(state.page);
      if (scoped.searchParams.get("from") !== state.since || scoped.searchParams.get("to") !== state.until) {
        state.legacy_cursor ||= { page: state.page, offset: state.offset || 0 };
        const first = new URL(c.listing);
        first.search = new URLSearchParams({ from: state.since, to: state.until }).toString();
        state.page = first.href;
        delete state.rows;
        delete state.next;
        state.offset = 0;
        state.seen_pages = [];
        state.exhausted = false;
      }
    }
    if (!state.rows) {
      result.stage = "listing_url_validation";
      const listingUrl = canonical(state.page, c.hosts);
      const safeListingUrl = safeDiagnosticUrl(listingUrl, c.hosts);
      if (safeListingUrl) result.url = safeListingUrl;
      else delete result.url;
      const found = await listing(c, diagnosticHttp, listingUrl);
      if (!found.rows.length) {
        throw new Error("listing_empty_or_structure_changed");
      }
      if (found.rows.length > 400) throw new Error("listing_row_limit");
      const urls = found.rows.map((r) => r.url);
      if (
        new Set(urls).size !== urls.length && ["pdpc", "ico"].includes(c.source)
      ) throw new Error("listing_repeated_or_duplicate_items");
      const fingerprint = await sha(JSON.stringify(found.rows));
      if (state.seen_pages?.includes(fingerprint)) {
        throw new Error("listing_cycle");
      }
      state.seen_pages = [...(state.seen_pages || []), fingerprint].slice(-50);
      state.failures = 0;
      state.rows = found.rows;
      state.next = found.next;
      state.offset = 0;
      state.exhausted = false;
      // A Python offset is not transferable to a different parser's row sequence.
      result.stage = "listing";
      result.discovered = found.rows.length;
      result.next = found.next;
    } else if ((state.offset || 0) < state.rows.length) {
      if (c.source === "cnil" && !state.is_backlog) {
        const excluded: {
          url: string;
          date: string;
          observations: Row["date_observations"];
        }[] = [];
        while ((state.offset || 0) < state.rows.length) {
          const candidate = state.rows[state.offset || 0];
          const date = cnilListingDate(candidate);
          if (!date || date >= state.since && date <= state.until) break;
          excluded.push({
            url: canonical(candidate.url, c.hosts),
            date,
            observations: candidate.date_observations,
          });
          state.offset = (state.offset || 0) + 1;
        }
        if (excluded.length) {
          // The public sort key is article type, not a verified date order.
          // Only these cards are excluded; later pages and all backlog survive.
          result.stage = "listing_date_filter";
          result.saved = "out_of_range";
          result.read_scope = "listing_date_only";
          result.listing_date_excluded = excluded.length;
          result.listing_date_evidence = excluded;
          return { state, result, continue: true, delay: 0 };
        }
      }
      const row = state.rows[state.offset || 0];
      requestStage = "detail";
      result.stage = "detail_url_validation";
      const safeDetailUrl = safeDiagnosticUrl(row.url, c.hosts);
      if (safeDetailUrl) result.url = safeDetailUrl;
      else delete result.url;
      const url = canonical(row.url, c.hosts);
      const pdpcReportDate = c.source === "pdpc" && row.topic === "Reports" &&
          row.date_observations?.length === 1 &&
          row.date_observations[0].meaning === "listing_published_display" &&
          row.date_observations[0].locator === "listing card"
        ? parseDate(row.date_observations[0].value)
        : null;
      if (
        pdpcReportDate &&
        (pdpcReportDate < state.since || pdpcReportDate > state.until)
      ) {
        state.failures = 0;
        result.stage = "listing_date_scope_check";
        result.saved = "out_of_range";
        result.read_scope = "official_listing_api_topic_and_date";
        result.published_date = pdpcReportDate;
        result.date_evidence = {
          topic: row.topic,
          meaning: "listing_published_display",
          locator: "listing card",
          value: row.date_observations![0].value,
        };
        if (state.is_backlog) {
          result.reason = "backlog_out_of_range";
          result.backlog_resolved = true;
          return { state, result, continue: false, delay: 0 };
        }
        state.offset = (state.offset || 0) + 1;
        return { state, result, continue: true, delay: 0 };
      }
      const response = await diagnosticHttp.request(url);
      let item: Item;
      if (c.source === "curia" && response.type === "application/pdf") {
        item = await extractPressReleasePDF(response.bytes, row);
      } else if (c.source === "pdpc" && response.type === "application/pdf") {
        item = await extractPDPCPDF(response.bytes, {...row, url: canonical(response.url, c.hosts)});
      } else {
        if (!["text/html", "application/xhtml+xml"].includes(response.type)) {
          throw new Error("unsupported_document_type");
        }
        const html = new TextDecoder().decode(response.bytes);
        const icoDate = c.source === "ico" ? icoPublishedDate(html) : null;
        if (icoDate && (icoDate.date < state.since || icoDate.date > state.until)) {
          result.stage = "detail_scope_check";
          result.saved = "out_of_range";
          result.published_date = icoDate.date;
          result.date_evidence = {
            meaning: "official_published_attribute",
            locator: 'meta[name="DC.Date"]@content',
            value: icoDate.value,
          };
          state.failures = 0;
          if (state.is_backlog) {
            result.reason = "backlog_out_of_range";
            result.backlog_resolved = true;
            return { state, result, continue: false, delay: 0 };
          }
          state.offset = (state.offset || 0) + 1;
          return { state, result, continue: true, delay: 0 };
        }
        item = await extract(c.source, html, response.url, row);
      }
      if (
        item.published_date &&
        (item.published_date < state.since || item.published_date > state.until)
      ) result.saved = "out_of_range";
      else {
        result.stage = "item_store";
        const saved = await ingest(item, url);
        result.saved = saved.item_created
          ? "new"
          : saved.content_changed
          ? "changed"
          : "duplicate";
        Object.assign(result, saved);
        if (!item.published_date) {
          state.unknown_dates = (state.unknown_dates || 0) + 1;
          result.unknown_date = true;
        }
      }
      state.offset = (state.offset || 0) + 1;
      state.failures = 0;
      result.stage = "detail";
      result.url = url;
      result.read_scope = item.metadata.read_scope;
      result.published_date = item.published_date;
      if (state.is_backlog) return { state, result, continue: false, delay: 0 };
    } else if (state.next) {
      state.page = canonical(state.next, c.hosts);
      delete state.rows;
      state.offset = 0;
      result.stage = "next_page";
    } else {
      // Exhausting a bounded feed/listing does not establish period completeness.
      state.exhausted = true;
      delete state.rows;
      state.offset = 0;
      state.seen_pages = [];
      state.page = c.listing;
      result.listing_scan_complete = true;
      result.unresolved_date_count = state.unknown_dates || 0;
      result.coverage_blockers = [
        "listing_exhaustiveness_unverified",
        ...((state.unknown_dates || 0) > 0
          ? ["unknown_publication_dates"]
          : []),
      ];
      result.reason = "listing_exhaustiveness_unverified";
      result.stage = "range_incomplete";
      return { state, result, continue: false, delay: 0 };
    }
    return { state, result, continue: true, delay: 0 };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown_failure";
    if (
      c.source === "pdpc" &&
      reason === "pdpc_promotional_landing_without_article"
    ) {
      // An empty PDPC article shell containing only a promotional video card
      // is a non-report landing page, not a transient fetch failure. Preserve
      // the source range and cursor while recording the skip; resolve only
      // this exact backlog item when running its targeted retry.
      state.offset = (state.offset || 0) + 1;
      state.failures = 0;
      result.status = "partial";
      result.stage = "detail_scope_check";
      result.reason = "pdpc_promotional_landing_without_article";
      result.saved = "non_article";
      result.read_scope = "official_html_promo_card_only";
      result.coverage_complete = false;
      if (state.is_backlog) {
        result.backlog_resolved = true;
        return { state, result, continue: false, delay: 0 };
      }
      return { state, result, continue: true, delay: 0 };
    }
    // A database write may have succeeded before its response was lost: retry same
    // position, relying on ingest's URL/hash uniqueness. Never advance on failure.
    state.failures = (state.failures || 0) + 1;
    result.status = "failed";
    result.reason = /^[a-z_0-9:]+$/i.test(reason)
      ? reason
      : "runtime_" + (e instanceof Error ? e.name : "error");
    result.offset = state.offset || 0;
    const safeFailurePage = typeof state.page === "string" ? safeDiagnosticUrl(state.page, c.hosts) : null;
    if (safeFailurePage) result.page = safeFailurePage;
    else delete result.page;
    if (
      !state.is_backlog && state.rows?.[state.offset || 0] &&
      state.failures >= 3 && !reason.startsWith("database_")
    ) {
      // finish() persists this failed position and its own queue message atomically
      // before advancing the main scan. No failed document is discarded.
      state.parked = {
        since: state.since,
        until: state.until,
        page: state.page,
        rows: [state.rows[state.offset || 0]],
        offset: 0,
        is_backlog: true,
        adapter_version: "edge-v1",
        failures: state.failures,
      };
      state.offset = (state.offset || 0) + 1;
      state.failures = 0;
      result.failed_item_preserved = true;
    }
    return {
      state,
      result,
      continue: true,
      delay: Math.min(86400, 60 * 2 ** Math.min(state.failures, 10)),
    };
  }
}
