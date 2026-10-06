import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SubmissionItem = {
  id: string;
  group: "legal" | "trends";
  kind: string;
  title: string;
  subtitle: string;
  summary: string;
  status: string;
  fields: { label: string; value: string }[];
  links: { label: string; url: string }[];
  files: string[];
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function label(value: unknown, fallback = "검토 필요"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((part) => label(part, "")).filter(Boolean).join(", ") || fallback;
  return fallback;
}

function officialLink(value: unknown, title = "공식 원문") {
  if (typeof value !== "string") return [];
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? [{ label: title, url: url.toString() }] : [];
  } catch {
    return [];
  }
}

function readJson(root: string, path: string): JsonRecord | null {
  const fullPath = join(root, ...path.split("/"));
  if (!existsSync(fullPath)) return null;
  try {
    return record(JSON.parse(readFileSync(fullPath, "utf8")));
  } catch {
    return { __parse_error: true };
  }
}

function presentFiles(root: string, paths: string[]) {
  return paths.filter((path) => existsSync(join(root, ...path.split("/"))));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function legalItems(root: string): SubmissionItem[] {
  const path = "data/legal/instruments.csv";
  const fullPath = join(root, "data", "legal", "instruments.csv");
  if (!existsSync(fullPath)) return [];
  try {
    const [headings, ...rows] = parseCsv(readFileSync(fullPath, "utf8"));
    if (!headings?.includes("record_id")) throw new Error("필수 열이 없습니다.");
    const files = presentFiles(root, [path, "data/legal/instruments.md", "data/legal/review-notes.md"]);
    return rows.filter((row) => row.some(Boolean)).map((row, index) => {
      const data = Object.fromEntries(headings.map((heading, offset) => [heading, row[offset] ?? ""]));
      return {
        id: `legal-${data.record_id || index}`,
        group: "legal" as const,
        kind: "법제 목록",
        title: label(data.short_name || data.official_name),
        subtitle: label(data.official_name),
        summary: `현행 판본: ${label(data.version_label)} · 시행일: ${label(data.effective_date)}`,
        status: label(data.review_status, "unreviewed"),
        fields: [
          { label: "관할권", value: label(data.jurisdiction_code) },
          { label: "한국어 번역", value: label(data.korean_translation_status) },
          { label: "원문·번역 이용조건", value: label(data.reuse_status) },
        ],
        links: [...officialLink(data.official_url), ...officialLink(data.korean_translation_source_url, "한국어 번역 출처")],
        files,
      };
    });
  } catch (error) {
    return [{ id: "legal-error", group: "legal", kind: "법제 목록", title: "법제 목록을 읽을 수 없습니다", subtitle: path,
      summary: error instanceof Error ? error.message : "CSV 파싱 오류", status: "error", fields: [], links: [], files: [path] }];
  }
}

function appiItem(root: string): SubmissionItem[] {
  const path = "data/legal/translations/appi.json";
  const data = readJson(root, path);
  if (!data) return [];
  if (data.__parse_error) return [{ id: "appi-error", group: "legal", kind: "번역 진행", title: "APPI 상태를 읽을 수 없습니다", subtitle: path,
    summary: "JSON 파싱 오류", status: "error", fields: [], links: [], files: [path] }];
  const source = record(data.source);
  const translation = record(data.translation);
  const coverage = record(data.coverage);
  const translatedArticles = translation.translated_main_articles ?? translation.translated_articles;
  const totalArticles = translation.total_main_articles ?? coverage.main_articles;
  return [{
    id: "legal-appi-translation", group: "legal", kind: "번역 진행",
    title: `APPI · ${label(data.korean_title, "한국어 번역")}`,
    subtitle: label(data.official_name),
    summary: `본칙 번역 ${label(translatedArticles)}${totalArticles == null ? "" : `/${label(totalArticles)}`}조 · ${label(translation.status)}`,
    status: label(translation.public_release_status, "unreviewed"),
    fields: [
      { label: "원문 판본", value: label(source.version_status) },
      { label: "원문 확보", value: label(source.full_text_obtained) },
      { label: "누락·순서 대조", value: label(coverage.comparison_status) },
      { label: "공개 보류 사유", value: label(translation.withheld_reasons) },
    ],
    links: officialLink(source.original_url),
    files: presentFiles(root, [path, "data/legal/translations/appi.md", "data/legal/translations/appi-status.md", "data/legal/translations/appi-review-notes.md"]),
  }];
}

function sourceConfigItems(root: string): SubmissionItem[] {
  return ["edpb", "oecd", "curia"].flatMap((source) => {
    const path = `data/trends/source-configs/${source}.json`;
    const data = readJson(root, path);
    if (!data) return [];
    if (data.__parse_error) return [{ id: `source-${source}-error`, group: "trends" as const, kind: "수집 출처", title: `${source.toUpperCase()} 설정을 읽을 수 없습니다`, subtitle: path,
      summary: "JSON 파싱 오류", status: "error", fields: [], links: [], files: [path] }];
    const verification = record(data.verification);
    return [{
      id: `source-${source}`, group: "trends" as const, kind: "수집 출처", title: label(data.organization, source.toUpperCase()),
      subtitle: source.toUpperCase(), summary: label(data.collection_method), status: label(data.review_status, "unreviewed"),
      fields: [
        { label: "목록 확인", value: label(verification.listing_page_checked) },
        { label: "상세 확인", value: label(verification.detail_page_checked) },
        { label: "자료 유형", value: label(data.document_types) },
        { label: "이용조건", value: label(data.terms_status) },
      ],
      links: [...officialLink(data.start_url, "수집 시작 URL"), ...(Array.isArray(data.sample_urls) ? data.sample_urls.flatMap((url) => officialLink(url, "예시 자료")) : [])],
      files: presentFiles(root, [path, `data/trends/source-configs/${source}.md`]),
    }];
  });
}

function fixtureItems(root: string): SubmissionItem[] {
  return ["edpb", "oecd", "curia"].flatMap((source) => {
    const path = `data/trends/fixtures/${source}.json`;
    const data = readJson(root, path);
    if (!data) return [];
    if (data.__parse_error) return [{ id: `fixture-${source}-error`, group: "trends" as const, kind: "동향 표본", title: `${source.toUpperCase()} 표본을 읽을 수 없습니다`, subtitle: path,
      summary: "JSON 파싱 오류", status: "error", fields: [], links: [], files: [path] }];
    const rows = Array.isArray(data.items) ? data.items : [];
    return rows.map((value, index) => {
      const item = record(value);
      const evidence = Array.isArray(item.evidence) ? item.evidence.map(record) : [];
      return {
        id: `fixture-${source}-${label(item.record_id, String(index))}`, group: "trends" as const, kind: "동향 표본",
        title: label(item.korean_title, label(item.original_title)), subtitle: label(item.original_title),
        summary: label(item.summary_ko), status: label(item.review_status, "unreviewed"),
        fields: [
          { label: "기관", value: label(item.organization) },
          { label: "게시일", value: label(item.source_published_date) },
          { label: "관할권", value: label(item.jurisdictions) },
          { label: "자료 유형", value: label(item.document_type) },
          { label: "요약 근거 위치", value: evidence.map((row) => label(row.location, "")).filter(Boolean).join(" · ") || "검토 필요" },
          { label: "검토 메모", value: label(item.review_notes) },
        ],
        links: [...officialLink(item.official_url), ...evidence.flatMap((row) => officialLink(row.url, "요약 근거"))],
        files: presentFiles(root, [path, `data/trends/fixtures/${source}.md`, "data/trends/fixtures/review-notes.md"]),
      };
    });
  });
}

function weeklyItem(root: string): SubmissionItem[] {
  const path = "data/trends/weekly-sample.json";
  const data = readJson(root, path);
  if (!data) return [];
  if (data.__parse_error) return [{ id: "weekly-error", group: "trends", kind: "주간 예시 호", title: "주간 예시 호를 읽을 수 없습니다", subtitle: path,
    summary: "JSON 파싱 오류", status: "error", fields: [], links: [], files: [path] }];
  const entries = Array.isArray(data.entries) ? data.entries.map(record) : [];
  return [{
    id: "weekly-sample", group: "trends", kind: "주간 예시 호", title: label(data.title, "주간 동향 예시 호"),
    subtitle: "실제 발행물이 아닌 편집 예시",
    summary: label(data.coverage_notice, `${entries.length}건 수록`), status: label(data.publication_status, "draft"),
    fields: [
      { label: "수록 항목", value: entries.map((entry, index) => `${index + 1}. ${label(entry.korean_title, label(entry.original_title))}`).join("\n") || "없음" },
      { label: "사람 검수", value: label(data.human_review_status) },
      { label: "실제 공개", value: label(data.is_published) },
      { label: "제외 항목", value: Array.isArray(data.excluded_items) ? `${data.excluded_items.length}건` : label(data.excluded_items) },
    ],
    links: [], files: presentFiles(root, [path, "data/trends/weekly-sample.md", "data/trends/fixtures/review-notes.md"]),
  }];
}

/** Reads only known, committed team deliverable paths from this deployment's checkout. No DB writes. */
export function loadSubmissionPreview(root = process.cwd()): SubmissionItem[] {
  return [...legalItems(root), ...appiItem(root), ...sourceConfigItems(root), ...fixtureItems(root), ...weeklyItem(root)];
}

export function submissionPreviewEnabled() {
  return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
}
