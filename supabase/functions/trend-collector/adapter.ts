import { DOMParser, parseHTML } from "npm:linkedom@0.18.12";
export type Row = {
  url: string;
  title: string;
  date_observations?: Observation[];
};
type Observation = { meaning: string; locator: string; value: string };
export const normalize = (x: string) =>
  x.normalize("NFC").replace(/\s+/gu, " ").trim();
export function canonical(value: string, hosts: string[]): string {
  const u = new URL(value);
  if (
    u.protocol !== "https:" || !hosts.includes(u.hostname) || u.username ||
    u.password || u.port && u.port !== "443"
  ) throw new Error("unapproved_url");
  for (const k of [...u.searchParams.keys()]) {
    if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  }
  u.hash = "";
  u.searchParams.sort();
  return u.href;
}
export function parseDate(value: string): string | null {
  const s = normalize(value).replace(
    /[０-９]/g,
    (c) => String(c.charCodeAt(0) - 0xFF10),
  ).toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:t.*)?$/);
  const era = s.match(/(令和|平成)(元|\d+)年\s*(\d+)月\s*(\d+)日/);
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const fr = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  if (iso) [y, m, d] = iso.slice(1).map(Number);
  else if (era) {
    const n = era[2] === "元" ? 1 : Number(era[2]);
    if (n < 1) return null;
    [y, m, d] = [
      (era[1] === "令和" ? 2018 : 1988) + n,
      Number(era[3]),
      Number(era[4]),
    ];
  } else {
    const a = s.match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/),
      b = s.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (!a && !b) return null;
    const mon = a ? a[2] : b![1];
    m = months.findIndex((x) => x === mon || x.slice(0, 3) === mon) + 1;
    if (!m) m = fr.indexOf(mon) + 1;
    y = Number((a || b)![3]);
    d = Number(a ? a[1] : b![2]);
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) return null;
  const out = date.toISOString().slice(0, 10);
  if (
    era &&
    (era[1] === "令和" && out < "2019-05-01" ||
      era[1] === "平成" && (out < "1989-01-08" || out > "2019-04-30"))
  ) return null;
  return out;
}
export const sha = async (s: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ].map((x) => x.toString(16).padStart(2, "0")).join("");
export function discover(
  source: string,
  html: string,
  url: string,
): { rows: Row[]; next: string | null } {
  const { document } = parseHTML(html);
  const abs = (s: string) => new URL(s, url).href;
  if (source === "ftc" && /<rss/i.test(html.slice(0, 1000))) {
    if (/<!DOCTYPE|<!ENTITY/i.test(html)) {
      throw new Error("xml_entities_rejected");
    }
    const xml = new DOMParser().parseFromString(html, "text/xml");
    return {
      rows: [...xml.querySelectorAll("item")].map((x) => ({
        url: normalize(x.querySelector("link")?.textContent || ""),
        title: normalize(x.querySelector("title")?.textContent || ""),
      })).filter((x) => x.url),
      next: null,
    };
  }
  const selectors: Record<string, string> = {
    edpb: 'main a[href*="/news/"]',
    cnil: "main .ctn-gen-liste-titre a[href]",
    dpc: "main article.node--view-mode-teaser h2 a[href]",
    ppc: "main .news-list .news-text a[href]",
    oecd:
      'main a[href*="/publications/"],main a[href*="/about/news/press-releases/"]',
    ftc: 'main a[href*="/news-events/news/press-releases/"]',
    curia: "main .curia-itemlist-item .curia-itemlist-item-title a[href]",
  };
  if (!selectors[source]) throw new Error("dynamic_listing_requires_adapter");
  let base = url;
  const baseHref = document.querySelector("base[href]")?.getAttribute("href");
  if (baseHref) {
    base = canonical(new URL(baseHref, url).href, [new URL(url).hostname]);
  }
  const rows = new Map<string, Row>();
  for (const a of document.querySelectorAll(selectors[source])) {
    const target = new URL(a.getAttribute("href")!, base).href;
    if (source === "curia" && !new URL(target).pathname.endsWith("en.pdf")) {
      continue;
    }
    let title = normalize(a.textContent || "");
    if (!title && source === "edpb") {
      title = normalize(
        a.closest(".node-article-card")?.querySelector(
          ".node-article-card__title",
        )?.textContent || "",
      );
    }
    const row: Row = { url: target, title };
    if (source === "cnil") {
      row.date_observations = [
        ...(a.closest(".list-inner")?.querySelectorAll(".attributes p.date") ||
          []),
      ].map((n) => ({
        meaning: "listing_published_display",
        locator: "listing .list-inner .attributes p.date",
        value: normalize(n.textContent || ""),
      }));
    }
    if (source === "curia") {
      const t = a.closest(".curia-itemlist-item")?.querySelector("time");
      row.date_observations = t
        ? [
          {
            meaning: "published_display",
            locator: "listing time",
            value: normalize(t.textContent || ""),
          },
          ...(t.getAttribute("datetime")
            ? [{
              meaning: "published_attribute",
              locator: "listing time@datetime",
              value: t.getAttribute("datetime")!,
            }]
            : []),
        ]
        : [];
    }
    rows.set(target, row);
  }
  const next = document.querySelector(
    'a[rel~="next"],.pager__item--next a,.pager-next a,.pagination li.next:not(.disabled) a[href]',
  );
  return {
    rows: [...rows.values()],
    next: next ? abs(next.getAttribute("href")!) : null,
  };
}
export function pdpcContent(document: Document): Element[] {
  const chunks: string[] = [];
  for (const script of document.querySelectorAll("script:not([src])")) {
    const text = (script.textContent || "").trim();
    if (!text.startsWith("self.__next_f.push(")) continue;
    const v = JSON.parse(
      text.slice("self.__next_f.push(".length).replace(/\);?$/, ""),
    );
    if (Array.isArray(v) && v[0] === 1 && typeof v[1] === "string") {
      chunks.push(v[1]);
    }
  }
  const stream = new TextEncoder().encode(chunks.join("")),
    decoder = new TextDecoder("utf-8", { fatal: true });
  const records = new Map<string, unknown>();
  let pos = 0;
  while (pos < stream.length) {
    if (stream[pos] === 10) {
      pos++;
      continue;
    }
    const end = stream.indexOf(58, pos);
    if (end < pos) throw new Error("pdpc_record_header");
    const id = decoder.decode(stream.slice(pos, end));
    if (!/^[a-f0-9]*$/.test(id)) throw new Error("pdpc_record_header");
    pos = end + 1;
    let value: unknown;
    if (stream[pos] === 84) {
      const comma = stream.indexOf(44, pos);
      const count = parseInt(decoder.decode(stream.slice(pos + 1, comma)), 16);
      if (
        !Number.isFinite(count) || comma < 0 ||
        comma + 1 + count > stream.length
      ) throw new Error("pdpc_text_truncated");
      pos = comma + 1;
      value = decoder.decode(stream.slice(pos, pos + count));
      pos += count;
    } else {
      let e = stream.indexOf(10, pos);
      if (e < 0) e = stream.length;
      const s = decoder.decode(stream.slice(pos, e));
      pos = e;
      if (!/^[\[{"]|^(null|true|false)$/.test(s)) continue;
      value = JSON.parse(s);
    }
    if (records.has(id)) throw new Error("pdpc_duplicate_record");
    records.set(id, value);
  }
  const nodes: Element[] = [];
  // Only content props under the standard main/article, never navigation or shell.
  for (const v of records.values()) {
    const main = v as [
      unknown,
      string,
      unknown,
      { className?: string; children?: unknown[] },
    ];
    if (
      !Array.isArray(main) || main[1] !== "main" ||
      main[3]?.className !== "layout layout--standard"
    ) continue;
    for (const a of main[3].children || []) {
      const article = a as typeof main;
      if (!Array.isArray(article) || article[1] !== "article") continue;
      for (const c of article[3]?.children || []) {
        const component = c as [
          unknown,
          unknown,
          unknown,
          { data?: { content?: unknown } },
        ];
        let content = component?.[3]?.data?.content;
        if (typeof content === "string" && /^\$[a-f0-9]+$/.test(content)) {
          content = records.get(content.slice(1));
        }
        if (content === undefined) continue;
        if (typeof content !== "string" || content.startsWith("$")) {
          throw new Error("pdpc_content_unresolved");
        }
        nodes.push(
          parseHTML("<div>" + content + "</div>").document.querySelector(
            "div",
          )!,
        );
      }
    }
  }
  if (!nodes.length) throw new Error("pdpc_article_missing");
  return nodes;
}
export async function extract(
  source: string,
  html: string,
  url: string,
  row?: Row,
) {
  const { document } = parseHTML(html);
  const selectors: Record<string, [string, string | null, string[]]> = {
    edpb: [".node-article-full__title", "time.node-article-full__date", [
      ".node-article-full__body",
    ]],
    cnil: ["main h1", "main .ctn-gen-auteur", [
      "main .page-introduction",
      "main .ctn-gen-body",
      "main .ctn-gen-after .ctn-gen-ascenseur",
    ]],
    dpc: ["h1", "main p.date", ["main .field--name-body"]],
    ftc: ["h1", "article.node--view-mode-banner time", [
      "main article.node--view-mode-full .field--name-body",
    ]],
    ppc: ["h1.page-ttl", null, ["main.l-main"]],
    ico: ["h1", null, ["main .rich-text .prose"]],
    oecd: ["h1.cmp-report-header__title", "time", []],
    pdpc: ["main h1", "main .page-banner__date", []],
  };
  if (!selectors[source]) throw new Error("unverified_template");
  const [ts, ds, bs] = selectors[source];
  let title = document.querySelector(ts);
  let dateNode = ds ? document.querySelector(ds) : null;
  if (source === "ico") {
    dateNode = [...document.querySelectorAll("span")].find((x) =>
      x.textContent?.trim() === "Date"
    )?.nextElementSibling || null;
  }
  let nodes = bs.flatMap((x) => [...document.querySelectorAll(x)]);
  let scope = "news_html";
  if (source === "pdpc") {
    nodes = pdpcContent(document as unknown as Document);
    scope = "news_html_from_embedded_rsc";
  }
  if (source === "oecd") {
    scope = "official_abstract";
    const h = [...document.querySelectorAll("h2.cmp-title__text")].find((x) =>
      normalize(x.textContent || "").toLowerCase() === "abstract"
    );
    nodes = h
      ? [
        ...h.closest(".cmp-two-column-container")!.querySelectorAll(
          ".cmp-text p",
        ),
      ]
      : [];
    // A press release is a separate template, never mislabeled as a publication abstract.
    if (new URL(url).pathname.includes("/about/news/press-releases/")) {
      title = document.querySelector("h1");
      nodes = [...document.querySelectorAll("main .cmp-text")];
      scope = "press_release_html";
    }
  }
  if (!title || !nodes.length) throw new Error("title_or_body_missing");
  nodes = nodes.filter((n) =>
    !nodes.some((other) => other !== n && other.contains(n))
  );
  const related: { url: string; title: string; read: boolean }[] = [];
  const unresolvedLinks: { href: string; title: string; reason: string }[] = [];
  for (const n of nodes) {
    for (const a of n.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href")!;
      const title = normalize(a.textContent || "");
      try {
        const target = new URL(href, url);
        if (target.protocol === "https:") {
          related.push({ url: target.href, title, read: false });
        }
      } catch {
        unresolvedLinks.push({ href, title, reason: "malformed_source_href" });
      }
    }
  }
  for (const n of nodes) {
    for (
      const x of n.querySelectorAll(
        "nav,footer,script,style,.cookie-banner,.related-content,.field--name-field-related-content",
      )
    ) x.remove();
  }
  // Match BeautifulSoup get_text(' ', strip=True): separators between every
  // nonempty text node, including inline anchors and punctuation.
  const textNodes = (node: Node): string[] => {
    if (node.nodeType === 3) {
      return node.textContent?.trim() ? [node.textContent.trim()] : [];
    }
    return [...node.childNodes].flatMap(textNodes);
  };
  const body = normalize(
    nodes.map((n) => textNodes(n as unknown as Node).join(" ")).join(" "),
  );
  if (body.length < 10) throw new Error("empty_body");
  if (body.length > 80000) {
    throw new Error("long_document_requires_chunked_reading");
  }
  const observations: Observation[] = dateNode
    ? [
      {
        meaning: "published_display",
        locator: ds || "Date + strong",
        value: normalize(dateNode.textContent || ""),
      },
      ...(dateNode.getAttribute("datetime")
        ? [{
          meaning: "published_attribute",
          locator: "time@datetime",
          value: dateNode.getAttribute("datetime")!,
        }]
        : []),
    ]
    : [];
  if (row?.date_observations) observations.push(...row.date_observations);
  if (source === "ppc") {
    // The dedicated notice header excludes enactment/revision dates in prose.
    for (const dateline of document.querySelectorAll("main.l-main .l-article > .date-box")) {
      observations.push({
        meaning: "published_notice_dateline",
        locator: "main.l-main .l-article > .date-box",
        value: normalize(dateline.textContent || ""),
      });
    }
    const match = document.title.match(
      /公表[（(]((?:令和|平成)(?:元|[0-9０-９]+)年\s*[0-9０-９]+月\s*[0-9０-９]+日)[）)]/,
    );
    if (match) {
      observations.push({
        meaning: "published_title",
        locator: "document_title",
        value: match[1],
      });
    }
  }
  const dates = [
    ...new Set(observations.map((x) => parseDate(x.value)).filter(Boolean)),
  ];
  const date = dates.length === 1 ? dates[0] : null;
  const requiresReview = unresolvedLinks.length > 0 || !date ||
    source === "ppc" &&
      related.some((x) => new URL(x.url).pathname.endsWith(".pdf"));
  return {
    title_original: normalize(title.textContent || ""),
    content_text: body,
    content_hash: await sha(body),
    published_date: date,
    metadata: {
      normalization_version: "main-body-nfc-v1",
      parser_version: "edge-adapter-v2",
      read_scope: scope,
      date_observations: observations,
      requires_review: requiresReview,
      related_documents: related,
      unresolved_links: unresolvedLinks,
      unread_attachments: related.map((x) => x.url),
      factual_status: "original_statement_not_independent_legal_finding",
      ai_ready: !requiresReview,
    },
  };
}

export function cnilListingDate(row: Row): string | null {
  const obs = row.date_observations || [];
  if (
    obs.length !== 1 || obs[0].meaning !== "listing_published_display" ||
    obs[0].locator !== "listing .list-inner .attributes p.date"
  ) return null;
  const value = normalize(obs[0].value).toLowerCase();
  // Only an exact single French date may skip the detail request. Generic
  // parseDate accepts dates embedded in prose, which could mistake an update
  // date or label for the publication date and silently skip an in-range card.
  if (!/^\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}$/u.test(value)) {
    return null;
  }
  return parseDate(value);
}
