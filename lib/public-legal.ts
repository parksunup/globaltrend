import { createClient } from "@supabase/supabase-js";
import { reviewedDraftLegalBundle, publishedLegalBundle, type LegalReviewPackage } from "./legal-release";
import { publicSubmissionPreviewEnabled } from "./public-submission-preview";
import { isMissingLegalReviewPayload } from "./public-legal-schema";
import { loadOfficialPipa, officialPipaInstrument } from "./official-pipa";

function withOfficialPipa(bundle: ReturnType<typeof publishedLegalBundle>) {
  const law = loadOfficialPipa();
  return {
    ...bundle,
    instruments: bundle.instruments.some((item) => item.fields.some((field) => field.label === "관할권" && field.value === "KR"))
      ? bundle.instruments : [officialPipaInstrument(law), ...bundle.instruments],
    documents: [law, ...bundle.documents.filter((item) => item.jurisdiction !== "KR")],
  };
}

async function loadLegal(forceDraft = false) {
  const preview = forceDraft || publicSubmissionPreviewEnabled();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (preview) return withOfficialPipa(reviewedDraftLegalBundle(null));
    throw new Error("Supabase public connection is not configured");
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("law_versions").select("status,review_payload").eq("status", "published").not("review_payload", "is", null);
  if (error && isMissingLegalReviewPayload(error)) {
    console.warn("Legal review schema is pending; published legal content is unavailable.");
    return withOfficialPipa(preview ? reviewedDraftLegalBundle(null) : publishedLegalBundle([]));
  }
  if (error) {
    if (preview) return withOfficialPipa(reviewedDraftLegalBundle(null));
    throw new Error(`Unable to load published laws: ${error.code}`);
  }
  const rows = (data ?? []) as { status: string; review_payload: LegalReviewPackage | null }[];
  return withOfficialPipa(preview ? reviewedDraftLegalBundle(rows) : publishedLegalBundle(rows));
}

export async function loadPublicLegal() { return loadLegal(); }
/** Match the current repository version against the published snapshot in every environment. */
export async function loadReviewedLegalDrafts() { return loadLegal(true); }
