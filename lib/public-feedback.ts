export type PublicFeedback = {
  id: string;
  branch_name: string;
  item_id: string;
  commit_sha: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type FeedbackQuery = { branch: string; item?: string; offset: number; limit: number };
export type FeedbackPage = { feedback: PublicFeedback[]; branch: string; item: string | null; offset: number; limit: number; nextOffset: number | null };

export class FeedbackQueryError extends Error {}

export function parseFeedbackQuery(params: URLSearchParams): FeedbackQuery {
  const branch = params.get("branch") ?? "";
  const item = params.get("item") || undefined;
  if (!/^[A-Za-z0-9._/-]{1,160}$/.test(branch)) throw new FeedbackQueryError("브랜치를 지정해 주세요.");
  if (item !== undefined && (!item || item.length > 240 || /[\r\n\u0000]/.test(item))) throw new FeedbackQueryError("항목 주소가 올바르지 않습니다.");
  function integer(name: string, fallback: number, max: number) {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) throw new FeedbackQueryError("페이지 번호가 올바르지 않습니다.");
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value > max || (name === "limit" && value < 1)) throw new FeedbackQueryError("조회 범위가 올바르지 않습니다.");
    return value;
  }
  return { branch, item, offset: integer("offset", 0, 1000000), limit: integer("limit", 100, 200) };
}

export async function getPublicFeedback(query: FeedbackQuery): Promise<FeedbackPage> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !key) throw new Error("피드백 연결 설정을 확인할 수 없습니다.");
  const url = new URL("/rest/v1/submission_feedback", baseUrl);
  url.searchParams.set("select", "id,branch_name,item_id,commit_sha,author_name,body,created_at");
  url.searchParams.set("branch_name", `eq.${query.branch}`);
  if (query.item) url.searchParams.set("item_id", `eq.${query.item}`);
  url.searchParams.set("order", "created_at.asc,id.asc");
  url.searchParams.set("offset", String(query.offset));
  // Read one extra row to know whether another page exists without an expensive count.
  url.searchParams.set("limit", String(query.limit + 1));
  const response = await fetch(url, { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("저장된 피드백을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("피드백 응답을 확인하지 못했습니다.");
  return { feedback: rows.slice(0, query.limit) as PublicFeedback[], branch: query.branch, item: query.item ?? null,
    offset: query.offset, limit: query.limit, nextOffset: rows.length > query.limit ? query.offset + query.limit : null };
}
