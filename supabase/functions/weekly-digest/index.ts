import { rankWeeklyCandidates, weeklyPriority, type WeeklyPriorityInput } from "../_shared/weekly-priority.ts";

const base = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const invokeKey = Deno.env.get("TREND_COLLECTOR_INVOCATION_KEY");

async function rpc(name: string, args: Record<string, unknown> = {}) {
  if (!base || !key) throw new Error("weekly_digest_database_configuration_missing");
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`database_${name}_${response.status}:${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function seoulDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function previousCompleteWeek(today: string) {
  const current = new Date(`${today}T00:00:00.000Z`);
  const daysSinceMonday = (current.getUTCDay() + 6) % 7;
  const thisMonday = new Date(current);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - daysSinceMonday);
  const start = new Date(thisMonday);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function log(executionId: string, startedAt: string, result: Record<string, unknown>) {
  if (!base || !key) throw new Error("weekly_digest_database_configuration_missing");
  const response = await fetch(`${base}/rest/v1/collector_edge_events`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      source_id: null,
      msg_id: null,
      execution_id: executionId,
      trigger_kind: "weekly-digest",
      started_at: startedAt,
      result,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`weekly_digest_event_log_${response.status}`);
}

async function existingIssue(issueKey: string) {
  if (!base || !key) throw new Error("weekly_digest_database_configuration_missing");
  const url = new URL(`${base}/rest/v1/written_weekly_issues`);
  url.searchParams.set("issue_key", `eq.${issueKey}`);
  url.searchParams.set("select", "issue_key,status");
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`weekly_digest_issue_read_${response.status}`);
  return await response.json() as Array<{ issue_key: string; status: string }>;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (!invokeKey || request.headers.get("x-collector-key") !== invokeKey) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  let week: { start: string; end: string } | undefined;
  try {
    week = previousCompleteWeek(seoulDate());
    const issueKey = await rpc("monthly_week_issue_key", { p_week_start: week.start }) as string;
    const found = await existingIssue(issueKey);
    if (found.length) {
      const result = { status: "existing_issue_preserved", execution_id: executionId, issue_key: issueKey, issue_status: found[0].status, week_start: week.start, week_end: week.end };
      await log(executionId, startedAt, result);
      return Response.json(result);
    }

    const raw = await rpc("weekly_digest_candidates", { p_start: week.start, p_end: week.end }) as Array<WeeklyPriorityInput>;
    const candidates = rankWeeklyCandidates(raw.map((row) => ({ ...row, documentType: "" })));
    const selected = candidates.slice(0, 8).map((candidate) => ({
      report_id: candidate.id,
      reason: weeklyPriority(candidate).reasons.join(" · "),
    }));
    if (!selected.length) {
      const result = { status: "no_eligible_reports", execution_id: executionId, issue_key: issueKey, week_start: week.start, week_end: week.end, candidate_count: 0 };
      await log(executionId, startedAt, result);
      return Response.json(result);
    }

    const saved = await rpc("create_weekly_digest_draft_if_missing", {
      p_start: week.start,
      p_end: week.end,
      p_selection: selected,
    }) as { status: string; issue_key: string; issue_status?: string };
    const result = {
      status: saved.status,
      execution_id: executionId,
      issue_key: saved.issue_key,
      issue_status: saved.issue_status ?? "draft",
      week_start: week.start,
      week_end: week.end,
      candidate_count: candidates.length,
      selected_count: saved.status === "created" ? selected.length : 0,
      selected_report_ids: saved.status === "created" ? selected.map((entry) => entry.report_id) : [],
      automatically_published: false,
    };
    await log(executionId, startedAt, result);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "weekly_digest_unknown_error";
    try {
      await log(executionId, startedAt, { status: "failed", execution_id: executionId, week_start: week?.start ?? null, week_end: week?.end ?? null, error: message.slice(0, 500) });
    } catch { /* Preserve the original failure for the caller. */ }
    return Response.json({ status: "failed", execution_id: executionId, week_start: week?.start ?? null, week_end: week?.end ?? null, error: message }, { status: 500 });
  }
});
