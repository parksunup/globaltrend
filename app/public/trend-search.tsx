"use client";

import { useMemo, useState } from "react";
import styles from "./public.module.css";

import { stories } from "./demo-data";
import type { Story } from "./demo-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const relatedTerms: Record<string, string[]> = {
  "아동": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "아동 개인정보": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "인공지능": ["인공지능", "생성형 AI", "자동화", "알고리즘"],
  "국외 이전": ["국외 이전", "국제 이전", "역외 이전", "국경 간"],
  "제재": ["제재", "과징금", "집행", "벌금"],
};

export default function TrendSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => { setQuery(initialQuery); setSubmittedQuery(initialQuery); }, [initialQuery]);
  const [mode, setMode] = useState<"keyword" | "concept">("keyword");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [period, setPeriod] = useState("전체");
  const [kind, setKind] = useState("전체");
  const [sort, setSort] = useState<"관련도순" | "최신순">("관련도순");
  const [selected, setSelected] = useState<string | null>(null);
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
      const countryMatch = countries.length === 0 || countries.includes(story.country);
      const kindMatch = kind === "전체" || story.kind === kind;
      const searchable = [story.title, story.summary, story.institution, ...story.tags].join(" ").toLocaleLowerCase();
      const queryMatch = !terms.length || (mode === "concept" ? terms.some((term) => searchable.includes(term)) : terms.every((term) => searchable.includes(term)));
      const ageInMonths = period === "최근 1개월" ? 1 : period === "최근 6개월" ? 6 : period === "최근 1년" ? 12 : 0;
      const published = new Date(story.date.replaceAll(".", "-"));
      const periodMatch = !ageInMonths || published >= new Date(new Date().setMonth(new Date().getMonth() - ageInMonths));
      return countryMatch && kindMatch && queryMatch && periodMatch;
    });
    return sort === "최신순" ? filtered.slice().sort((a, b) => b.date.localeCompare(a.date)) : filtered.slice().sort((a, b) => {
      const score = (story: Story) => terms.reduce((total, term) => total + (story.title.toLocaleLowerCase().includes(term) ? 3 : story.tags.join(" ").toLocaleLowerCase().includes(term) ? 2 : story.summary.toLocaleLowerCase().includes(term) ? 1 : 0), 0);
      return score(b) - score(a) || b.date.localeCompare(a.date);
    });
  }, [countries, kind, period, sort, terms, mode]);
  const active = results.find((story) => story.id === selected) ?? results[0];
  function submitQuery(value: string) {
    setSubmittedQuery(value);
    setSelected(null);
    router.push(value.trim() ? `/public/search?q=${encodeURIComponent(value.trim())}` : "/public/search", { scroll: false });
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
    <div className={styles.searchLayout}>
      <aside className={`${styles.filters} ${!filtersExpanded ? styles.filtersClosed : ""}`}>
        <button type="button" className={styles.mobileFilterToggle} aria-expanded={filtersExpanded} onClick={() => setFiltersExpanded(!filtersExpanded)}>{filtersExpanded ? "검색 필터 접기" : "검색 필터 펼치기"}</button>
        <div className={styles.filterHeading}><span>검색 필터</span><button type="button" onClick={() => { setCountries([]); setPeriod("전체"); setKind("전체"); setSort("관련도순"); setSelected(null); }}>초기화</button></div>
        <details open className={styles.filterGroup}><summary>기간</summary>{["전체", "최근 1개월", "최근 6개월", "최근 1년"].map((value) => <button key={value} type="button" className={period === value ? styles.filterSelected : ""} onClick={() => { setPeriod(value); setSelected(null); }}><span>{value}</span><span>{period === value ? "●" : "○"}</span></button>)}</details>
        <details open id="country-filter" className={styles.filterGroup}><summary>국가·지역</summary>{["전체", "EU", "일본", "영국", "미국", "OECD"].map((value) => {
          const checked = value === "전체" ? countries.length === 0 : countries.includes(value);
          return <button key={value} type="button" className={checked ? styles.countryFilterSelected : styles.countryFilter} aria-pressed={checked} onClick={() => {
            setCountries((current) => value === "전체" ? [] : current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
            setSelected(null);
          }}><span>{value === "전체" ? "전 세계" : value}</span><span className={checked ? styles.countryCheckboxChecked : styles.countryCheckbox} aria-hidden="true">{checked && value !== "전체" ? "✓" : ""}</span></button>;
        })}</details>
        <details open className={styles.filterGroup}><summary>자료 유형</summary>{["전체", ...Array.from(new Set(stories.map((story) => story.kind)))].map((value) => <button key={value} type="button" className={kind === value ? styles.filterSelected : ""} onClick={() => { setKind(value); setSelected(null); }}><span>{value === "전체" ? "전체 유형" : value}</span><span>{kind === value ? "●" : "○"}</span></button>)}</details>
        <div className={styles.filterFoot}><span className={styles.statusDot} /> 화면 예시 데이터</div>
      </aside>
      <div className={styles.results}>
        <div className={styles.resultHeader}><div><p className={styles.eyebrow}>CURATED INTELLIGENCE</p><strong>{results.length}<small>건의 예시 결과</small></strong></div><div className={styles.sortSwitch}><button type="button" className={sort === "관련도순" ? styles.sortActive : ""} onClick={() => setSort("관련도순")}>관련도순</button><button type="button" className={sort === "최신순" ? styles.sortActive : ""} onClick={() => setSort("최신순")}>최신순</button></div></div>
        {results.length ? <div className={styles.resultList}>{results.map((story) => <button type="button" key={story.id} onClick={() => { setSelected(story.id); requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} className={`${styles.storyCard} ${active?.id === story.id ? styles.storySelected : ""}`}>
          <div className={styles.storyMeta}><span>{story.region}</span><i>·</i><span>{story.institution}</span><i>·</i><span>{story.kind}</span><time>{story.date}</time></div>
          <strong>{story.title}</strong><p>{story.summary}</p><div className={styles.tagList}>{story.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </button>)}</div> : <div className={styles.emptyState}><span>⌕</span><strong>검색 결과가 없습니다</strong><p>검색어를 바꾸거나 국가 필터를 초기화해 보세요.</p></div>}
      </div>
      {active && <aside className={styles.preview} ref={previewRef} aria-live="polite">
        <div className={styles.previewTop}><span>선택한 동향</span><span>예시</span></div>
        <p className={styles.previewCountry}>{active.region} <i>·</i> {active.institution}</p>
        <h2>{active.title}</h2><p className={styles.previewText}>{active.summary}</p>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>주요 주제</span><div className={styles.tagList}>{active.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>원문 출처</span><p className={styles.sourcePending}>화면 예시이므로 원문 링크가 없습니다.</p><Link className={styles.featureLink} href={`/public/trends/${active.id}`}>예시 상세 보기 →</Link>
      </aside>}
    </div>
    <p className={styles.demoNote}>화면 구성 확인을 위한 예시 데이터입니다. 실제 수집·검수된 동향 자료가 아닙니다.</p>
  </section>;
}
