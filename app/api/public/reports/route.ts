import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = new URL(request.url).host;
  let originHost = "";
  try { originHost = origin ? new URL(origin).host : ""; } catch { /* Invalid Origin is rejected below. */ }
  if (originHost !== host) return Response.json({ error: "요청 출처를 확인할 수 없습니다." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 415 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return Response.json({ error: "요청 내용을 읽을 수 없습니다." }, { status: 400 });
  const { kind, pageUrl, body, contactEmail, website } = input as Record<string, unknown>;
  if (website) return Response.json({ ok: true });
  if (kind !== "feedback" && kind !== "bug") return Response.json({ error: "신고 유형을 골라 주세요." }, { status: 400 });
  if (typeof body !== "string" || body.trim().length < 10 || body.length > 4000) return Response.json({ error: "내용을 10자 이상 4,000자 이하로 입력해 주세요." }, { status: 400 });
  if (typeof pageUrl !== "string" || pageUrl.length > 1000) return Response.json({ error: "페이지 주소가 올바르지 않습니다." }, { status: 400 });
  let safePage: URL;
  try { safePage = new URL(pageUrl); } catch { return Response.json({ error: "페이지 주소가 올바르지 않습니다." }, { status: 400 }); }
  if (safePage.host !== host || safePage.protocol !== "https:" && safePage.protocol !== "http:") return Response.json({ error: "이 사이트의 페이지만 신고할 수 있습니다." }, { status: 400 });
  const email = typeof contactEmail === "string" ? contactEmail.trim() : "";
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return Response.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "접수 연결을 확인할 수 없습니다." }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("site_reports").insert({ kind, page_url: safePage.origin + safePage.pathname, body: body.trim(), contact_email: email || null });
  if (error) return Response.json({ error: "접수하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
