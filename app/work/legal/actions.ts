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
