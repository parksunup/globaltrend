import { jurisdictionFilterName } from "./jurisdictions.ts";

// Stable filter keys also cover countries first encountered after a link was saved.
export const trendCountryOptions = [
  { label: "한국", codes: ["KR"] },
  { label: "일본", codes: ["JP"] },
  { label: "중국", codes: ["CN"] },
  { label: "유럽연합(EU)", codes: ["EU"] },
  { label: "영국", codes: ["GB"] },
  { label: "미국", codes: ["US"] },
  { label: "싱가포르", codes: ["SG"] },
  { label: "기타", codes: ["OTHER"] },
];

export function trendCountryGroup(value: string): string {
  const normalized = value.trim();
  const code = normalized.toUpperCase();
  if (code === "UK") return "GB";
  if (trendCountryOptions.some(option => option.codes.includes(code))) return code;
  if (/^US(?:-|$)/i.test(normalized)) return "US";
  const label = jurisdictionFilterName(normalized);
  return trendCountryOptions.find(option => option.label === label)?.codes[0] ?? "OTHER";
}

export function selectedTrendCountries(value = ""): string[] {
  return [...new Set(value.split(",").filter(Boolean).map(trendCountryGroup))];
}
