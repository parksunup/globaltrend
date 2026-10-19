import { createClient } from "@supabase/supabase-js";
import { reviewedDraftLegalBundle, publishedLegalBundle, type LegalReviewPackage } from "./legal-release";
import { publicSubmissionPreviewEnabled } from "./public-submission-preview";
import { isMissingLegalReviewPayload } from "./public-legal-schema";

async function loadLegal(forceDraft = false) {
  const preview = forceDraft || publicSubmissionPreviewEnabled();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (preview) return reviewedDraftLegalBundle(null);
    throw new Error("Supabase public connection is not configured");
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("law_versions").select("status,review_payload").eq("status", "published").not("review_payload", "is", null);
  if (error && isMissingLegalReviewPayload(error)) {
    console.warn("Legal review schema is pending; published legal content is unavailable.");
    return preview ? reviewedDraftLegalBundle(null) : publishedLegalBundle([]);
  }
  if (error) {
    if (preview) return reviewedDraftLegalBundle(null);
    throw new Error(`Unable to load published laws: ${error.code}`);
  }
  const rows = (data ?? []) as { status: string; review_payload: LegalReviewPackage | null }[];
  return preview ? reviewedDraftLegalBundle(rows) : publishedLegalBundle(rows);
}

export async function loadPublicLegal() { return loadLegal(); }
/** Match the current repository version against the published snapshot in every environment. */
export async function loadReviewedLegalDrafts() { return loadLegal(true); }
