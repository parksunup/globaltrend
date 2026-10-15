import { readFileSync } from "node:fs";
import { join } from "node:path";

export type TrendImportCandidate = {
  id: string;
  source: "edpb" | "oecd" | "curia";
  originalTitle: string;
  title: string;
  summary: string;
  details: string;
  officialUrl: string;
  publishedDate: string;
  jurisdictions: string[];
  topics: string[];
};

type Row = Record<string, unknown>;
const sources = ["edpb", "oecd", "curia"] as const;

function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function json(root: string, path: string): Row {
  try { return row(JSON.parse(readFileSync(join(root, ...path.split("/")), "utf8"))); }
  catch { return {}; }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((part): part is string => typeof part === "string" && !!part.trim()) : [];
}

function https(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

/** Only examples selected into the submitted weekly issue can prefill an editor's draft. */
export function loadTrendImportCandidates(root = process.cwd()): TrendImportCandidate[] {
  const weekly = json(root, "data/trends/weekly-sample.json");
  if (!Array.isArray(weekly.entries)) return [];
  const fixtures = new Map(sources.map((source) => {
    const data = json(root, `data/trends/fixtures/${source}.json`);
    const items = Array.isArray(data.items) ? data.items.map(row) : [];
    return [source, new Map(items.map((item) => [text(item.record_id), item]))] as const;
  }));
  const seen = new Set<string>();
  return weekly.entries.flatMap((value): TrendImportCandidate[] => {
    const entry = row(value);
    const source = text(entry.source_id);
    if (!sources.includes(source as typeof sources[number])) return [];
    const id = text(entry.fixture_record_id);
    const item = fixtures.get(source as typeof sources[number])?.get(id);
    const officialUrl = text(item?.official_url);
    const publishedDate = text(item?.source_published_date);
    if (!id || seen.has(id) || !item || !https(officialUrl) ||
        officialUrl !== text(entry.official_url) ||
        publishedDate !== text(entry.source_published_date) || !/^\d{4}-\d{2}-\d{2}$/.test(publishedDate) ||
        !text(item.original_title) || !text(item.korean_title) || !text(item.summary_ko)) return [];
    seen.add(id);
    const keyPoints = strings(entry.key_points_ko).join("\n");
    const significance = text(row(entry.privacy_significance).text_ko);
    return [{
      id, source: source as typeof sources[number], originalTitle: text(item.original_title),
      title: text(item.korean_title), summary: text(item.summary_ko),
      details: [keyPoints, significance].filter(Boolean).join("\n\n"),
      officialUrl, publishedDate,
      jurisdictions: strings(item.jurisdictions), topics: strings(item.topic_tags),
    }];
  });
}
