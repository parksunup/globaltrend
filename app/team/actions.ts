"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import type { ReviewKind } from "../sample-data";

type ReviewDecision = "in_review" | "approved" | "rejected";

export type ReviewActionResult = {
  ok: boolean;
  message: string;
  status?: ReviewDecision;
  note?: string;
  reviewedAt?: string;
};

export async function updateReviewState(input: {
  kind: ReviewKind;
  id: string;
  status: ReviewDecision;
  note: string;
}): Promise<ReviewActionResult> {
  const note = input.note.trim();
  if (!(["sources", "laws", "criteria"] as string[]).includes(input.kind)) return { ok: false, message: "지원하지 않는 검수 대상입니다." };
  if (!(["in_review", "approved", "rejected"] as string[]).includes(input.status)) return { ok: false, message: "지원하지 않는 검수 상태입니다." };
  if (!/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false, message: "검수 대상 ID가 올바르지 않습니다." };
  if (note.length > 2000) return { ok: false, message: "검수 메모는 2,000자 이하로 작성해 주세요." };
  if (input.status === "rejected" && !note) return { ok: false, message: "반려할 때는 이유를 반드시 적어 주세요." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 만료되었습니다. 다시 로그인해 주세요." };

  const { data, error } = await supabase.rpc("set_review_state", {
    p_entity_type: input.kind,
    p_entity_id: input.id,
    p_status: input.status,
    p_note: note || null,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, message: "이 작업을 수행할 팀 권한이 없습니다." };
    if (error.code === "22023") return { ok: false, message: error.message };
    return { ok: false, message: "검수 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const state = data as { status: ReviewDecision; note: string | null; reviewed_at: string | null };
  revalidatePath("/team");
  return {
    ok: true,
    message: input.status === "approved" ? "승인 결과를 저장했습니다." : input.status === "rejected" ? "반려 결과를 저장했습니다." : "검수를 시작했습니다.",
    status: state.status,
    note: state.note ?? "",
    reviewedAt: state.reviewed_at ?? undefined,
  };
}
