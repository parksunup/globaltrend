import { retrieveAdvisorEvidence } from "../../../../lib/business-advisor/knowledge-corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return Response.json({ error: "요청은 JSON 형식이어야 합니다." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "요청 내용을 읽을 수 없습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "요청 내용 형식이 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const input = body as { question?: unknown; history?: unknown; assessmentContext?: unknown };
  if (typeof input.question !== "string" || !input.question.trim() || input.question.length > 8_000) {
    return Response.json({ error: "질문은 1자 이상 8,000자 이하로 입력해 주세요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const history = input.history ?? [];
  if (!Array.isArray(history) || !history.every((item): item is ChatTurn => Boolean(item && typeof item === "object" && ["user", "assistant"].includes((item as ChatTurn).role) && typeof (item as ChatTurn).content === "string"))) {
    return Response.json({ error: "대화 기록 형식이 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const assessmentContext = input.assessmentContext ?? "";
  if (typeof assessmentContext !== "string" || assessmentContext.length > 50_000) {
    return Response.json({ error: "자가점검 결과 전달 형식이 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await retrieveAdvisorEvidence(input.question, history as ChatTurn[], assessmentContext);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Business advisor conversation context retrieval failed:", message);
    return Response.json({ error: "국제요정 자료를 불러오지 못했습니다. 대화는 저장되지 않았으며 잠시 후 다시 시도해 주세요.", code: "advisor_material_lookup_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
