export const jurisdictionNames: Record<string, string> = {
  KR: "한국", JP: "일본", CN: "중국", EU: "유럽연합(EU)",
  GB: "영국", UK: "영국", "US-CA": "미국·캘리포니아",
  US: "미국", SG: "싱가포르", FR: "프랑스", IE: "아일랜드",
  DE: "독일", AT: "오스트리아", BE: "벨기에",
  "international:OECD": "국제기구(OECD)",
};

export function jurisdictionName(code: string): string {
  return jurisdictionNames[code] ?? code;
}
