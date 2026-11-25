import type { PublishedStory } from "./published-trends.ts";
import { jurisdictionFilterName } from "./jurisdictions.ts";
import { matchesPublicTopic } from "./public-topics.ts";
import { inCustomDateRange } from "./public-search-filters.ts";

export type TrendSearchFilters = { q?: string; topic?: string; page?: string; country?: string; period?: string; from?: string; to?: string; mode?: string; sort?: string; restore?: string };
export const allowedPeriods = ["전체", "최근 1개월", "최근 6개월", "최근 1년", "직접 설정"];
const relatedTerms: Record<string, string[]> = {
  "아동": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "아동 개인정보": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "인공지능": ["인공지능", "생성형 AI", "자동화", "알고리즘"],
  "국외 이전": ["국외 이전", "국제 이전", "역외 이전", "국경 간"],
  "제재": ["제재", "과징금", "집행", "벌금"],
};

export const trendPageSize = 24;

export function searchTrendPage(stories: PublishedStory[], filters: TrendSearchFilters) {
  const { q: submittedQuery = "", topic: topicId = "", mode, sort, period, from: customStart = "", to: customEnd = "" } = filters;
  const countries = (filters.country ?? "").split(",").filter(Boolean);
  const terms = (() => {
    const normalized = submittedQuery.trim().toLocaleLowerCase();
    if (!normalized) return [];
    if (mode === "concept") {
      const match = Object.keys(relatedTerms).find((key) => normalized.includes(key.toLocaleLowerCase()) || key.toLocaleLowerCase().includes(normalized));
      return match ? relatedTerms[match].map((term) => term.toLocaleLowerCase()) : normalized.split(/\s+/);
    }
    return normalized.split(/\s+/).filter(Boolean);
  })();
  const ageInMonths = period === "최근 1개월" ? 1 : period === "최근 6개월" ? 6 : period === "최근 1년" ? 12 : 0;
  const now = new Date();
  const dateCutoff = new Date(now.setMonth(now.getMonth() - ageInMonths));
  const dateOrder = (value: string) => value === "날짜 미상" ? "" : value;
  const filtered = stories.filter((story) => {
    const countryMatch = countries.length === 0 || countries.some((country) => (story.jurisdictions?.length ? story.jurisdictions : [story.country]).includes(country));
    const topicMatch = !topicId || matchesPublicTopic(story.tags, topicId);
    const searchable = [story.title, story.originalTitle, story.summary, story.institution, ...story.tags].join(" ").toLocaleLowerCase();
    const queryMatch = !terms.length || (mode === "concept" ? terms.some((term) => searchable.includes(term)) : terms.every((term) => searchable.includes(term)));
    const published = new Date(story.date.replaceAll(".", "-"));
    const storyDate = story.date.replaceAll(".", "-");
    const periodMatch = period === "직접 설정" ? inCustomDateRange(storyDate, customStart, customEnd)
      : !ageInMonths || published >= dateCutoff;
    return countryMatch && topicMatch && queryMatch && periodMatch;
  });
  const ordered = sort === "최신순" ? filtered.slice().sort((a, b) => dateOrder(b.date).localeCompare(dateOrder(a.date))) : filtered.slice().sort((a, b) => {
    const score = (story: PublishedStory) => terms.reduce((total, term) => total + (story.title.toLocaleLowerCase().includes(term) ? 3 : story.tags.join(" ").toLocaleLowerCase().includes(term) ? 2 : story.summary.toLocaleLowerCase().includes(term) ? 1 : 0), 0);
    return score(b) - score(a) || dateOrder(b.date).localeCompare(dateOrder(a.date));
  });
  const groups = new Map<string, Set<string>>();
  for (const story of stories) {
    for (const code of story.jurisdictions?.length ? story.jurisdictions : [story.country]) {
      if (!code) continue;
      const label = jurisdictionFilterName(code);
      const codes = groups.get(label) ?? new Set<string>();
      codes.add(code);
      groups.set(label, codes);
    }
  }
  const countryOptions = [...groups].map(([label, codes]) => ({label, codes: [...codes].sort()}))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const pageCount = Math.max(1, Math.ceil(ordered.length / trendPageSize));
  const requestedPage = Number(filters.page);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(pageCount, requestedPage)) : 1;
  return {
    stories: ordered.slice((page - 1) * trendPageSize, page * trendPageSize),
    total: ordered.length,
    hasCatalog: stories.length > 0,
    countryOptions,
    page,
    pageCount,
  };
}

export function trendSearchHref(filters: TrendSearchFilters) {
  const params = new URLSearchParams();
  for (const key of ["q", "topic", "country", "period", "from", "to", "mode", "sort", "page", "restore"] as const) {
    const value = filters[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  return params.size ? `/public/search?${params.toString()}` : "/public/search";
}
