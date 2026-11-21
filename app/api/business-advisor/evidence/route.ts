import { findPublishedLegalEvidence } from "../../../../lib/business-advisor/legal-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedJurisdictions = new Set(["KR", "JP", "CN", "EU", "GB", "UK", "US-CA", "SG"]);

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Response.json({ error: "요청은 JSON 형식이어야 합니다." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 내용을 읽을 수 없습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "요청 내용 형식이 올바르지 않습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const question = (body as { question?: unknown }).question;
  const jurisdictions = (body as { jurisdictions?: unknown }).jurisdictions;
  if (typeof question !== "string" || !question.trim() || question.length > 8_000) {
    return Response.json({ error: "질문은 1자 이상 8,000자 이하로 입력해 주세요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!Array.isArray(jurisdictions) || jurisdictions.length === 0 ||
      !jurisdictions.every((value): value is string => typeof value === "string" && allowedJurisdictions.has(value))) {
    return Response.json({ error: "확인할 국가·지역을 하나 이상 선택해 주세요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return Response.json({
      error: "공개 법령 자료 저장소 연결이 설정되지 않았습니다. 현재 이 환경에서는 질문에 사용할 발행 자료를 조회할 수 없습니다.",
      code: "published_legal_store_not_configured",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await findPublishedLegalEvidence(question, { jurisdictions, limit: 8 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Business advisor published evidence lookup failed:", message);
    return Response.json({
      error: "발행된 법령 자료를 조회하지 못했습니다. 법률 답변은 생성하지 않았습니다.",
      code: "published_legal_lookup_failed",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
