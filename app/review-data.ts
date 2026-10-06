import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sampleItems, type ReviewItem } from "./sample-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type ReviewStateRow = {
  entity_type: ReviewItem["kind"];
  entity_id: string;
  status: "unreviewed" | "in_review" | "approved" | "rejected";
  note?: string | null;
  reviewed_at: string | null;
};

function indexReviewStates(rows: ReviewStateRow[] | null) {
  return new Map((rows ?? []).map((row) => [`${row.entity_type}:${row.entity_id}`, row]));
}

function reviewFields(states: Map<string, ReviewStateRow>, kind: ReviewItem["kind"], id: string, published: boolean) {
  const state = states.get(`${kind}:${id}`);
  return {
    status: published ? "published" as const : state?.status ?? "unreviewed" as const,
    reviewNote: state?.note ?? undefined,
    reviewedAt: state?.reviewed_at ?? undefined,
  };
}

export async function loadReviewItems(): Promise<{ items: ReviewItem[]; source: "supabase" | "sample" }> {
  if (!url || !key) return { items: sampleItems, source: "sample" };

  const supabase = createClient(url, key);
  const [sources, laws, criteria] = await Promise.all([
    supabase.from("sources").select("id,name,start_url,source_kind,is_active,publishers(name)").eq("is_active", true).order("name"),
    supabase.from("legal_instruments").select("id,short_name,official_name,official_url,jurisdiction_code,is_published").eq("is_published", true).order("short_name"),
    supabase.from("criteria").select("id,criterion_key,label_ko,sort_order,criteria_sets!inner(name,is_published)").eq("criteria_sets.is_published", true).order("sort_order")
  ]);

  if (sources.error || laws.error || criteria.error) return { items: sampleItems, source: "sample" };
  const mapped: ReviewItem[] = [
    ...(sources.data ?? []).map((row: any) => ({
      id: row.id, kind: "sources" as const, title: row.name, subtitle: row.publishers?.name ?? "공식 출처",
      description: "Supabase에 등록된 수집 출처입니다.", status: "unreviewed" as const, url: row.start_url,
      metadata: [row.source_kind.toUpperCase(), "활성 출처"], note: "실제 수집 전 이용조건과 페이지 구조를 확인합니다."
    })),
    ...(laws.data ?? []).map((row: any) => ({
      id: row.id, kind: "laws" as const, title: row.short_name, subtitle: row.official_name,
      description: "Supabase에 등록된 해외 법제입니다.", status: row.is_published ? "published" as const : "unreviewed" as const,
      url: row.official_url ?? undefined, metadata: [row.jurisdiction_code, "법제"], note: "공식 원문과 현행 버전을 확인한 뒤 공개합니다."
    })),
    ...(criteria.data ?? []).map((row: any) => ({
      id: row.id, kind: "criteria" as const, title: row.label_ko, subtitle: row.criteria_sets?.name ?? "비교 기준",
      description: "비교표에 사용할 기준 항목입니다.", status: row.criteria_sets?.is_published ? "published" as const : "unreviewed" as const,
      metadata: ["한국·일본 기준", `순서 ${row.sort_order}`], note: "법제별 근거 조문을 연결한 뒤 공개합니다."
    }))
  ];
  return mapped.length ? { items: mapped, source: "supabase" } : { items: sampleItems, source: "sample" };
}

async function loadCatalogItems(supabase: SupabaseClient): Promise<{ items: ReviewItem[]; source: "supabase" }> {
  const [sources, laws, criteria, reviewStates] = await Promise.all([
    supabase.from("sources").select("id,name,start_url,source_kind,is_active,publishers(name)").order("name"),
    supabase.from("legal_instruments").select("id,short_name,official_name,official_url,jurisdiction_code,is_published").order("short_name"),
    supabase.from("criteria").select("id,criterion_key,label_ko,sort_order,criteria_sets(name,is_published)").order("sort_order"),
    supabase.from("review_states").select("entity_type,entity_id,status,reviewed_at"),
  ]);
  if (sources.error || laws.error || criteria.error) return { items: [], source: "supabase" };
  const states = reviewStates.error ? new Map<string, ReviewStateRow>() : indexReviewStates(reviewStates.data as ReviewStateRow[] | null);
  const items: ReviewItem[] = [
    ...(sources.data ?? []).map((row: any) => ({ id: row.id, kind: "sources" as const, title: row.name, subtitle: row.publishers?.name ?? "공식 출처", description: "Supabase에 등록된 수집 출처입니다.", ...reviewFields(states, "sources", row.id, false), url: row.start_url, metadata: [row.source_kind.toUpperCase(), row.is_active ? "활성 출처" : "중지"], note: "실제 수집 전 이용조건과 페이지 구조를 확인합니다." })),
    ...(laws.data ?? []).map((row: any) => ({ id: row.id, kind: "laws" as const, title: row.short_name, subtitle: row.official_name, description: "Supabase에 등록된 해외 법제입니다.", ...reviewFields(states, "laws", row.id, row.is_published), url: row.official_url ?? undefined, metadata: [row.jurisdiction_code, row.is_published ? "공개" : "검수 전"], note: "공식 원문과 현행 버전을 확인한 뒤 공개합니다." })),
    ...(criteria.data ?? []).map((row: any) => ({ id: row.id, kind: "criteria" as const, title: row.label_ko, subtitle: row.criteria_sets?.name ?? "비교 기준", description: "비교표에 사용할 기준 항목입니다.", ...reviewFields(states, "criteria", row.id, Boolean(row.criteria_sets?.is_published)), metadata: [`순서 ${row.sort_order}`, row.criteria_sets?.is_published ? "공개" : "검수 전"], note: "법제별 근거 조문을 연결한 뒤 공개합니다." })),
  ];
  return { items, source: "supabase" };
}

export async function loadPublicTeamReviewItems(): Promise<{ items: ReviewItem[]; source: "supabase" | "sample" }> {
  if (!url || !key) return { items: sampleItems, source: "sample" };
  // This client has no session or privileged key, so it always reads as `anon`.
  return loadCatalogItems(createClient(url, key));
}
