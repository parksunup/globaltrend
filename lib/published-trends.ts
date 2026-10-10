import { createClient } from "@supabase/supabase-js";

export type PublishedStory = {
  id: string;
  country: string;
  region: string;
  institution: string;
  title: string;
  originalTitle: string;
  summary: string;
  details: string;
  kind: string;
  tags: string[];
  date: string;
  officialUrl: string;
};

type ReportRow = {
  id: string; source_item_id: string; title_ko: string; one_line_summary_ko: string | null;
  detailed_summary_ko: string | null; jurisdictions: string[] | null; topics: string[] | null;
  published_at: string | null;
};
type SourceItemRow = {
  id: string; source_id: string; title_original: string; canonical_url: string;
  published_at: string | null; document_type: string;
};

const kindLabels: Record<string, string> = {
  news: "뉴스", press_release: "기관 발표", guidance: "가이드라인", decision: "결정",
  judgment: "판례", opinion: "의견", report: "보고서", legislation: "법령", other: "자료",
};

export async function loadPublishedStories(limit = 100, id?: string): Promise<PublishedStory[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public connection is not configured");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let query = supabase.from("reports")
    .select("id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics,published_at")
    .eq("status", "published");
  if (id) query = query.eq("id", id);
  const { data: reports, error } = await query.order("published_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Unable to load published reports: ${error.code}`);
  if (!reports?.length) return [];

  const { data: sourceItems, error: sourceError } = await supabase.from("source_items")
    .select("id,source_id,title_original,canonical_url,published_at,document_type")
    .in("id", reports.map((row: ReportRow) => row.source_item_id));
  if (sourceError) throw new Error(`Unable to load published source items: ${sourceError.code}`);
  if (!sourceItems?.length) throw new Error("Published reports have no readable source items");
  const itemById = new Map((sourceItems as SourceItemRow[]).map((row) => [row.id, row]));
  const sourceIds = [...new Set((sourceItems as SourceItemRow[]).map((row) => row.source_id))];
  const { data: sources, error: sourcesError } = await supabase.from("sources").select("id,name").in("id", sourceIds);
  if (sourcesError) throw new Error(`Unable to load source names: ${sourcesError.code}`);
  const sourceNames = new Map((sources ?? []).map((row) => [row.id, row.name]));

  return (reports as ReportRow[]).flatMap((report) => {
    const item = itemById.get(report.source_item_id);
    if (!item) return [];
    const dateValue = item.published_at ?? report.published_at;
    return [{
      id: report.id,
      country: report.jurisdictions?.[0] ?? "기타",
      region: report.jurisdictions?.join(" · ") || "국제",
      institution: sourceNames.get(item.source_id) ?? "공식 출처",
      title: report.title_ko,
      originalTitle: item.title_original,
      summary: report.one_line_summary_ko ?? "",
      details: report.detailed_summary_ko ?? "",
      kind: kindLabels[item.document_type] ?? "자료",
      tags: report.topics ?? [],
      date: dateValue ? dateValue.slice(0, 10).replaceAll("-", ".") : "날짜 미상",
      officialUrl: item.canonical_url,
    }];
  });
}

export async function loadPublishedStory(id: string): Promise<PublishedStory | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const stories = await loadPublishedStories(1, id);
  return stories.find((story) => story.id === id) ?? null;
}
