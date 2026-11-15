import { discover, extract } from "./adapter.ts";
import { expansionCandidates, probe } from "./expansion-probe.ts";
import { advance, recordListingPage } from "./runtime.ts";
import {
  additionalListing,
  detailRequestUrl,
  expansionListingDate,
  listingRequestUrl,
  nextWithinWindow,
  verifyDetailResponse,
} from "./expansion.ts";
import routes from "./expansion-routes.json" with { type: "json" };
import manifest from "../../../tests/fixtures/collector-expansion/manifest.json" with {
  type: "json",
};
const fixture = (name: string) =>
  Deno.readTextFile(
    new URL(
      `../../../tests/fixtures/collector-expansion/${name}`,
      import.meta.url,
    ),
  );
function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
// These routes have no committed, reproducible listing+detail capture in this
// fixture suite. Keep them visible as gaps instead of fabricating “observed”
// fixture content or letting the generic route loop fail on missing files.
const fixtureEvidenceGaps: Record<string, string> = {
  ripd: "Official RSS/detail were previously observed, but no captured listing and detail pair is committed here.",
  ftc: "Current official route has no captured listing and detail fixture pair; route remains separately subject to robots/access review.",
  "g7-dpa": "The route points to a cross-agency OPC membership hub; no reproducible listing and detail fixture pair is committed here.",
};
Deno.test("EUR-Lex explicit user hold rejects before any network-capable path", async () => {
  assert(!("eur-lex" in expansionCandidates));
  let rejected = false;
  try {
    await probe("eur-lex");
  } catch (error) {
    rejected = error instanceof Error && error.message === "source_held_by_user";
  }
  assert(rejected, "held source must fail before URL lookup or HTTP client creation");
});
Deno.test("route fixture gaps are explicit and have no fabricated captures", async () => {
  for (const [source, reason] of Object.entries(fixtureEvidenceGaps)) {
    assert(reason.length > 20, `${source} must state why fixture verification is absent`);
    for (const suffix of ["listing.html", "detail.html"]) {
      let exists = true;
      try {
        await Deno.stat(
          new URL(`../../../tests/fixtures/collector-expansion/${source}-${suffix}`, import.meta.url),
        );
      } catch (error) {
        exists = !(error instanceof Deno.errors.NotFound);
        if (exists) throw error;
      }
      assert(!exists, `${source}-${suffix} now exists; add evidence-based route coverage instead of keeping this gap`);
    }
  }
});
Deno.test("listing pages are not truncated at 400 rows", () => {
  const rows = Array.from({ length: 401 }, (_, i) => ({
    url: `https://www.example.test/news/${i}`,
    title: `Privacy item ${i}`,
  }));
  const next = recordListingPage(rows, [], "page-401");
  assert(next.length === 1);
});
Deno.test("listing cycle detection retains fingerprints beyond 50 pages", () => {
  let seen: string[] = [];
  for (let i = 0; i < 60; i++) {
    seen = recordListingPage([{ url: `https://www.example.test/${i}`, title: `Item ${i}` }], seen, `page-${i}`);
  }
  let caught = false;
  try {
    recordListingPage([{ url: "https://www.example.test/repeated", title: "Repeated" }], seen, "page-0");
  } catch (error) {
    caught = error instanceof Error && error.message === "listing_cycle";
  }
  assert(caught, "cycle older than 50 pages must still be detected");
});
Deno.test("EC official search receives explicit whole-day discovery bounds", () => {
  const u = new URL(
    listingRequestUrl("ec", routes.ec.listing, "2026-10-26", "2026-10-28"),
  );
  assert(u.pathname === "/commission/presscorner/api/search");
  assert(u.searchParams.get("datefrom") === "26102026");
  assert(u.searchParams.get("dateto") === "29102026");
  assert(u.searchParams.get("pagesize") === "10");
});
Deno.test("an empty validated date-scoped EC result is a normal no-material result", () => {
  const found = discover(
    "ec",
    JSON.stringify({
      totalNumber: 0,
      pageSize: 10,
      pageNumber: 1,
      docuLanguageListResources: [],
    }),
    listingRequestUrl("ec", routes.ec.listing, "2026-10-26", "2026-10-28"),
  );
  assert(found.rows.length === 0 && found.next === null);
});
Deno.test("EC accepts observed zero-based response page and retains eventDate", async () => {
  const data = JSON.parse(await fixture("ec-listing.json"));
  data.pageNumber = 0;
  data.docuLanguageListResources[0].eventDate = "2026-10-28T09:00:00+02:00";
  const found = discover(
    "ec",
    JSON.stringify(data),
    listingRequestUrl("ec", routes.ec.listing, "2026-10-26", "2026-10-28"),
  );
  assert(found.rows.length === data.totalNumber);
  assert(expansionListingDate(found.rows[0]) === "2026-10-28");
});
Deno.test("CA OPC Advice to Parliament is an approved paginated listing stream", async () => {
  const listing = additionalListing("ca-opc", 1)!;
  assert(listing === "https://www.priv.gc.ca/en/opc-actions-and-decisions/advice-to-parliament/?Filter=True&Page=1&o=d");
  const found = discover(
    "ca-opc",
    '<main><section aria-label="Main content"><div class="entry"><time datetime="2026-11-02">November 2, 2026</time><h2><a href="/en/opc-actions-and-decisions/advice-to-parliament/2026/parl_261102/">Statement by the Privacy Commissioner of Canada on Bill C-22</a></h2></div><div class="entry"><time datetime="2026-10-07">October 7, 2026</time><h2><a href="/en/opc-actions-and-decisions/advice-to-parliament/2026/parl_261007/">Statement by the Privacy Commissioner of Canada on security screening</a></h2></div><ul><li class="next"><a rel="next" href="?o=d&amp;Page=2&amp;Filter=True">Next</a></li></ul></section></main>',
    listing,
  );
  assert(found.rows.length === 2);
  assert(expansionListingDate(found.rows[0]) === "2026-11-02");
  assert(found.rows[0].url.endsWith("/parl_261102/"));
  assert(found.next?.includes("Page=2"));
});
Deno.test("Parliament canonical slugs may change but the official article ID must match", () => {
  const u = manifest["eu-parliament"].url!;
  verifyDetailResponse("eu-parliament", u, u + "official-title");
  let rejected = false;
  try {
    verifyDetailResponse("eu-parliament", u, u.replace("IPR48312", "IPR99999"));
  } catch {
    rejected = true;
  }
  assert(rejected);
});
Deno.test("EC preserves separately supplied official quotations and attribution", async () => {
  const item = await extract(
    "ec",
    await fixture("ec-detail.json"),
    manifest.ec.url,
  );
  assert(item.content_text.includes("Roxana Mînzatu"));
  assert(item.content_text.includes("We can see from the findings"));
});
for (const [source, c] of Object.entries(routes)) {
  if (source in fixtureEvidenceGaps) continue;
  Deno.test(`${source}: observed official listing and full detail, no date inference`, async () => {
    const ext = source === "ec"
      ? "json"
      : source === "eu-parliament"
      ? "xml"
      : "html";
    const found = discover(
      source,
      await fixture(`${source}-listing.${ext}`),
      c.listing,
    );
    assert(found.rows.length > 0, "listing empty");
    assert(found.rows.every((r) => new URL(r.url).hostname === c.host));
    const m = manifest[source as keyof typeof manifest];
    const item = await extract(
      source,
      await fixture(`${source}-detail.${source === "ec" ? "json" : "html"}`),
      m.url!,
    );
    assert(item.title_original.length > 10);
    assert(item.content_text.length > 100);
    assert(
      item.published_date === m.published_date,
      `${item.published_date} != ${m.published_date}`,
    );
    assert(item.metadata.read_scope === "official_press_or_news_body");
    assert(
      item.metadata.ai_ready === !item.metadata.requires_review,
      "verified official body must reach the existing draft queue",
    );
  });
}
Deno.test("OAIC unwrapped article identity excludes tracking tokens and rejects external redirect targets", async () => {
  const html = await fixture("oaic-listing.html");
  const r = discover("oaic", html, routes.oaic.listing).rows[0];
  assert(!r.url.includes("auth="));
  assert(expansionListingDate(r) === "2026-10-26");
  let rejected = false;
  try {
    discover(
      "oaic",
      html.replaceAll(
        "https%3A%2F%2Fwww.oaic.gov.au",
        "https%3A%2F%2Fevil.example",
      ),
      routes.oaic.listing,
    );
  } catch {
    rejected = true;
  }
  assert(rejected);
});
Deno.test("AEPD uses the card heading and its official publication time, never the 'read more' link text", async () => {
  const found = discover(
    "es-aepd",
    await fixture("es-aepd-listing.html"),
    routes["es-aepd"].listing,
  );
  assert(found.rows.length === 1);
  assert(found.rows[0].title.startsWith("La Agencia y la autoridad"));
  assert(expansionListingDate(found.rows[0]) === "2026-10-19");
  const detail = await extract(
    "es-aepd",
    await fixture("es-aepd-detail.html"),
    found.rows[0].url,
    found.rows[0],
  );
  assert(detail.published_date === "2026-10-19");
  assert(detail.metadata.date_conflict === false);
  let rejected = false;
  try {
    discover("es-aepd", '<a class="more-link" href="https://evil.example/noticia">X</a>', routes["es-aepd"].listing);
  } catch { rejected = true; }
  assert(rejected);
});
Deno.test("EC retrieves official body API using document reference, never SPA shell or law text", () => {
  assert(
    detailRequestUrl(
      "ec",
      "https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2274",
    ) ===
      "https://ec.europa.eu/commission/presscorner/api/documents?language=en&reference=IP%2F26%2F2274",
  );
  let rejected = false;
  try {
    detailRequestUrl(
      "ec",
      "https://evil.example/commission/presscorner/detail/en/ip_26_2274",
    );
  } catch {
    rejected = true;
  }
  assert(rejected);
});
Deno.test("TC260 follows observed archive paging; dated descending pages stop at the daily boundary", async () => {
  const found = discover(
    "cn-tc260",
    await fixture("cn-tc260-listing.html"),
    routes["cn-tc260"].listing,
  );
  assert(found.next === "https://www.tc260.org.cn/tc260/tzgg/list_2.shtml");
  const oaic = discover(
    "oaic",
    await fixture("oaic-listing.html"),
    routes.oaic.listing,
  );
  assert(oaic.next);
  assert(nextWithinWindow("oaic", oaic, "2026-10-24") === null);
  const unknown = {
    rows: [{
      url: "https://www.oaic.gov.au/news/media-centre/test",
      title: "unknown",
    }],
    next: oaic.next,
  };
  assert(nextWithinWindow("oaic", unknown, "2026-10-24") === oaic.next);
});
Deno.test("changed template, bot page, missing publication date and modified date cannot silently pass", async () => {
  for (
    const html of [
      "",
      "<script>document.cookie='EO_Bot_Ssid=1'</script>",
      "<main><h1>Unavailable</h1></main>",
    ]
  ) {
    let rejected = false;
    try {
      discover("oaic", html, routes.oaic.listing);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
  const html = (await fixture("ca-opc-detail.html")).replaceAll(
    'name="dcterms.issued"',
    'name="dcterms.modified"',
  );
  const item = await extract("ca-opc", html, manifest["ca-opc"].url!);
  assert(item.published_date === null);
  assert(item.metadata.requires_review);
});
Deno.test("expanded source daily window excludes only individually dated out-of-range rows", async () => {
  const c = {
    ...routes.oaic,
    source: "oaic",
    source_id: "test",
    hosts: [routes.oaic.host],
    language: "en",
  };
  let fetched = false;
  const step = await advance(c, {
    since: "2026-10-27",
    until: "2026-10-29",
    rows: [{
      url: manifest.oaic.url!,
      title: "old",
      date_observations: [{
        meaning: "expansion_listing_published",
        locator: "oaic .info .date",
        value: "26 October 2026",
      }],
    }],
  }, {
    request: async () => {
      fetched = true;
      throw Error("unexpected_fetch");
    },
  }, async () => {
    throw Error("unexpected_store");
  });
  assert(!fetched);
  assert(step.result.saved === "out_of_range");
  assert(step.state.offset === 1);
});
