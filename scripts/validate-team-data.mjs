import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REVIEW_STATUSES = new Set(["unreviewed", "in_review", "verified", "blocked"]);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("닫히지 않은 따옴표가 있습니다.");
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function containsRecordId(markdown, recordId) {
  const escaped = recordId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`, "m").test(markdown);
}

export async function validateLegalData(rootDir) {
  const errors = [];
  const directory = path.join(rootDir, "data", "legal");
  const files = {
    markdown: path.join(directory, "instruments.md"),
    csv: path.join(directory, "instruments.csv"),
    notes: path.join(directory, "review-notes.md"),
  };
  const presence = await Promise.all(Object.values(files).map(exists));
  if (!presence.some(Boolean)) return errors;

  for (const [index, [name, filePath]] of Object.entries(Object.entries(files))) {
    if (!presence[Number(index)]) errors.push(`법제 결과에 ${path.basename(filePath)} 파일이 필요합니다 (${name}).`);
  }
  if (!presence[1]) return errors;

  const requiredColumns = [
    "record_id",
    "jurisdiction_code",
    "short_name",
    "official_name",
    "official_url",
    "version_label",
    "effective_date",
    "korean_translation_status",
    "korean_translation_source_url",
    "reuse_status",
    "review_status",
  ];
  let rows;
  try {
    rows = parseCsv(await readFile(files.csv, "utf8"));
  } catch (error) {
    return [...errors, `instruments.csv를 읽을 수 없습니다: ${error.message}`];
  }
  if (rows.length === 0) return [...errors, "instruments.csv에 헤더가 없습니다."];

  const header = rows[0];
  const markdown = presence[0] ? await readFile(files.markdown, "utf8") : "";
  const missingColumns = requiredColumns.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) errors.push(`instruments.csv 필수 열이 없습니다: ${missingColumns.join(", ")}`);

  const seen = new Set();
  for (let index = 1; index < rows.length; index += 1) {
    const values = Object.fromEntries(header.map((column, columnIndex) => [column, rows[index][columnIndex] ?? ""]));
    const line = index + 1;
    for (const field of ["record_id", "jurisdiction_code", "short_name", "official_name", "official_url", "version_label", "korean_translation_status", "reuse_status", "review_status"]) {
      if (!values[field]?.trim()) errors.push(`instruments.csv ${line}행의 ${field} 값이 비어 있습니다.`);
    }
    if (values.record_id) {
      if (seen.has(values.record_id)) errors.push(`instruments.csv에 중복 record_id가 있습니다: ${values.record_id}`);
      seen.add(values.record_id);
      if (presence[0] && !containsRecordId(markdown, values.record_id)) errors.push(`법제 Markdown에 CSV record_id가 없습니다: ${values.record_id}`);
    }
    if (values.official_url && !isHttps(values.official_url)) errors.push(`instruments.csv ${line}행 official_url은 https:// 주소여야 합니다.`);
    if (values.korean_translation_source_url && !isHttps(values.korean_translation_source_url)) errors.push(`instruments.csv ${line}행 korean_translation_source_url은 https:// 주소여야 합니다.`);
    for (const field of ["korean_translation_status", "reuse_status", "review_status"]) {
      if (values[field] && !REVIEW_STATUSES.has(values[field])) errors.push(`instruments.csv ${line}행의 ${field} 상태값이 올바르지 않습니다: ${values[field]}`);
    }
  }
  return errors;
}

export async function validateTrendData(rootDir) {
  const errors = [];
  const trendDirectory = path.join(rootDir, "data", "trends");
  const configDirectory = path.join(trendDirectory, "source-configs");
  let entries = [];
  try {
    entries = await readdir(configDirectory);
  } catch {
    return errors;
  }
  const jsonFiles = entries.filter((name) => name.endsWith(".json") && !name.includes(".template."));
  if (jsonFiles.length === 0) return errors;

  if (!(await exists(path.join(trendDirectory, "review-notes.md")))) errors.push("동향 결과에 review-notes.md 파일이 필요합니다.");
  const requiredFields = ["record_id", "organization", "start_url", "document_types", "collection_method", "field_locations", "exclude_rules", "terms_status", "sample_urls", "review_status"];
  const seen = new Set();

  for (const fileName of jsonFiles) {
    const baseName = fileName.slice(0, -5);
    const markdownPath = path.join(configDirectory, `${baseName}.md`);
    const markdownExists = await exists(markdownPath);
    if (!markdownExists) errors.push(`동향 JSON ${fileName}에 대응하는 ${baseName}.md 파일이 필요합니다.`);
    let data;
    try {
      data = JSON.parse(await readFile(path.join(configDirectory, fileName), "utf8"));
    } catch (error) {
      errors.push(`${fileName}을 JSON으로 읽을 수 없습니다: ${error.message}`);
      continue;
    }
    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null || value === "") errors.push(`${fileName}의 필수 필드 ${field} 값이 비어 있습니다.`);
    }
    if (data.record_id) {
      if (seen.has(data.record_id)) errors.push(`동향 JSON에 중복 record_id가 있습니다: ${data.record_id}`);
      seen.add(data.record_id);
      if (markdownExists) {
        const markdown = await readFile(markdownPath, "utf8");
        if (!containsRecordId(markdown, data.record_id)) errors.push(`${baseName}.md Markdown에 JSON record_id가 없습니다: ${data.record_id}`);
      }
    }
    if (data.start_url && !isHttps(data.start_url)) errors.push(`${fileName}의 start_url은 https:// 주소여야 합니다.`);
    for (const sampleUrl of Array.isArray(data.sample_urls) ? data.sample_urls : []) {
      if (!isHttps(sampleUrl)) errors.push(`${fileName}의 sample_urls는 https:// 주소여야 합니다: ${sampleUrl}`);
    }
    for (const field of ["terms_status", "review_status"]) {
      if (data[field] && !REVIEW_STATUSES.has(data[field])) errors.push(`${fileName}의 ${field} 상태값이 올바르지 않습니다: ${data[field]}`);
    }
    if (!Array.isArray(data.document_types) || data.document_types.length === 0) errors.push(`${fileName}의 document_types에는 한 개 이상의 자료 유형이 필요합니다.`);
    if (!Array.isArray(data.exclude_rules)) errors.push(`${fileName}의 exclude_rules는 배열이어야 합니다.`);
    if (!Array.isArray(data.sample_urls)) errors.push(`${fileName}의 sample_urls는 배열이어야 합니다.`);
    for (const field of ["title", "published_at", "content"]) {
      if (!data.field_locations || typeof data.field_locations !== "object" || !data.field_locations[field]) errors.push(`${fileName}의 field_locations.${field} 값이 필요합니다.`);
    }
  }
  return errors;
}

export async function validateTeamData(rootDir) {
  const [legalErrors, trendErrors] = await Promise.all([
    validateLegalData(rootDir),
    validateTrendData(rootDir),
  ]);
  return [...legalErrors, ...trendErrors];
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const rootDir = path.resolve(process.argv[2] ?? process.cwd());
  const errors = await validateTeamData(rootDir);
  if (errors.length > 0) {
    console.error("팀 데이터 검사에 실패했습니다:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("팀 데이터 검사를 통과했습니다.");
  }
}
