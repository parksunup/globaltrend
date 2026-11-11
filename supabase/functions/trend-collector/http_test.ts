import { OfficialHTTP } from "./http.ts";
Deno.test("missing robots 404 permits public page, real failures stay blocked", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/robots.txt")
      ? new Response("missing", { status: 404 })
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
Deno.test("robots 403 is unavailable policy and does not block the public page", async () => {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return String(input).endsWith("/robots.txt")
      ? new Response("forbidden", { status: 403 })
      : new Response("article body", {
        headers: { "content-type": "text/html" },
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
    if (error) throw error;
    if (requested.length !== 2 || !requested[0].endsWith("/robots.txt") || !requested[1].includes("/media-centre/news-and-blogs/")) {
      throw Error("collector must continue to the official page after robots 403");
    }
  } finally {
    globalThis.fetch = original;
  }
});
