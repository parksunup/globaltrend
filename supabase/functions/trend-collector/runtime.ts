import { parseHTML } from "npm:linkedom@0.18.12";
import {
  canonical,
  discover,
  extract,
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
      (x: { href: string; title: string; date: string }) => {
        if (
          typeof x.href !== "string" || typeof x.title !== "string" ||
          typeof x.date !== "string"
        ) throw new Error("pdpc_listing_schema_changed");
        return {
          url: new URL(x.href, page).href,
          title: normalize(x.title),
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
    const n = Number(new URL(page).searchParams.get("page") || 1);
    const response = await http.request(
      new URL("/api/search", page).href,
      "POST",
      JSON.stringify({
        rootPageId: Number(node),
        filters: [],
        pageNumber: n,
        order: "newest",
      }),
    );
    const data = JSON.parse(new TextDecoder().decode(response.bytes));
    if (
      !Array.isArray(data.results) ||
      data.pagination?.showingPageNumber !== n ||
      typeof data.pagination?.hasMore !== "boolean" ||
      data.pagination.hasMore !== (n < data.pagination.totalPages)
    ) throw new Error("ico_pagination_changed_or_stale");
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
async function pdf(bytes: Uint8Array, row: Row): Promise<Item> {
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
    }
    const body = normalize(pages.map((x) => x.text).join(" "));
    if (body.length > 80000) {
      throw new Error("long_document_requires_chunked_reading");
    }
    const obs = [...(row.date_observations || [])];
    const dateline = pages[0].text.match(
      /Luxembourg,\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/,
    );
    if (dateline) {
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
    const date = dates.length === 1 ? dates[0] : null;
    return {
      title_original: row.title,
      content_text: body,
      content_hash: await sha(body),
      published_date: date,
      metadata: {
        normalization_version: "main-body-nfc-v1",
        parser_version: "edge-curia-pdf-v1",
        read_scope: "press_release_pdf_not_judgment",
        date_observations: obs,
        requires_review: true,
        related_documents: [],
        unread_attachments: [],
        factual_status: "nonbinding_press_release_not_judgment",
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
  try {
    state.page ||= state.legacy_cursor?.page || c.listing;
    if (!state.rows) {
      const found = await listing(c, http, canonical(state.page, c.hosts));
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
      state.rows = found.rows;
      state.next = found.next;
      state.offset = 0;
      state.exhausted = false;
      // A Python offset is not transferable to a different parser's row sequence.
      result.stage = "listing";
      result.discovered = found.rows.length;
      result.next = found.next;
    } else if ((state.offset || 0) < state.rows.length) {
      const row = state.rows[state.offset || 0];
      const url = canonical(row.url, c.hosts);
      const response = await http.request(url);
      let item: Item;
      if (c.source === "curia" && response.type === "application/pdf") {
        item = await pdf(response.bytes, row);
      } else {
        if (!["text/html", "application/xhtml+xml"].includes(response.type)) {
          throw new Error("unsupported_document_type");
        }
        item = await extract(
          c.source,
          new TextDecoder().decode(response.bytes),
          response.url,
          row,
        );
      }
      if (
        item.published_date &&
        (item.published_date < state.since || item.published_date > state.until)
      ) result.saved = "out_of_range";
      else {
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
      result.reason = "listing_exhaustiveness_unverified";
      result.stage = "range_incomplete";
      return { state, result, continue: false, delay: 0 };
    }
    return { state, result, continue: true, delay: 0 };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown_failure";
    // A database write may have succeeded before its response was lost: retry same
    // position, relying on ingest's URL/hash uniqueness. Never advance on failure.
    state.failures = (state.failures || 0) + 1;
    result.status = "failed";
    result.reason = /^[a-z_0-9:]+$/i.test(reason)
      ? reason
      : "runtime_" + (e instanceof Error ? e.name : "error");
    result.offset = state.offset || 0;
    result.page = state.page;
    return {
      state,
      result,
      continue: true,
      delay: Math.min(86400, 60 * 2 ** Math.min(state.failures, 10)),
    };
  }
}
