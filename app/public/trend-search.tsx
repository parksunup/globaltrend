"use client";

import { useMemo, useState } from "react";
import styles from "./public.module.css";

import type { PublishedStory } from "../../lib/published-trends";
import { jurisdictionName } from "../../lib/jurisdictions";
import { matchesPublicTopic, publicTopics } from "../../lib/public-topics";
import { inCustomDateRange } from "../../lib/public-search-filters";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type InitialFilters = { country?: string; period?: string; from?: string; to?: string; mode?: string; sort?: string; restore?: string };
const allowedPeriods = ["전체", "최근 1개월", "최근 6개월", "최근 1년", "직접 설정"];
const relatedTerms: Record<string, string[]> = {
  "아동": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "아동 개인정보": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "인공지능": ["인공지능", "생성형 AI", "자동화", "알고리즘"],
  "국외 이전": ["국외 이전", "국제 이전", "역외 이전", "국경 간"],
  "제재": ["제재", "과징금", "집행", "벌금"],
};

export default function TrendSearch({ initialQuery, initialTopic, initialFilters = {}, stories, loadError }: { initialQuery: string; initialTopic: string; initialFilters?: InitialFilters; stories: PublishedStory[]; loadError: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [mode, setMode] = useState<"keyword" | "concept">(initialFilters.mode === "concept" ? "concept" : "keyword");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [countries, setCountries] = useState<string[]>(initialFilters.country ? initialFilters.country.split(",").filter(Boolean) : []);
  const [period, setPeriod] = useState(allowedPeriods.includes(initialFilters.period ?? "") ? initialFilters.period! : "전체");
  const [customStart, setCustomStart] = useState(initialFilters.from ?? "");
  const [customEnd, setCustomEnd] = useState(initialFilters.to ?? "");
  const [topicId, setTopicId] = useState(initialTopic);
  useEffect(() => { setQuery(initialQuery); setSubmittedQuery(initialQuery); setTopicId(initialTopic); }, [initialQuery, initialTopic]);
  const [sort, setSort] = useState<"관련도순" | "최신순">(initialFilters.sort === "최신순" ? "최신순" : "관련도순");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { if (initialFilters.restore !== "1") return; try { const position = Number(sessionStorage.getItem("globaltrend-search-scroll")); if (Number.isFinite(position)) requestAnimationFrame(() => window.scrollTo(0, position)); } catch { /* optional scroll memory */ } }, [initialFilters.restore]);
  const countryOptions = useMemo(() => Array.from(new Set(stories.flatMap((story) => story.jurisdictions?.length ? story.jurisdictions : [story.country]))).sort((a, b) => jurisdictionName(a).localeCompare(jurisdictionName(b), "ko")), [stories]);
  const activeTopic = publicTopics.find((topic) => topic.id === topicId);
  const terms = useMemo(() => {
    const normalized = submittedQuery.trim().toLocaleLowerCase();
    if (!normalized) return [];
    if (mode === "concept") {
      const match = Object.keys(relatedTerms).find((key) => normalized.includes(key.toLocaleLowerCase()) || key.toLocaleLowerCase().includes(normalized));
      return match ? relatedTerms[match].map((term) => term.toLocaleLowerCase()) : normalized.split(/\s+/);
    }
    return normalized.split(/\s+/).filter(Boolean);
  }, [submittedQuery, mode]);
  const results = useMemo(() => {
    const filtered = stories.filter((story) => {
      const countryMatch = countries.length === 0 || countries.some((country) => (story.jurisdictions?.length ? story.jurisdictions : [story.country]).includes(country));
      const topicMatch = !topicId || matchesPublicTopic(story.tags, topicId);
      const searchable = [story.title, story.originalTitle, story.summary, story.institution, ...story.tags].join(" ").toLocaleLowerCase();
      const queryMatch = !terms.length || (mode === "concept" ? terms.some((term) => searchable.includes(term)) : terms.every((term) => searchable.includes(term)));
      const ageInMonths = period === "최근 1개월" ? 1 : period === "최근 6개월" ? 6 : period === "최근 1년" ? 12 : 0;
      const published = new Date(story.date.replaceAll(".", "-"));
      const storyDate = story.date.replaceAll(".", "-");
      const periodMatch = period === "직접 설정" ? inCustomDateRange(storyDate, customStart, customEnd)
        : !ageInMonths || published >= new Date(new Date().setMonth(new Date().getMonth() - ageInMonths));
      return countryMatch && topicMatch && queryMatch && periodMatch;
    });
    return sort === "최신순" ? filtered.slice().sort((a, b) => b.date.localeCompare(a.date)) : filtered.slice().sort((a, b) => {
      const score = (story: PublishedStory) => terms.reduce((total, term) => total + (story.title.toLocaleLowerCase().includes(term) ? 3 : story.tags.join(" ").toLocaleLowerCase().includes(term) ? 2 : story.summary.toLocaleLowerCase().includes(term) ? 1 : 0), 0);
      return score(b) - score(a) || b.date.localeCompare(a.date);
    });
  }, [countries, topicId, period, customStart, customEnd, sort, terms, mode, stories]);
  const active = results.find((story) => story.id === selected) ?? results[0];
  const returnParams = new URLSearchParams();
  if (submittedQuery.trim()) returnParams.set("q", submittedQuery.trim());
  if (topicId) returnParams.set("topic", topicId);
  if (countries.length) returnParams.set("country", countries.join(","));
  if (period !== "전체") returnParams.set("period", period);
  if (customStart) returnParams.set("from", customStart);
  if (customEnd) returnParams.set("to", customEnd);
  if (mode !== "keyword") returnParams.set("mode", mode);
  if (sort !== "관련도순") returnParams.set("sort", sort);
  returnParams.set("restore", "1");
  const returnTo = `/public/search?${returnParams.toString()}`;
  function submitQuery(value: string) {
    setSubmittedQuery(value);
    setSelected(null);
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    if (topicId) params.set("topic", topicId);
    router.push(`/public/search${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  return <section className={styles.searchPage}>
    <div className={styles.searchIntro}>
      <p className={styles.eyebrow}><span /> SEARCH THE SIGNALS</p>
      <h1>동향 검색</h1>
      <p>키워드와 관련 개념으로 관심 있는 개인정보 보호 동향을 찾아보세요.</p>
    </div>
    <form className={styles.searchBox} role="search" onSubmit={(event) => { event.preventDefault(); submitQuery(query); }}>
      <span aria-hidden="true">⌕</span>
      <input value={query} onChange={(event) => { setQuery(event.target.value); }} aria-label="동향 검색어" placeholder="예: 아동 개인정보" />
      {query && <button type="button" onClick={() => { setQuery(""); submitQuery(""); }} aria-label="검색어 지우기">×</button>}
      <button className={styles.searchSubmit} type="submit">검색</button>
    </form>
    <div className={styles.searchControls}>
      <div className={styles.modeSwitch} aria-label="검색 방식">
        <button type="button" className={mode === "keyword" ? styles.modeActive : ""} onClick={() => { setMode("keyword"); setSelected(null); }}>키워드 검색</button>
        <button type="button" className={mode === "concept" ? styles.modeActive : ""} onClick={() => { setMode("concept"); setSelected(null); }}>관련 개념까지</button>
      </div>
      <span className={styles.modeHint}>{mode === "keyword" ? "입력한 단어가 포함된 자료를 찾습니다." : "비슷한 표현을 함께 찾는 화면 시연입니다."}</span>
    </div>
    {activeTopic && <div className={styles.activeTopic}>주제: <strong>{activeTopic.label}</strong><button type="button" onClick={() => { setTopicId(""); setSelected(null); router.push(submittedQuery.trim() ? `/public/search?q=${encodeURIComponent(submittedQuery.trim())}` : "/public/search", { scroll: false }); }}>주제 해제 ×</button></div>}
    <div className={styles.searchLayout}>
      <aside className={`${styles.filters} ${!filtersExpanded ? styles.filtersClosed : ""}`}>
        <button type="button" className={styles.mobileFilterToggle} aria-expanded={filtersExpanded} onClick={() => setFiltersExpanded(!filtersExpanded)}>{filtersExpanded ? "검색 필터 접기" : "검색 필터 펼치기"}</button>
        <div className={styles.filterHeading}><span>검색 필터</span><button type="button" onClick={() => { setCountries([]); setPeriod("전체"); setCustomStart(""); setCustomEnd(""); setTopicId(""); setSort("관련도순"); setSelected(null); router.push(submittedQuery.trim() ? `/public/search?q=${encodeURIComponent(submittedQuery.trim())}` : "/public/search", { scroll: false }); }}>초기화</button></div>
        <details open className={styles.filterGroup}><summary>기간</summary>{["전체", "최근 1개월", "최근 6개월", "최근 1년", "직접 설정"].map((value) => <button key={value} type="button" className={period === value ? styles.filterSelected : ""} onClick={() => { setPeriod(value); setSelected(null); if (value === "직접 설정" && !customStart && !customEnd) { const now = new Date(); const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1); const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); setCustomStart(localDate(yearAgo)); setCustomEnd(localDate(now)); } }}><span>{value}</span><span>{period === value ? "●" : "○"}</span></button>)}{period === "직접 설정" && <div className={styles.dateRange}><label>시작일<input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => { setCustomStart(event.target.value); setSelected(null); }} /></label><label>종료일<input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => { setCustomEnd(event.target.value); setSelected(null); }} /></label>{customStart > customEnd && <p role="alert">종료일을 시작일 이후로 선택해 주세요.</p>}</div>}</details>
        <details open id="country-filter" className={styles.filterGroup}><summary>국가·지역</summary>{["전체", ...countryOptions].map((value) => {
          const checked = value === "전체" ? countries.length === 0 : countries.includes(value);
          return <button key={value} type="button" className={checked ? styles.countryFilterSelected : styles.countryFilter} aria-pressed={checked} onClick={() => {
            setCountries((current) => value === "전체" ? [] : current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
            setSelected(null);
          }}><span>{value === "전체" ? "전 세계" : jurisdictionName(value)}</span><span className={checked ? styles.countryCheckboxChecked : styles.countryCheckbox} aria-hidden="true">{checked && value !== "전체" ? "✓" : ""}</span></button>;
        })}</details>
        <div className={styles.filterFoot}>{results.length}건의 동향</div><button type="button" className={styles.mobileFilterDone} onClick={() => setFiltersExpanded(false)}>{results.length}건 결과 보기</button>
      </aside>
      <div className={styles.results}><div className={styles.mobileAppliedFilters}>{period !== "전체" && <button type="button" onClick={() => setPeriod("전체")}>{period} ×</button>}{countries.map((country) => <button type="button" key={country} onClick={() => setCountries((current) => current.filter((item) => item !== country))}>{jurisdictionName(country)} ×</button>)}{activeTopic && <button type="button" onClick={() => setTopicId("")}>{activeTopic.label} ×</button>}</div>
        <div className={styles.resultHeader}><div><p className={styles.eyebrow}>CURATED INTELLIGENCE</p><strong>{results.length}<small>건의 동향</small></strong></div><div className={styles.sortSwitch}><button type="button" className={sort === "관련도순" ? styles.sortActive : ""} onClick={() => setSort("관련도순")}>관련도순</button><button type="button" className={sort === "최신순" ? styles.sortActive : ""} onClick={() => setSort("최신순")}>최신순</button></div></div>
        {results.length ? <div className={styles.resultList}>{results.map((story) => <Link key={story.id} href={`/public/trends/${encodeURIComponent(story.id)}?back=${encodeURIComponent(returnTo)}`} onMouseEnter={() => setSelected(story.id)} onFocus={() => setSelected(story.id)} onClick={() => { try { sessionStorage.setItem("globaltrend-search-scroll", String(window.scrollY)); } catch { /* optional scroll memory */ } }} className={`${styles.storyCard} ${active?.id === story.id ? styles.storySelected : ""}`}>
          <div className={styles.storyMeta}><span>{story.region}</span><i>·</i><span>{story.institution}</span><i>·</i><time>{story.date}</time></div>
          <strong>{story.title}</strong><p>{story.summary}</p><div className={styles.tagList}>{story.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </Link>)}</div> : <div className={styles.emptyState}><span>⌕</span><strong>{loadError ? "자료를 불러오지 못했습니다" : stories.length ? "검색 결과가 없습니다" : "아직 표시할 동향이 없습니다"}</strong><p>{loadError ? "잠시 후 다시 확인해 주세요." : stories.length ? "검색어를 바꾸거나 국가 필터를 초기화해 보세요." : "새로운 자료가 추가되면 이곳에서 찾을 수 있습니다."}</p></div>}
      </div>
      {active && <aside className={styles.preview} aria-live="polite">
        <div className={styles.previewTop}><span>선택한 동향</span></div>
        <p className={styles.previewCountry}>{active.region} <i>·</i> {active.institution}</p>
        <h2>{active.title}</h2><p className={styles.previewText}>{active.summary}</p>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>주요 주제</span><div className={styles.tagList}>{active.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>원문 출처</span><a className={styles.featureLink} href={active.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a><Link className={styles.featureLink} href={`/public/trends/${active.id}`}>상세 보기 →</Link>
      </aside>}
    </div>
    <p className={styles.demoNote}>관련 개념 검색은 현재 정해진 표현을 확장하는 방식입니다.</p>
  </section>;
}
