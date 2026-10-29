import { discover, extract } from "./adapter.ts";
import { advance } from "./runtime.ts";
import {
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
