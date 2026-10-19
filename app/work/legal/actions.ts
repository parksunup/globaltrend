"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { buildLegalReviewPackages } from "../../../lib/legal-release";

async function writableTeam(admin = false) {
  if (process.env.VERCEL_ENV === "preview") redirect("/work/legal?notice=preview_readonly");
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/work?notice=login_required");
  const { data: member } = await db.from("team_memberships").select("role,is_active").eq("user_id",user.id).maybeSingle();
  if (!member?.is_active || !(admin ? ["admin"] : ["admin","editor"]).includes(member.role)) redirect("/work/legal?notice=permission_denied");
  return db;
}

export async function importLegalReview(form: FormData) {
  const db = await writableTeam();
  const candidate = buildLegalReviewPackages().find(p => p.recordId === form.get("record_id") && p.contentHash === form.get("content_hash"));
  if (!candidate || candidate.cells.length !== 17) redirect("/work/legal?notice=stale_package");
  const { error } = await db.rpc("import_legal_review", { p_payload: candidate });
  if (error) redirect("/work/legal?notice=save_failed");
  revalidatePath("/work/legal");
  redirect("/work/legal?notice=imported");
}

export async function advanceLegalReview(form: FormData) {
  const db = await writableTeam(true);
  const id = String(form.get("id") ?? "");
  const next = String(form.get("next") ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(id) || !["verified","published"].includes(next) || form.get("checked") !== "yes") redirect("/work/legal?notice=confirmation_required");
  const { data } = await db.from("law_versions").select("content_hash").eq("id",id).maybeSingle();
  if (!data || data.content_hash !== form.get("content_hash")) redirect("/work/legal?notice=stale_package");
  const { error } = await db.rpc("advance_legal_review", { p_id:id, p_next:next, p_checked:true });
  if (error) redirect("/work/legal?notice=save_failed");
  revalidatePath("/work/legal");
  revalidatePath("/public", "layout");
  redirect(`/work/legal?notice=${next}`);
}

/** Clicking this action records the administrator's publication decision once. */
export async function publishLegalReviews(form: FormData) {
  const db = await writableTeam(true);
  const entries = form.getAll("selection");
  if (!entries.length || entries.length > 100) redirect("/work/legal?notice=invalid_selection");
  const selected = new Map<string, string>();
  for (const entry of entries) {
    try {
      const value = JSON.parse(String(entry));
      if (!/^[a-f0-9-]{36}$/i.test(value.id) || !/^[a-f0-9]{64}$/i.test(value.contentHash)) throw new Error("invalid");
      selected.set(value.id, value.contentHash);
    } catch { redirect("/work/legal?notice=invalid_selection"); }
  }
  let published = 0, already = 0;
  const failed: string[] = [];
  const snapshots = new Map<string, {status:string; content_hash:string; legal_instrument_id:string}>();
  const instrumentCounts = new Map<string, number>();
  // Reject every selected version of a duplicated law before publishing any of them.
  for (const id of selected.keys()) {
    const {data, error} = await db.from("law_versions").select("status,content_hash,legal_instrument_id").eq("id",id).maybeSingle();
    if (!error && data) {
      snapshots.set(id, data);
      instrumentCounts.set(data.legal_instrument_id, (instrumentCounts.get(data.legal_instrument_id) ?? 0) + 1);
    }
  }
  for (const [id, hash] of selected) {
    try {
      const data = snapshots.get(id);
      if (!data || data.content_hash !== hash || instrumentCounts.get(data.legal_instrument_id) !== 1) { failed.push(id); continue; }
      if (data.status === "published") { already++; continue; }
      if (!["draft", "verified"].includes(data.status)) { failed.push(id); continue; }
      if (data.status === "draft") {
        const result = await db.rpc("advance_legal_review", {p_id:id, p_next:"verified", p_checked:true});
        if (result.error) throw new Error("approval_failed");
      }
      const {error: publishError} = await db.rpc("advance_legal_review", {p_id:id, p_next:"published", p_checked:true});
      if (publishError) throw new Error("publication_failed");
      published++;
    } catch { failed.push(id); }
  }
  revalidatePath("/work/legal");
  revalidatePath("/public", "layout");
  const result = new URLSearchParams({published:String(published), already:String(already), failed:failed.join(",")});
  redirect(`/work/legal?${result.toString()}#registered`);
}
