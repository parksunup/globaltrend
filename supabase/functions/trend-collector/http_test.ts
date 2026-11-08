import { OfficialHTTP } from "./http.ts";

Deno.test("robots 4xx unavailable permits page; 429 remains blocked", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/robots.txt")
      ? new Response("unavailable", { status: 403 })
      : new Response("article body", {
        headers: { "content-type": "text/html" },
      });
  try {
    const r = await new OfficialHTTP(["example.org"]).request(
      "https://example.org/news",
    );
    if (new TextDecoder().decode(r.bytes) !== "article body") {
      throw Error("not fetched");
    }
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("robots 429 reports its exact official URL and does not attempt the page", async () => {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response("rate limited", {
      status: String(input).endsWith("/robots.txt") ? 429 : 200,
    });
  };
  try {
    let error: unknown;
    try {
      await new OfficialHTTP(["ico.org.uk"]).request(
        "https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/?from=2026-11-01",
      );
    } catch (value) {
      error = value;
    }
    if (!(error instanceof Error) || error.message !== "http_429") {
      throw Error("robots 429 must remain blocked");
    }
    if ((error as Error & { requestUrl?: string }).requestUrl !== "https://ico.org.uk/robots.txt") {
      throw Error("missing exact robots URL diagnostic");
    }
    if (requested.length !== 1 || !requested[0].endsWith("/robots.txt")) {
      throw Error("collector must not attempt the page after robots 429");
    }
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("edge collector has no arbitrary per-run request-count ceiling", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("article body", {
    headers: { "content-type": "text/html" },
  });
  try {
    const client = new OfficialHTTP(["example.org"]);
    Object.assign(client, { interval: 0 });
    for (let i = 0; i < 15; i++) {
      const response = await client.request(
        `https://example.org/news/${i}`,
        "GET",
        undefined,
        false,
      );
      if (new TextDecoder().decode(response.bytes) !== "article body") {
        throw Error("request failed");
      }
    }
  } finally {
    globalThis.fetch = original;
  }
});
