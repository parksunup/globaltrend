import { createClient } from "@supabase/supabase-js";
import { sampleItems, type ReviewItem } from "./sample-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function loadReviewItems(): Promise<{ items: ReviewItem[]; source: "supabase" | "sample" }> {
  if (!url || !key) return { items: sampleItems, source: "sample" };

  const supabase = createClient(url, key);
  const [sources, laws, criteria] = await Promise.all([
    supabase.from("sources").select("id,name,start_url,source_kind,is_active,publishers(name)").eq("is_active", true).order("name"),
    supabase.from("legal_instruments").select("id,short_name,official_name,official_url,jurisdiction_code,is_published").order("short_name"),
    supabase.from("criteria").select("id,criterion_key,label_ko,sort_order,criteria_sets(name,is_published)").order("sort_order")
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