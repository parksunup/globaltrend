export type CollectorReport = {
  id: string; title_ko: string; one_line_summary_ko: string | null;
  detailed_summary_ko: string | null; policy_implications_ko: string | null;
  key_points: Array<{ text?: string; evidence_index?: number }>;
  status: string; human_reviewed: boolean; source_item_revision_id: string | null;
  instruction_version: string | null; automation_metadata: Record<string, unknown>;
};
export type CollectorJob = {
  id: string; status: string; attempts: number; last_error: string | null;
  instruction_version: string; source_item_revision_id: string | null;
  input_content_text?: string;
  proposed_draft: { title_ko?: string; summary_ko?: string; details_ko?: string; limitations?: string[];
    policy_implications_ko?: string; key_points?: Array<{text?: string} | null>; evidence?: Array<{quote: string; locator: string; claim: string}> } | null;
};
export type CollectorItem = {
  id: string; title_original: string; canonical_url: string; published_at: string | null;
  source_name: string; current_revision_id: string | null; pipeline_status: string; relevance_status: string;
  current_content_text?: string; report_content_text?: string;
  metadata: { read_scope?: string; date_observations?: Array<{ meaning: string; locator: string; value: string }>;
    unread_attachments?: string[]; fetch_failure?: string; requires_review?: boolean };
  jobs: CollectorJob[]; report: CollectorReport | null;
  evidence: Array<{ id: string; excerpt: string; locator: { location?: string; claim?: string; revision_id?: string } }>;
};
export type CollectorReview = { items: CollectorItem[]; limit: number; database_bytes: number };
export function canReviewCollector(role: string | null): boolean {
  return role === 'admin' || role === 'editor' || role === 'reviewer';
}
export function collectorFeedbackId(itemId: string, revisionId: string | null): string {
  return `collector-${itemId}-revision-${revisionId ?? 'discovery'}`;
}
export function parseCollectorReview(value: unknown): CollectorReview {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) {
    throw new Error('수집 자료 응답을 확인하지 못했습니다.');
  }
  return value as CollectorReview;
}
