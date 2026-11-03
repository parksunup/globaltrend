import {
  expansionCandidates,
  probe,
} from "../trend-collector/expansion-probe.ts";

Deno.serve(async (request: Request) => {
  const key = Deno.env.get("TREND_COLLECTOR_INVOCATION_KEY");
  if (!key || request.headers.get("x-collector-key") !== key) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (request.method !== "POST") {
    return new Response("POST required", { status: 405 });
  }
  let input: { source?: string };
  try {
    input = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!input.source || !Object.hasOwn(expansionCandidates, input.source)) {
    return new Response("Unknown source", { status: 400 });
  }
  return Response.json(await probe(input.source));
});
