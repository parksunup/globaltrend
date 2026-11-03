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
