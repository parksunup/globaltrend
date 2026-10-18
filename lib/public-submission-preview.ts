import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PublishedStory } from "./published-trends";
import { jurisdictionName } from "./jurisdictions.ts";
import { loadTrendEditorial } from "./trend-editorial.ts";

const kindNames: Record<string, string> = {
  official_news: "기관 소식", official_advisory: "기관 안내", press_release: "보도자료",
  guidance: "가이드라인", decision: "결정", judgment: "판례", report: "보고서",
  policy_report: "정책 보고서", legislation: "법령",
};

type Row = Record<string, unknown>;
function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function value(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}
function strings(input: unknown): string[] {
  return Array.isArray(input) ? input.map(value).filter(Boolean) : [];
}
function https(input: string): boolean {
  try { return new URL(input).protocol === "https:"; } catch { return false; }
}
function json(root: string, path: string): Row {
  try { return row(JSON.parse(readFileSync(join(root, ...path.split("/")), "utf8"))); }
  catch { return {}; }
}
function sourceIds(root: string, directory: "fixtures" | "source-configs"): string[] {
  const path = join(root, "data", "trends", directory);
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((name) => /^[a-z0-9][a-z0-9-]*\.json$/.test(name))
    .map((name) => name.slice(0, -5)).sort();
}

/** Submitted fixtures are displayed only on the isolated integration Preview. */
export function loadSubmittedStories(root = process.cwd()): PublishedStory[] {
  const editorial=loadTrendEditorial(root);
  const seen = new Set<string>();
  return sourceIds(root, "fixtures").flatMap((source): PublishedStory[] => {
    const data = json(root, `data/trends/fixtures/${source}.json`);
    if (!Array.isArray(data.items)) return [];
    return data.items.flatMap((input): PublishedStory[] => {
      const item = row(input);
      const recordId = value(item.record_id);
      const title = value(item.korean_title);
      const summary = value(item.summary_ko);
      const officialUrl = value(item.official_url);
      const date = value(item.source_published_date);
      if (!recordId || seen.has(recordId) || !title || !summary ||
          !https(officialUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      seen.add(recordId);
      const countries = strings(item.jurisdictions);
      const country = countries[0] || source.toUpperCase();
      const keyPoints = Array.isArray(item.key_points_ko)
        ? item.key_points_ko.map((point) => value(row(point).text)).filter(Boolean).join("\n\n")
        : "";
      const edited=editorial.get(recordId);
      return [{
        id: recordId, country, jurisdictions: countries, region: countries.map(jurisdictionName).join(" · ") || jurisdictionName(country),
        institution: source.toUpperCase(), title:edited?.title_ko||title, originalTitle: value(item.original_title),
        summary:edited?.summary_ko||summary, details:edited?.details_ko||value(item.details_ko)||keyPoints, kind: kindNames[value(item.document_type)] || value(item.document_type) || "공식 자료",
        tags: strings(item.topic_tags), date: date.replaceAll("-", "."),
        officialUrl,
      }];
    });
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export type SubmittedSource = {
  id: string; organization: string; startUrl: string; documentTypes: string[];
  reviewStatus: string; termsStatus: string; sampleCount: number; collectionMethod: string;
};

export function loadSubmittedSources(root = process.cwd()): SubmittedSource[] {
  return sourceIds(root, "source-configs").map((id) => {
    const data = json(root, `data/trends/source-configs/${id}.json`);
    const samples = json(root, `data/trends/fixtures/${id}.json`);
    return {
      id, organization: value(data.organization) || id.toUpperCase(),
      startUrl: value(data.start_url), documentTypes: strings(data.document_types),
      reviewStatus: value(data.review_status) || "unreviewed",
      termsStatus: value(data.terms_status) || "unreviewed",
      sampleCount: Array.isArray(samples.items) ? samples.items.length : 0,
      collectionMethod: value(data.collection_method),
    };
  });
}

export function publicSubmissionPreviewEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview" ||
    (process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV === "development");
}
