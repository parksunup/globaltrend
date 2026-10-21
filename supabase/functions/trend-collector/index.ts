import registry from "./registry.json" with { type: "json" };
import { OfficialHTTP } from "./http.ts";
import { advance, type Item, type State } from "./runtime.ts";
const base = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const r = await fetch(base + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    await r.body?.cancel();
    throw new Error("database_" + name + "_" + r.status);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
Deno.serve(async (req: Request) => {
  const expected = Deno.env.get("TREND_COLLECTOR_INVOCATION_KEY");
  // Independent invocation credential, not an anonymous or browser-facing key.
  if (!expected || req.headers.get("x-collector-key") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const started = new Date().toISOString(),
    execution = crypto.randomUUID();
  let msg: {
    msg_id: number;
    read_ct: number;
    source_id: string;
    slug: string;
    state: State;
  } | null = null;
  try {
    msg = await rpc("collector_edge_take");
    if (!msg) return Response.json({ status: "idle", execution_id: execution });
    const active = msg;
    const config = registry.sources.find((x) =>
      x.source_id === active.source_id && x.source === active.slug
    );
    if (!config) throw new Error("registry_mismatch");
    if (
      !config.enabled ||
      !["collect", "store", "ai"].every((k) =>
        config.permissions[k as keyof typeof config.permissions]
      )
    ) throw new Error("registry_permissions_revoked");
    if (
      !await rpc("collector_source_allowed", { p_source_id: config.source_id })
    ) throw new Error("source_approval_revoked");
    if (!(await rpc("collector_capacity")).can_write) {
      throw new Error("database_storage_cap");
    }
    const ingest = async (item: Item, url: string) => {
      if (!(await rpc("collector_capacity")).can_write) {
        throw new Error("database_storage_cap");
      }
      const saved = await rpc("ingest_source_item", {
        p_source_id: config.source_id,
        p_external_id: null,
        p_canonical_url: url,
        p_title_original: item.title_original,
        p_published_at: item.published_date
          ? item.published_date + "T00:00:00Z"
          : null,
        p_event_date: null,
        p_fetched_at: null,
        p_language_code: config.language,
        p_document_type:
          item.metadata.read_scope === "press_release_pdf_not_judgment"
            ? "press_release"
            : "news",
        p_content_text: item.content_text,
        p_content_hash: item.content_hash,
        p_raw_storage_path: null,
        p_metadata: {
          ...item.metadata,
          runtime: "supabase-edge",
          execution_id: execution,
        },
        p_instruction_version: "trend-ko-v1",
      });
      return saved[0];
    };
    const step = await advance(
      config,
      msg.state as State,
      new OfficialHTTP(config.hosts),
      ingest,
    );
    const event = await rpc("collector_edge_finish", {
      p_msg_id: msg.msg_id,
      p_read_ct: msg.read_ct,
      p_source_id: msg.source_id,
      p_state: step.state,
      p_result: {
        ...step.result,
        runtime: "supabase-edge",
        execution_id: execution,
        platform_execution_id: Deno.env.get("SB_EXECUTION_ID") || null,
        git_sha: Deno.env.get("TREND_COLLECTOR_GIT_SHA") || "unknown",
        read_ct: msg.read_ct,
      },
      p_execution_id: execution,
      p_started_at: started,
      p_continue: step.continue,
      p_delay: step.delay,
    });
    return Response.json({
      event_id: event,
      execution_id: execution,
      ...step.result,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "error";
    // Finish failures themselves are not retried with a second write: the
    // original queue lease stays intact and pg_net retains the HTTP failure.
    // Source/registry gating failures can be recorded with bounded backoff.
    if (msg && !reason.startsWith("database_")) {
      try {
        await rpc("collector_edge_finish", {
          p_msg_id: msg.msg_id,
          p_read_ct: msg.read_ct,
          p_source_id: msg.source_id,
          p_state: { ...msg.state, failures: (msg.state.failures || 0) + 1 },
          p_result: {
            status: "blocked",
            reason,
            source: msg.slug,
            runtime: "supabase-edge",
            coverage_complete: false,
          },
          p_execution_id: execution,
          p_started_at: started,
          p_continue: true,
          p_delay: 3600,
        });
      } catch { /* Original queue lease and platform HTTP outcome remain. */ }
    }
    console.error(
      /^[a-z_0-9]+$/i.test(reason) ? reason : "collector_runtime_error",
    );
    return Response.json({
      status: "failed",
      execution_id: execution,
      reason: /^[a-z_0-9]+$/i.test(reason) ? reason : "collector_runtime_error",
    }, { status: 500 });
  }
});
