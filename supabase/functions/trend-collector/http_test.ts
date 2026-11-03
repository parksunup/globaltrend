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
Deno.test("robots access denial reports its exact official URL without allowing the page", async () => {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response("forbidden", { status: 403 });
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
    if (!(error instanceof Error) || error.message !== "http_403") {
      throw Error("robots 403 must remain blocked");
    }
    if ((error as Error & { requestUrl?: string }).requestUrl !== "https://ico.org.uk/robots.txt") {
      throw Error("missing exact robots URL diagnostic");
    }
    if (requested.length !== 1 || !requested[0].endsWith("/robots.txt")) {
      throw Error("collector must not attempt the page after robots 403");
    }
  } finally {
    globalThis.fetch = original;
  }
});
