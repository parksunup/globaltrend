import { canonical, dpcListingDate, discover, extract, icoPublishedDate, parseDate } from "./adapter.ts";
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
Deno.test("DPC listing preserves the one displayed teaser publication date", () => {
  const p = discover(
    "dpc",
    '<main><article class="node--view-mode-teaser"><h2><a href="/en/news-media/latest-news/example">Example</a></h2><p class="date">01st October 2026</p></article></main>',
    "https://www.dataprotection.ie/en/news-media/latest-news",
  );
  eq(p.rows[0]?.date_observations, [{
    meaning: "listing_published_display",
    locator: "listing article.node--view-mode-teaser p.date",
    value: "01st October 2026",
  }]);
  eq(dpcListingDate(p.rows[0]), "2026-10-01");
});
Deno.test("DPC listing date is used only for one exact valid observation", () => {
  const observation = {
    meaning: "listing_published_display",
    locator: "listing article.node--view-mode-teaser p.date",
    value: "01st October 2026",
  };
  eq(dpcListingDate({ url: "https://www.dataprotection.ie/a", title: "A" }), null);
  eq(dpcListingDate({ url: "https://www.dataprotection.ie/a", title: "A", date_observations: [observation, observation] }), null);
  eq(dpcListingDate({ url: "https://www.dataprotection.ie/a", title: "A", date_observations: [{ ...observation, value: "31st February 2026" }] }), null);
  eq(dpcListingDate({ url: "https://www.dataprotection.ie/a", title: "A", date_observations: [{ ...observation, value: "01th October 2026" }] }), null);
  eq(dpcListingDate({ url: "https://www.dataprotection.ie/a", title: "A", date_observations: [{ ...observation, locator: "page body" }] }), null);
});
Deno.test("DPC listing date fills a missing detail date but conflicts stay unknown", async () => {
  const row = {
    url: "https://www.dataprotection.ie/en/news-media/latest-news/example",
    title: "Example",
    date_observations: [{
      meaning: "listing_published_display",
      locator: "listing article.node--view-mode-teaser p.date",
      value: "01st October 2026",
    }],
  };
  const missing = await extract(
    "dpc",
    '<h1>Example</h1><main><div class="field--name-body"><p>A complete original data protection article body.</p></div></main>',
    row.url,
    row,
  );
  eq(missing.published_date, "2026-10-01");
  eq(missing.metadata.ai_ready, true);
  eq(missing.metadata.date_observations[0].value, "01st October 2026");
  const conflict = await extract(
    "dpc",
    '<h1>Example</h1><main><p class="date">02nd October 2026</p><div class="field--name-body"><p>A complete original data protection article body.</p></div></main>',
    row.url,
    row,
  );
  eq(conflict.published_date, null);
  eq(conflict.metadata.ai_ready, false);
  eq(conflict.metadata.date_observations.length, 2);
  const ambiguous = await extract(
    "dpc",
    '<h1>Example</h1><main><div class="field--name-body"><p>A complete original data protection article body.</p></div></main>',
    row.url,
    { ...row, date_observations: [
      row.date_observations![0],
      { ...row.date_observations![0], value: "02nd October 2026" },
    ] },
  );
  eq(ambiguous.published_date, null);
  eq(ambiguous.metadata.ai_ready, false);
  eq(ambiguous.metadata.date_observations.length, 2);
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
Deno.test("ICO scope checks use only the explicit DC publication date", () => {
  eq(icoPublishedDate('<meta name="DC.Date" content="Monday, February 16, 2026">'), {
    date: "2026-02-16",
    value: "Monday, February 16, 2026",
  });
  eq(icoPublishedDate('<title>News 16 February 2026</title>'), null);
});
Deno.test("ICO extraction uses explicit Dublin Core publication date", async () => {
  const x = await extract(
    "ico",
    '<html><head><meta name="DC.Date" content="Monday, October 12, 2026"></head><body><h1>Privacy enforcement notice</h1><main><div class="rich-text"><div class="prose"><p>A sufficiently long official article body.</p></div></div></main></body></html>',
    "https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/10/example/",
  );
  eq(x.published_date, "2026-10-12");
  eq(x.metadata.date_observations[0], {
    meaning: "official_published_attribute",
    locator: 'meta[name="DC.Date"]@content',
    value: "Monday, October 12, 2026",
  });
  eq(x.metadata.ai_ready, true);
});

Deno.test("DPC detail publication date wins over conflicting teaser date with review", async () => {
  const x = await extract(
    "dpc",
    '<h1>Privacy notice</h1><main><p class="date">12 October 2026</p><div class="field--name-body"><p>A sufficiently detailed DPC publication body.</p></div></main>',
    "https://www.dataprotection.ie/en/news-media/latest-news/example",
    { url: "https://www.dataprotection.ie/en/news-media/latest-news/example", title: "Privacy notice", date_observations: [{ meaning: "listing_published_display", locator: "listing article.node--view-mode-teaser p.date", value: "11th October 2026" }] },
  );
  eq(x.published_date, "2026-10-12");
  eq(x.metadata.date_conflict, true);
  eq(x.metadata.requires_review, true);
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
Deno.test("PPC poster contest opening dateline is a publication date", async () => {
  const x = await extract("ppc", '<title>「個人情報に関するポスターコンクール」を開催します</title><h1 class="page-ttl">「個人情報に関するポスターコンクール」を開催します</h1><main class="l-main"><div class="l-article"><p>令和８年6月１日</p><p>個人情報保護委員会</p><p>「個人情報に関するポスターコンクール」を開催します。報道発表資料を掲載します。</p></div></main>', "https://www.ppc.go.jp/news/press/2026/260601");
  eq(x.published_date, "2026-06-01");
  eq(x.metadata.ai_ready, false);
  eq(x.metadata.date_observations.at(-1)?.meaning, "published_opening_dateline");
});
Deno.test("PPC privacy awareness week opening dateline is a publication date", async () => {
  const x = await extract("ppc", '<title>令和８年度「個人情報を考える週間」について</title><h1 class="page-ttl">令和８年度「個人情報を考える週間」について</h1><main class="l-main"><div class="l-article"><p>令和８年６月22日</p><p>個人情報保護委員会</p><p>令和８年度「個人情報を考える週間」について。６月22日に報道発表を行いました。</p><a href="/news/privacy_awareness_week/">週間の案内</a></div></main>', "https://www.ppc.go.jp/news/press/2026/26%20622");
  eq(x.published_date, "2026-06-22");
  eq(x.metadata.ai_ready, false);
  eq(x.metadata.date_observations.at(-1)?.meaning, "published_opening_dateline");
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
  eq(item.published_date, "2026-10-20");
  eq(item.metadata.date_conflict, true);
  eq(item.metadata.requires_review, true);
});

Deno.test("PDPC exact detail publication label wins over conflicting card date", async () => {
  const article = ["$", "main", null, { className: "layout layout--standard", children: [
    ["$", "article", null, { children: [["$", "$L26", null, { data: { content: "<p>A sufficiently complete PDPC advisory body.</p>" } }]] }],
  ] }];
  const html = `<main><h1>Advisory</h1><span class="page-banner__date">Published on 30 Sep 2026</span><main class="layout layout--standard"><article></article></main></main><script>self.__next_f.push(${JSON.stringify([1, "24:" + JSON.stringify(article) + "\n"])})</script>`;
  const item = await extract("pdpc", html, "https://www.pdpc.gov.sg/media-events/advisory", {
    url: "https://www.pdpc.gov.sg/media-events/advisory",
    title: "Advisory",
    date_observations: [{ meaning: "listing_published_display", locator: "card", value: "29 Sep 2026" }],
  });
  eq(item.published_date, "2026-09-30");
  eq(item.metadata.date_conflict, true);
  eq(item.metadata.requires_review, true);
  const ambiguous = await extract("pdpc", html.replace("Published on 30 Sep 2026", "Updated on 30 Sep 2026"), "https://www.pdpc.gov.sg/media-events/advisory", {
    url: "https://www.pdpc.gov.sg/media-events/advisory",
    title: "Advisory",
    date_observations: [{ meaning: "listing_published_display", locator: "card", value: "29 Sep 2026" }],
  });
  eq(ambiguous.published_date, null);
  eq(ambiguous.metadata.requires_review, true);
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
  eq(item.metadata.read_scope, "official_article_html_or_embedded_rsc");
  eq(item.published_date, "2026-10-18");
});

Deno.test("PDPC uses rendered main-column article when Flight contains a 404 shell", async () => {
  const html = `<header class="page-banner"><h1>Singapore Data Festival 2026</h1></header>
    <main class="layout layout--standard"><div class="container"><div class="row">
    <nav class="side-nav col-lg-3">Navigation must not be collected</nav>
    <main class="col-lg-9"><article class="layout layout--standard">
    <div class="statistics"><h3>3000</h3><span>Attendees</span></div>
    <blockquote>Data governance matters more, not less, in the age of AI.</blockquote>
    <div class="article-card-cta">Related story must not be collected</div>
    <div class="image-gallery">Gallery controls must not be collected</div>
    </article></main></div></div></main>`;
  const item = await extract(
    "pdpc",
    html,
    "https://www.pdpc.gov.sg/media-events/singapore-data-festival-2026",
  );
  eq(item.title_original, "Singapore Data Festival 2026");
  eq(item.content_text.includes("Data governance matters"), true);
  eq(item.content_text.includes("Navigation must not"), false);
  eq(item.content_text.includes("Related story must not"), false);
  eq(item.content_text.includes("Gallery controls must not"), false);
  eq(item.published_date, null);
  eq(item.metadata.ai_ready, false);
  eq(item.metadata.read_scope, "official_article_html_or_embedded_rsc");
});
