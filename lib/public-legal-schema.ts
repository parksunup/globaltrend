export function isMissingLegalReviewPayload(error: { code?: string; message?: string }): boolean {
  return error.code === "42703"
    && /\breview_payload\b/.test(error.message ?? "");
}
