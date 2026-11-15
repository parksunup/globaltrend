export const jurisdictionNames: Record<string, string> = {
  KR: "한국", JP: "일본", CN: "중국", EU: "유럽연합(EU)",
  GB: "영국", UK: "영국", "US-CA": "미국·캘리포니아",
  US: "미국", SG: "싱가포르", FR: "프랑스", IE: "아일랜드",
  DE: "독일", AT: "오스트리아", BE: "벨기에",
  "유럽연합": "유럽연합(EU)",
  "미국 캘리포니아": "미국·캘리포니아",
  "미국 캘리포니아주": "미국·캘리포니아",
  "호주 연방": "호주",
  "international:OECD": "국제기구(OECD)",
};

export function jurisdictionName(code: string): string {
  const normalized = code.trim().replace(/\s+/g, " ");
  return jurisdictionNames[normalized] ?? normalized;
}

const countryLabelAliases: Record<string, string> = {
  "대한민국": "한국",
  "대한민국(한국)": "한국",
  "미합중국": "미국",
  "오스트레일리아": "호주",
  "호주": "호주",
  "유럽 연합": "유럽연합(EU)",
  "Republic of Korea": "한국",
  "South Korea": "한국",
  "United States of America": "미국",
  "United States": "미국",
  "Great Britain": "영국",
  "United Kingdom": "영국",
  "European Union": "유럽연합(EU)",
};

const countryPrefixes = (() => {
  const koreanNames = new Intl.DisplayNames(["ko"], { type: "region", fallback: "code" });
  const englishNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });
  const codes = Array.from({ length: 26 * 26 }, (_, index) => {
    const first = String.fromCharCode(65 + Math.floor(index / 26));
    const second = String.fromCharCode(65 + index % 26);
    return `${first}${second}`;
  });
  const labels = new Map<string, string>();

  for (const code of codes) {
    const korean = koreanNames.of(code);
    const english = englishNames.of(code);
    if (!korean || korean === code) continue;
    const canonical = countryLabelAliases[korean] ?? korean;
    labels.set(korean, canonical);
    if (english && english !== code) labels.set(english, canonical);
  }

  for (const [label, canonical] of Object.entries(countryLabelAliases)) labels.set(label, canonical);

  return [...labels.entries()]
    .map(([label, canonical]) => ({ label, canonical }))
    .sort((a, b) => b.label.length - a.label.length);
})();

export function jurisdictionFilterName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const label = jurisdictionName(normalized);
  const canonicalAlias = countryLabelAliases[label];
  if (canonicalAlias) return canonicalAlias;

  // Filter by the country root, not the free-form region or joint-scope suffix.
  // ISO region names are resolved at runtime so new country scopes do not need
  // another one-off alias every time a province, state, or joint label is added.
  const country = countryPrefixes.find(({ label: prefix }) => label.startsWith(prefix));
  return country?.canonical ?? label;
}
