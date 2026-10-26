import { canonical, discover, extract, parseDate } from "./adapter.ts";
const eq = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  }
};
Deno.test("OECD discovers publications and related press releases without inventing URLs", () => {
  const p = discover(
    "oecd",
    '<main><a href="/en/publications/p.html">Report</a><a href="/en/about/news/press-releases/2026/10/p.html">Press</a></main>',
    "https://www.oecd.org/en/topics/privacy-and-data-protection.html",
  );
  eq(p.rows.length, 2);
});
Deno.test("unknown and conflicting dates remain unready", async () => {
  const item = await extract(
    "edpb",
    '<h1 class="node-article-full__title">Notice</h1><time class="node-article-full__date" datetime="2026-10-20">21 October 2026</time><div class="node-article-full__body">A sufficiently long original body.</div>',
    "https://www.edpb.europa.eu/news/x",
  );
  eq(item.published_date, null);
  eq(item.metadata.ai_ready, false);
});
Deno.test("empty bodies fail instead of becoming no new materials", async () => {
  let failed = false;
  try {
    await extract(
      "edpb",
      '<h1 class="node-article-full__title">Notice</h1><div class="node-article-full__body"></div>',
      "https://www.edpb.europa.eu/news/x",
    );
  } catch {
    failed = true;
  }
  eq(failed, true);
});
Deno.test("official hosts, normalized hashes and scope are preserved", async () => {
  let failed = false;
  try {
    canonical("https://www.edpb.europa.eu.evil.test/a", ["www.edpb.europa.eu"]);
  } catch {
    failed = true;
  }
  eq(failed, true);
  const x = await extract(
    "oecd",
    '<h1 class="cmp-report-header__title">Report</h1><time>21 October 2026</time><div class="cmp-two-column-container"><h2 class="cmp-title__text">Abstract</h2><div class="cmp-text"><p>Cafe\u0301 report original body content.</p></div></div>',
    "https://www.oecd.org/en/publications/a.html",
  );
  eq(x.metadata.read_scope, "official_abstract");
  eq(x.content_text, "Café report original body content.");
  eq(x.content_hash.length, 64);
});
Deno.test("invalid complete dates are rejected", () => {
  eq(parseDate("31 February 2026"), null);
  eq(parseDate("21 October 2026"), "2026-10-21");
});
Deno.test("displayed ordinal publication dates remain valid without inference", () => {
  eq(parseDate("01st October 2026"), "2026-10-01");
});
Deno.test("RSS links are XML text nodes rather than HTML void elements", () => {
  const p = discover(
    "ftc",
    '<?xml version="1.0"?><rss><channel><item><title>A real title</title><link>https://www.ftc.gov/news-events/news/press-releases/a</link></item></channel></rss>',
    "https://www.ftc.gov/feed.xml",
  );
  eq(p.rows[0]?.url, "https://www.ftc.gov/news-events/news/press-releases/a");
});
Deno.test("historical fullwidth Japanese dates preserve the original date meaning", () => {
  eq(parseDate("令和８年７月17日"), "2026-07-17");
});
Deno.test("HTML extraction preserves historical Python text-node normalization", async () => {
  const x = await extract(
    "edpb",
    '<h1 class="node-article-full__title">Notice</h1><time class="node-article-full__date">21 October 2026</time><div class="node-article-full__body"><p>See the <a href="/report">official report</a>.</p><p>The <strong>next</strong> step.</p></div>',
    "https://www.edpb.europa.eu/news/x",
  );
  eq(x.content_text, "See the official report . The next step.");
});
Deno.test("malformed source links remain unresolved and never become invented URLs", async () => {
  const raw =
    "https://Uber fined nearly 825 million euros for automated driver blocking";
  const x = await extract(
    "edpb",
    `<h1 class="node-article-full__title">Notice</h1><time class="node-article-full__date">21 October 2026</time><div class="node-article-full__body"><p>Original body with an <a href="${raw}">underlying decision</a>.</p></div>`,
    "https://www.edpb.europa.eu/news/x",
  );
  eq(x.metadata.related_documents.length, 0);
  eq(x.metadata.unresolved_links[0].href, raw);
  eq(x.metadata.ai_ready, false);
  eq(x.content_text, "Original body with an underlying decision .");
});

Deno.test("PPC official notice dateline excludes body dates and keeps PDFs unread", async () => {
  const x = await extract("ppc", '<html><head><title>法律の公布について（令和８年７月17日）</title></head><body><h1 class="page-ttl">法律の公布について</h1><main class="l-main"><div class="l-article"><div class="date-box mb-m">令和８年７月17日<br>個人情報保護委員会</div><p>令和８年４月７日に提出、令和８年７月10日に成立。</p><a href="/files/pdf/260717_houritsu.pdf">法律</a></div></main></body></html>', "https://www.ppc.go.jp/news/press/2026/260717/");
  eq(x.published_date, "2026-07-17");
  eq(x.metadata.ai_ready, false);
  eq(x.metadata.related_documents[0].read, false);
  eq(x.metadata.date_observations[0].meaning, "published_notice_dateline");
});
Deno.test("PPC conflicting publication title and notice dateline remain unknown", async () => {
  const x = await extract("ppc", '<html><head><title>公表（令和８年７月18日）</title></head><body><h1 class="page-ttl">Notice</h1><main class="l-main"><div class="l-article"><div class="date-box">令和８年７月17日<br>個人情報保護委員会</div><p>Original notice body.</p></div></main></body></html>', "https://www.ppc.go.jp/news/press/a/");
  eq(x.published_date, null);
  eq(x.metadata.ai_ready, false);
});
Deno.test("PPC body revision dates never become publication dates", async () => {
  const x = await extract("ppc", '<h1 class="page-ttl">注意喚起</h1><main class="l-main"><p>令和６年12月11日、令和８年10月７日改訂。令和８年10月９日追加。</p></main>', "https://www.ppc.go.jp/news/careful_information/261007_alert/");
  eq(x.published_date, null);
  eq(x.metadata.ai_ready, false);
});
Deno.test("CNIL keeps card-local dates and detail conflicts unresolved", async () => {
  const p = discover(
    "cnil",
    '<main><div class="list-inner"><h3 class="ctn-gen-liste-titre"><a href="/fr/a">A</a></h3><div class="attributes"><p class="date">27 mars 2024</p></div></div></main>',
    "https://www.cnil.fr/fr/actualites",
  );
  eq(p.rows[0].date_observations?.[0].value, "27 mars 2024");
  const item = await extract(
    "cnil",
    '<main><h1>A</h1><div class="ctn-gen-auteur">20 octobre 2026</div><div class="ctn-gen-body">Personal data protection evidence.</div></main>',
    p.rows[0].url,
    p.rows[0],
  );
  eq(item.published_date, null);
  eq(item.metadata.requires_review, true);
});


Deno.test("PDPC extracts article content through nested Flight layout wrappers", async () => {
  const element = (type: string, props: Record<string, unknown> = {}) =>
    [null, type, null, props];
  const article = element("article", {
    children: [
      element("div", {
        data: { content: "<p>PDPC article body with enough detail.</p>" },
      }),
    ],
  });
  const root = element("main", {
    className: "layout layout--standard",
    children: [
      element("div", {
        className: "container",
        children: [
          element("div", {
            className: "row",
            children: [
              element("main", {
                className: "col-lg-9",
                children: [article],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  const flight = "0:" + JSON.stringify(root) + "\n";
  const html =
    '<main><h1>PDPC title</h1><div class="page-banner__date">18 October 2026</div></main>' +
    "<script>self.__next_f.push(" + JSON.stringify([1, flight]) + ");</script>";
  const item = await extract(
    "pdpc",
    html,
    "https://www.pdpc.gov.sg/media-events/example",
  );
  eq(item.title_original, "PDPC title");
  eq(item.content_text, "PDPC article body with enough detail.");
  eq(item.metadata.read_scope, "news_html_from_embedded_rsc");
  eq(item.published_date, "2026-10-18");
});
