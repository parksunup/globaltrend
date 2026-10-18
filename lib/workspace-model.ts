/** Serializable worker UI contract. Database identifiers stay out of primary copy. */
export type WorkspaceKind = "trend" | "law";
export type WorkspaceStatus = "draft" | "ready" | "needs_changes" | "published" | "trashed";
export type WorkspaceItem = {
  id: string;
  kind: WorkspaceKind;
  revision: string;
  title: string;
  subtitle?: string;
  summary: string;
  body?: string;
  jurisdictions: string[];
  topics?: string[];
  status: WorkspaceStatus;
  hasUnpublishedChanges?: boolean;
  issues?: {message: string; blocking?: boolean}[];
  publishedHref?: string;
  sourceHref?: string;
  sourceTitle?: string;
  editorHref?: string;
  updatedAt?: string;
  internalRecords?: {label: string; value: string}[];
  changes?: {label: string; before: string; after: string}[];
  publicationGroup?: string;
};
export type WorkspaceTarget = Pick<WorkspaceItem, "id" | "kind" | "revision">;
export type WorkspaceOperation = "publish" | "request_publication" | "unpublish" | "trash" | "restore" | "save_trend";
export type WorkspaceCommand = {
  operation: WorkspaceOperation;
  targets: WorkspaceTarget[];
  draft?: {title: string; summary: string; body: string; jurisdictions: string[]; topics: string[]};
};
export type WorkspaceActionResult = {succeeded: string[]; failures: {key: string; message: string}[]};
export type WorkspaceFilters = {query: string; kind: "all" | WorkspaceKind; status: "all" | WorkspaceStatus};
export const workspacePageSize = 20;
export const workspaceStatusLabels: Record<WorkspaceStatus, string> = {
  draft: "작성 중", ready: "공개 준비", needs_changes: "수정 필요", published: "공개 중", trashed: "휴지통",
};
export const workspaceKindLabels: Record<WorkspaceKind, string> = {trend: "동향", law: "법제"};
export function workspaceItemKey(item: Pick<WorkspaceItem,"kind" | "id">) { return `${item.kind}:${item.id}`; }
export function workspaceTarget(item: WorkspaceItem): WorkspaceTarget { return {id: item.id, kind: item.kind, revision: item.revision}; }
export function publicationBlockers(item: WorkspaceItem): string[] {
  const reasons = (item.issues ?? []).filter(issue => issue.blocking).map(issue => issue.message);
  if (!item.title.trim()) reasons.push("제목을 입력해 주세요.");
  if (item.kind === "trend" && !item.summary.trim()) reasons.push("핵심 요약을 입력해 주세요.");
  if (item.status === "needs_changes" && reasons.length === 0) reasons.push("수정할 내용을 확인한 뒤 저장해 주세요.");
  if (item.status === "trashed") reasons.push("휴지통에서 복원한 뒤 공개할 수 있습니다.");
  return [...new Set(reasons)];
}
export function canSelectForPublication(item: WorkspaceItem) {
  return (item.status !== "published" || !!item.hasUnpublishedChanges) && publicationBlockers(item).length === 0;
}
export function filterWorkspaceItems(items: WorkspaceItem[], filters: WorkspaceFilters): WorkspaceItem[] {
  const query = filters.query.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
  return items.filter(item => {
    if (filters.status === "all" && item.status === "trashed") return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.kind !== "all" && item.kind !== filters.kind) return false;
    const haystack = [item.title,item.subtitle,item.summary,item.body,...item.jurisdictions,...(item.topics ?? [])].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("ko-KR");
    return !query || haystack.includes(query);
  });
}
export function workspacePage(items: WorkspaceItem[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / workspacePageSize));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage) || 1));
  return {page, pageCount, items: items.slice((page-1)*workspacePageSize,page*workspacePageSize)};
}
export function safeWorkspaceHref(value?: string) {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}
