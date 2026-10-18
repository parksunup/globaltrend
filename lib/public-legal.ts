import { createClient } from "@supabase/supabase-js";
import { draftLegalBundle, publishedLegalBundle, type LegalReviewPackage } from "./legal-release";
import { publicSubmissionPreviewEnabled } from "./public-submission-preview";
import { isMissingLegalReviewPayload } from "./public-legal-schema";

export async function loadPublicLegal() {
  if (publicSubmissionPreviewEnabled()) return draftLegalBundle();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public connection is not configured");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("law_versions").select("status,review_payload").eq("status", "published").not("review_payload", "is", null);
  if (error && isMissingLegalReviewPayload(error)) {
    console.warn("Legal review schema is pending; published legal content is unavailable.");
    return publishedLegalBundle([]);
  }
  if (error) throw new Error(`Unable to load published laws: ${error.code}`);
  return publishedLegalBundle((data ?? []) as { status: string; review_payload: LegalReviewPackage | null }[]);
}
