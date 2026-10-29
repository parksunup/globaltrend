import { createClient } from "@supabase/supabase-js";
import { jurisdictionName } from "./jurisdictions.ts";
import { readAllPages } from "./read-all-pages.ts";

export type PublishedStory = {
  publicationStatus?: "published" | "draft" | "unknown";
  id: string;
  country: string;
  jurisdictions?: string[];
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

const PAGE_SIZE = 500;
const LOOKUP_BATCH_SIZE = 200;

function batches<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < rows.length; offset += size) result.push(rows.slice(offset, offset + size));
  return result;
}

export async function loadPublishedStories(id?: string): Promise<PublishedStory[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public connection is not configured");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const readPage = async (offset: number, count: number): Promise<ReportRow[]> => {
    let query = supabase.from("reports")
      .select("id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics,published_at")
      .eq("status", "published");
    if (id) query = query.eq("id", id);
    const { data, error } = await query.order("published_at", { ascending: false })
      .order("id", { ascending: true }).range(offset, offset + count - 1);
    if (error) throw new Error(`Unable to load published reports: ${error.code}`);
    return (data ?? []) as ReportRow[];
  };
  const reports = id ? await readPage(0, 1) : await readAllPages(readPage, PAGE_SIZE);
  if (!reports.length) return [];

  const sourceItems: SourceItemRow[] = [];
  for (const ids of batches([...new Set(reports.map(row => row.source_item_id))], LOOKUP_BATCH_SIZE)) {
    const { data, error } = await supabase.from("source_items")
      .select("id,source_id,title_original,canonical_url,published_at,document_type").in("id", ids);
    if (error) throw new Error(`Unable to load published source items: ${error.code}`);
    sourceItems.push(...(data ?? []) as SourceItemRow[]);
  }
  const itemById = new Map(sourceItems.map(row => [row.id, row]));
  if (reports.some(report => !itemById.has(report.source_item_id))) {
    throw new Error("Published reports have unreadable source items");
  }
  const sourceIds = [...new Set(sourceItems.map(row => row.source_id))];
  const sourceNames = new Map<string, string>();
  for (const ids of batches(sourceIds, LOOKUP_BATCH_SIZE)) {
    const { data, error } = await supabase.from("sources").select("id,name").in("id", ids);
    if (error) throw new Error(`Unable to load source names: ${error.code}`);
    for (const row of data ?? []) sourceNames.set(row.id, row.name);
  }

  return reports.flatMap((report) => {
    const item = itemById.get(report.source_item_id);
    if (!item) return [];
    const dateValue = item.published_at ?? report.published_at;
    return [{
      id: report.id, publicationStatus: "published",
      country: report.jurisdictions?.[0] ?? "기타",
      jurisdictions: report.jurisdictions ?? [],
      region: report.jurisdictions?.map(jurisdictionName).join(" · ") || "국제",
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
  const stories = await loadPublishedStories(id);
  return stories.find((story) => story.id === id) ?? null;
}
