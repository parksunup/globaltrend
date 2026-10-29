import { DOMParser, parseHTML } from "npm:linkedom@0.18.12";
import routes from "./expansion-routes.json" with { type: "json" };
import { canonical, normalize, parseDate, type Row, sha } from "./adapter.ts";

type Route = {
  host: string;
  listing: string;
  article_path: string;
  links?: string;
  card?: string;
  card_date?: string;
  unwrap_query?: string;
  next?: string;
  feed?: boolean;
  json_api?: boolean;
  title?: string;
  body?: string;
  date?: string;
  date_attribute?: string;
};
export const expansionRoutes: Record<string, Route> = routes;
export const isExpansion = (source: string) =>
  Object.hasOwn(expansionRoutes, source);
export function listingRequestUrl(
  source: string,
  raw: string,
  since: string,
  until: string,
): string {
  if (source !== "ec") return raw;
  if (
    parseDate(since) !== since || parseDate(until) !== until || since > until
  ) throw new Error("invalid_expansion_range");
  const url = new URL(canonical(raw, [route(source).host]));
  if (
    ![
      "/commission/presscorner/api/latestnews",
      "/commission/presscorner/api/search",
    ].includes(url.pathname)
  ) throw new Error("unverified_listing_path");
  const display = (iso: string) =>
    iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4);
  const end = new Date(until + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  url.pathname = "/commission/presscorner/api/search";
  url.searchParams.set("language", "en");
  url.searchParams.set("pagesize", "10");
  url.searchParams.set("datefrom", display(since));
  url.searchParams.set("dateto", display(end.toISOString().slice(0, 10)));
  if (!url.searchParams.has("pagenumber")) {
    url.searchParams.set("pagenumber", "1");
  }
  return canonical(url.href, [route(source).host]);
}
export function verifyDetailResponse(
  source: string,
  requested: string,
  received: string,
): void {
  const c = route(source);
  const actual = canonical(received, [c.host]);
  if (source === "eu-parliament") {
    articleUrl(source, actual, requested);
    const before = new URL(requested).pathname.match(
      /\/press-room\/(\d{8}IPR\d+)(?:\/|$)/,
    )?.[1];
    const after = new URL(actual).pathname.match(
      /\/press-room\/(\d{8}IPR\d+)(?:\/|$)/,
    )?.[1];
    if (before && before === after) return;
  } else if (
    canonical(detailRequestUrl(source, requested), [c.host]) === actual
  ) return;
  throw new Error("detail_redirect_identity_mismatch");
}
function route(source: string): Route {
  const config = expansionRoutes[source];
  if (!config) throw new Error("unverified_expansion_source");
  return config;
}
function articleUrl(source: string, raw: string, base: string): string {
  const c = route(source);
  const url = canonical(new URL(raw, base).href, [c.host]);
  if (!new RegExp(c.article_path).test(new URL(url).pathname)) {
    throw new Error("unverified_article_path");
  }
  return url;
}
export function expansionDate(value: string): string | null {
  const s = normalize(value);
  const chinese = s.match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+\d{2}:\d{2})?$/,
  );
  if (chinese) {
    return parseDate(
      `${chinese[1]}-${chinese[2].padStart(2, "0")}-${
        chinese[3].padStart(2, "0")
      }`,
    );
  }
  // RSS pubDate is a specific publication field, never a date found in prose.
  if (
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:[+-]\d{4}|GMT)$/
      .test(s)
  ) {
    const parsed = new Date(s);
    return Number.isNaN(parsed.valueOf())
      ? null
      : parsed.toISOString().slice(0, 10);
  }
  return parseDate(s);
}
export function expansionListingDate(row: Row): string | null {
  const observations = row.date_observations || [];
  if (
    observations.length !== 1 ||
    observations[0].meaning !== "expansion_listing_published"
  ) return null;
  return expansionDate(observations[0].value);
}
export function nextWithinWindow(
  source: string,
  found: { rows: Row[]; next: string | null },
  since: string,
): string | null {
  if (!found.next || !["oaic", "ca-opc"].includes(source)) return found.next;
  const dates = found.rows.map(expansionListingDate);
  // OAIC's date-sort search and OPC's o=d archive are observed descending.
  // An unknown/out-of-order date keeps discovery open, never truncates it.
  if (
    dates.length && dates.every((d): d is string => !!d) &&
    dates.every((d, i) => i === 0 || d! <= dates[i - 1]!) &&
    dates.at(-1)! < since
  ) return null;
  return found.next;
}
export function detailRequestUrl(source: string, raw: string): string {
  if (!isExpansion(source)) return raw;
  const url = articleUrl(source, raw, raw);
  if (source !== "ec") return url;
  const code = new URL(url).pathname.split("/").at(-1)!.toUpperCase()
    .replaceAll("_", "/");
  const api = new URL(
    "https://ec.europa.eu/commission/presscorner/api/documents",
  );
  api.searchParams.set("language", "en");
  api.searchParams.set("reference", code);
  return api.href;
}
export function discoverExpansion(
  source: string,
  text: string,
  url: string,
): { rows: Row[]; next: string | null } {
  const c = route(source);
  canonical(url, [c.host]);
  const rows = new Map<string, Row>();
  const add = (raw: string, title: string, value?: string, locator = "") => {
    const target = articleUrl(source, raw, url);
    if (!normalize(title)) throw new Error("listing_title_missing");
    rows.set(target, {
      url: target,
      title: normalize(title),
      ...(value
        ? {
          date_observations: [{
            meaning: "expansion_listing_published",
            locator: `${source} ${locator}`,
            value: normalize(value),
          }],
        }
        : {}),
    });
  };
  if (c.json_api) {
    const data = JSON.parse(text);
    const u = new URL(url),
      page = Number(u.searchParams.get("pagenumber") || 1),
      size = Number(u.searchParams.get("pagesize") || 100);
    if (
      !Number.isInteger(data.totalNumber) || data.totalNumber < 0 ||
      data.pageNumber !== page || data.pageSize !== size ||
      !Array.isArray(data.docuLanguageListResources) ||
      data.docuLanguageListResources.length !==
        Math.max(0, Math.min(size, data.totalNumber - (page - 1) * size))
    ) throw new Error("ec_listing_schema_or_page_changed");
    for (const row of data.docuLanguageListResources) {
      if (typeof row.refCode !== "string" || typeof row.title !== "string") {
        throw new Error("ec_listing_schema_changed");
      }
      // Only observed press releases and statements; no legal document API.
      if (
        !/^(IP|QANDA|STATEMENT|SPEECH|MEMO|MEX)\/\d{2}\/\d+$/i.test(row.refCode)
      ) throw new Error("ec_listing_document_type_unverified");
      add(
        `/commission/presscorner/detail/en/${
          row.refCode.toLowerCase().replaceAll("/", "_")
        }`,
        row.title,
      );
    }
    u.searchParams.set("pagenumber", String(page + 1));
    if (!rows.size && data.totalNumber !== 0) {
      throw new Error("listing_empty_or_structure_changed");
    }
    return {
      rows: [...rows.values()],
      next: page * size < data.totalNumber ? canonical(u.href, [c.host]) : null,
    };
  }
  if (c.feed) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
      throw new Error("xml_entities_rejected");
    }
    const xml = new DOMParser().parseFromString(text, "text/xml");
    for (const item of xml.querySelectorAll("channel > item")) {
      add(
        item.querySelector("link")?.textContent || "",
        item.querySelector("title")?.textContent || "",
        item.querySelector("pubDate")?.textContent || undefined,
        "RSS pubDate",
      );
      // Feed timestamps and the detail's displayed local date may straddle
      // midnight. Keep the observation, but don't skip a detail using it.
      const last = [...rows.values()].at(-1);
      if (last?.date_observations?.[0]) {
        last.date_observations[0].meaning = "expansion_feed_publication";
      }
    }
    if (!rows.size) throw new Error("listing_empty_or_structure_changed");
    return { rows: [...rows.values()], next: null };
  }
  const { document } = parseHTML(text);
  for (const a of document.querySelectorAll(c.links!)) {
    let raw = a.getAttribute("href")!;
    if (c.unwrap_query) {
      const wrapper = new URL(canonical(new URL(raw, url).href, [c.host]));
      if (
        wrapper.pathname !== "/s/redirect" ||
        wrapper.searchParams.getAll(c.unwrap_query).length !== 1
      ) throw new Error("unverified_redirect_wrapper");
      raw = wrapper.searchParams.get(c.unwrap_query)!;
    }
    if (
      new URL(raw, url).hostname === c.host &&
      !new RegExp(c.article_path).test(new URL(raw, url).pathname)
    ) continue;
    const date = c.card && c.card_date
      ? a.closest(c.card)?.querySelector(c.card_date)?.textContent || undefined
      : undefined;
    add(raw, a.textContent || "", date, c.card_date);
  }
  if (!rows.size) throw new Error("listing_empty_or_structure_changed");
  let next: string | null = null;
  const a = c.next ? document.querySelector(c.next) : null;
  if (a) next = canonical(new URL(a.getAttribute("href")!, url).href, [c.host]);
  if (source === "oaic") {
    const current = Number(new URL(url).searchParams.get("start_rank") || 1);
    const links = [...document.querySelectorAll('a[href*="start_rank="]')].map(
      (a) => new URL(a.getAttribute("href")!, url),
    ).filter((u) => Number(u.searchParams.get("start_rank")) > current).sort((
      a,
      b,
    ) =>
      Number(a.searchParams.get("start_rank")) -
      Number(b.searchParams.get("start_rank"))
    );
    next = links[0] ? canonical(links[0].href, [c.host]) : null;
  }
  if (source === "cn-tc260") {
    const paging = text.match(
      /createPageHTML\('page_div',\s*(\d+),\s*(\d+),'list','shtml',\s*(\d+)\)/,
    );
    const current = Number(
      new URL(url).pathname.match(/list_(\d+)\.shtml$/)?.[1] || 1,
    );
    if (
      !paging || Number(paging[2]) !== current || Number(paging[1]) < current
    ) throw new Error("tc260_pagination_changed");
    next = current < Number(paging[1])
      ? new URL(`list_${current + 1}.shtml`, url).href
      : null;
  }
  return { rows: [...rows.values()], next };
}

export async function extractExpansion(
  source: string,
  input: string,
  url: string,
  row?: Row,
) {
  const c = route(source);
  articleUrl(source, url, url);
  let html = input;
  let observations: NonNullable<Row["date_observations"]> = [];
  if (source === "ec") {
    const data = JSON.parse(input), body = data.docuLanguageResource;
    const expected = new URL(url).pathname.split("/").at(-1)!.replaceAll(
      "_",
      "/",
    ).toUpperCase();
    if (
      data.refCd?.toUpperCase() !== expected ||
      typeof body?.title !== "string" || typeof body.htmlContent !== "string" ||
      data.originalLanguage == null
    ) throw new Error("ec_detail_schema_or_identity_changed");
    const { document } = parseHTML("<main><h1></h1><article></article></main>");
    document.querySelector("h1")!.textContent = body.title;
    document.querySelector("article")!.innerHTML = body.htmlContent;
    for (const quote of body.dolaQuoteResources || []) {
      if (
        typeof quote.extract !== "string" ||
        typeof quote.author?.authorName !== "string"
      ) throw new Error("ec_quote_schema_changed");
      const block = document.createElement("blockquote");
      const text = document.createElement("p"),
        author = document.createElement("cite");
      text.textContent = quote.extract;
      author.textContent = quote.author.authorName;
      block.append(text, author);
      document.querySelector("article")!.append(block);
    }
    html = document.toString();
    if (typeof data.publishDate === "string") {
      observations.push({
        meaning: "official_published_attribute",
        locator: "EC documents.publishDate",
        value: data.publishDate,
      });
    }
  }
  const { document } = parseHTML(html);
  const title = document.querySelector(c.title || "main h1");
  let nodes = [...document.querySelectorAll(c.body || "main article")];
  nodes = nodes.filter((n) =>
    !nodes.some((other) => other !== n && other.contains(n))
  );
  if (!title || !nodes.length) throw new Error("title_or_body_missing");
  const related: { url: string; title: string; read: boolean }[] = [];
  for (const n of nodes) {
    for (const a of n.querySelectorAll("a[href]")) {
      const target = new URL(a.getAttribute("href")!, url);
      if (target.protocol === "https:") {
        related.push({
          url: target.href,
          title: normalize(a.textContent || ""),
          read: false,
        });
      }
    }
    for (
      const unwanted of n.querySelectorAll(
        "script,style,nav,footer,.related-content,.cookie-banner",
      )
    ) unwanted.remove();
  }
  const textNodes = (node: Node): string[] =>
    node.nodeType === 3
      ? (node.textContent?.trim() ? [node.textContent.trim()] : [])
      : [...node.childNodes].flatMap(textNodes);
  const body = normalize(
    nodes.map((n) => textNodes(n as unknown as Node).join(" ")).join(" "),
  );
  if (body.length < 10) throw new Error("empty_body");
  if (body.length > 80000) {
    throw new Error("long_document_requires_chunked_reading");
  }
  if (c.date) {
    for (const n of document.querySelectorAll(c.date)) {
      const value = c.date_attribute
        ? n.getAttribute(c.date_attribute)
        : n.textContent;
      if (value) {
        observations.push({
          meaning: "official_published_attribute",
          locator: c.date,
          value: normalize(value),
        });
      }
    }
  }
  const dates = [
    ...new Set(
      observations.map((x) => expansionDate(x.value)).filter((d): d is string =>
        !!d
      ),
    ),
  ];
  const published = dates.length === 1 ? dates[0] : null;
  const listingDate = row ? expansionListingDate(row) : null;
  const conflict = dates.length > 1 ||
    !!(published && listingDate && published !== listingDate);
  return {
    title_original: normalize(title.textContent || ""),
    content_text: body,
    content_hash: await sha(body),
    published_date: published,
    metadata: {
      normalization_version: "main-body-nfc-v1",
      parser_version: "edge-expansion-v1",
      read_scope: "official_press_or_news_body",
      date_observations: [...observations, ...(row?.date_observations || [])],
      date_conflict: conflict,
      date_resolution: null,
      requires_review: !published || conflict,
      related_documents: related,
      unresolved_links: [] as { href: string; title: string; reason: string }[],
      unread_attachments: related.map((x) => x.url),
      factual_status: "original_statement_not_independent_legal_finding",
      // This is input readiness for the existing Korean drafting worker,
      // never review approval or permission to publish.
      ai_ready: !!published && !conflict,
    },
  };
}
