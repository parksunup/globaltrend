"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const words = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((part) => part.trim()).filter(Boolean).slice(0, 12);

function requireWritableDeployment() {
  if (process.env.VERCEL_ENV === "preview") redirect("/work?notice=preview_readonly");
}

async function requireTeam(required: "editor" | "admin") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/work?notice=login_required");
  const { data } = await supabase.from("team_memberships")
    .select("role,is_active").eq("user_id", user.id).maybeSingle();
  if (!data?.is_active || (required === "admin" && data.role !== "admin") ||
      (required === "editor" && !["admin", "editor"].includes(data.role))) {
    redirect("/work?notice=permission_denied");
  }
  return supabase;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/work?notice=invalid_login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/work?notice=invalid_login");
  revalidatePath("/work");
  redirect("/work");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/work");
  redirect("/work");
}

export async function createDraft(formData: FormData) {
  requireWritableDeployment();
  const supabase = await requireTeam("editor");
  const sourceId = String(formData.get("source_id") ?? "");
  const canonicalUrl = String(formData.get("canonical_url") ?? "").trim();
  const originalTitle = String(formData.get("original_title") ?? "").trim();
  const title = String(formData.get("title_ko") ?? "").trim();
  const summary = String(formData.get("summary_ko") ?? "").trim();
  const details = String(formData.get("details_ko") ?? "").trim();
  const date = String(formData.get("source_published_date") ?? "");
  let safeUrl = false;
  try { safeUrl = new URL(canonicalUrl).protocol === "https:"; } catch { /* handled below */ }
  if (!isUuid(sourceId) || !safeUrl || !originalTitle || !title || !summary ||
      originalTitle.length > 500 || title.length > 500 || summary.length > 3000 || details.length > 20000 ||
      (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) redirect("/work?notice=invalid_draft");

  const { error } = await supabase.rpc("create_report_draft", {
    p_source_id: sourceId,
    p_canonical_url: canonicalUrl,
    p_original_title: originalTitle,
    p_title_ko: title,
    p_summary_ko: summary,
    p_details_ko: details,
    p_jurisdictions: words(formData.get("jurisdictions")),
    p_topics: words(formData.get("topics")),
    p_source_published_at: date ? `${date}T12:00:00Z` : null,
  });
  if (error) redirect(`/work?notice=${error.code === "23505" ? "duplicate" : "save_failed"}`);
  revalidatePath("/work");
  redirect("/work?notice=draft_saved");
}

export async function saveDraft(formData: FormData) {
  requireWritableDeployment();
  const supabase = await requireTeam("editor");
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title_ko") ?? "").trim();
  const summary = String(formData.get("summary_ko") ?? "").trim();
  const details = String(formData.get("details_ko") ?? "").trim();
  if (!isUuid(id) || !title || !summary || title.length > 500 || summary.length > 3000 || details.length > 20000) {
    redirect("/work?notice=invalid_draft");
  }
  const { data, error } = await supabase.from("reports").update({
    title_ko: title, one_line_summary_ko: summary,
    detailed_summary_ko: details || null,
    jurisdictions: words(formData.get("jurisdictions")),
    topics: words(formData.get("topics")),
  }).eq("id", id).in("status", ["draft", "in_review"]).select("id").maybeSingle();
  if (error || !data) redirect("/work?notice=save_failed");
  revalidatePath("/work");
  redirect("/work?notice=draft_saved");
}

export async function advanceReport(formData: FormData) {
  requireWritableDeployment();
  const next = String(formData.get("next") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id) || !["in_review", "approved", "published"].includes(next)) {
    redirect("/work?notice=invalid_draft");
  }
  const supabase = await requireTeam(next === "in_review" ? "editor" : "admin");
  const previous = next === "in_review" ? "draft" : next === "approved" ? "in_review" : "approved";
  const { data, error } = await supabase.from("reports").update({ status: next })
    .eq("id", id).eq("status", previous).select("id").maybeSingle();
  if (error || !data) redirect("/work?notice=transition_failed");
  revalidatePath("/work");
  revalidatePath("/public");
  revalidatePath("/public/search");
  revalidatePath(`/public/trends/${id}`);
  redirect(`/work?notice=${next}`);
}
