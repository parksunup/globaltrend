"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./public.module.css";
import { publicTopics } from "../../lib/public-topics";
import { selectedTrendCountries } from "../../lib/trend-country-filters";
import { allowedPeriods, trendSearchHref, type searchTrendPage, type TrendSearchFilters } from "../../lib/trend-search-page";

export default function TrendSearch({ filters, result, loadError }: {
  filters: TrendSearchFilters;
  result: ReturnType<typeof searchTrendPage>;
  loadError: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingFilters, setPendingFilters] = useOptimistic(filters);
  const [query, setQuery] = useState(filters.q ?? "");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const {stories: results, countryOptions, total, page, pageCount, hasCatalog} = result;
  const mode = pendingFilters.mode === "concept" ? "concept" : "keyword";
  const countries = selectedTrendCountries(pendingFilters.country);
  const period = allowedPeriods.includes(pendingFilters.period ?? "") ? pendingFilters.period! : "전체";
  const customStart = pendingFilters.from ?? "";
  const customEnd = pendingFilters.to ?? "";
  const sort = pendingFilters.sort === "최신순" ? "최신순" : "관련도순";
  const activeTopic = publicTopics.find(topic => topic.id === pendingFilters.topic);
  const active = results.find(story => story.id === selected) ?? results[0];
  const selectedCountryOptions = countryOptions.filter(option => option.codes.some(code => countries.includes(code)));
  const returnTo = trendSearchHref({...filters, page: String(page), restore: "1"});

  useEffect(() => { setQuery(filters.q ?? ""); }, [filters.q]);
  useEffect(() => {
    if (filters.restore !== "1") return;
    try {
      const position = Number(sessionStorage.getItem("globaltrend-search-scroll"));
      if (Number.isFinite(position)) requestAnimationFrame(() => window.scrollTo(0, position));
    } catch { /* optional scroll memory */ }
  }, [filters.restore]);

  function change(changes: TrendSearchFilters) {
    setSelected(null);
    const next = {...pendingFilters, page: undefined, restore: undefined, ...changes};
    startTransition(() => {
      setPendingFilters(next);
      router.push(trendSearchHref(next), {scroll: false});
    });
  }

  function submitQuery(value: string) {
    change({q: value.trim()});
  }

  function selectPeriod(value: string) {
    if (value !== "직접 설정" || customStart || customEnd) {
      change({period: value});
      return;
    }
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(now.getFullYear() - 1);
    const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    change({period: value, from: localDate(yearAgo), to: localDate(now)});
  }

  return <section className={styles.searchPage} aria-busy={pending}>
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
        <button type="button" className={mode === "keyword" ? styles.modeActive : ""} onClick={() => change({mode: "keyword"})}>키워드 검색</button>
        <button type="button" className={mode === "concept" ? styles.modeActive : ""} onClick={() => change({mode: "concept"})}>관련 개념까지</button>
      </div>
      <span className={styles.modeHint}>{mode === "keyword" ? "입력한 단어가 포함된 자료를 찾습니다." : "비슷한 표현을 함께 찾는 화면 시연입니다."}</span>
    </div>
    {activeTopic && <div className={styles.activeTopic}>주제: <strong>{activeTopic.label}</strong><button type="button" onClick={() => change({topic: undefined})}>주제 해제 ×</button></div>}
    <div className={styles.searchLayout}>
      <aside className={`${styles.filters} ${!filtersExpanded ? styles.filtersClosed : ""}`}>
        <button type="button" className={styles.mobileFilterToggle} aria-expanded={filtersExpanded} onClick={() => setFiltersExpanded(!filtersExpanded)}>{filtersExpanded ? "검색 필터 접기" : "검색 필터 펼치기"}</button>
        <div className={styles.filterHeading}><span>검색 필터</span><button type="button" onClick={() => change({country: undefined, period: undefined, from: undefined, to: undefined, topic: undefined, sort: undefined})}>초기화</button></div>
        <details open className={styles.filterGroup}><summary>기간</summary>{allowedPeriods.map((value) => <button key={value} type="button" className={period === value ? styles.filterSelected : ""} onClick={() => selectPeriod(value)}><span>{value}</span><span>{period === value ? "●" : "○"}</span></button>)}{period === "직접 설정" && <div className={styles.dateRange}><label>시작일<input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => change({from: event.target.value})} /></label><label>종료일<input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => change({to: event.target.value})} /></label>{customStart > customEnd && <p role="alert">종료일을 시작일 이후로 선택해 주세요.</p>}</div>}</details>
        <details open id="country-filter" className={styles.filterGroup}><summary>국가·지역</summary>{[
          { label: "전체", codes: [] as string[] },
          ...countryOptions,
        ].map((option) => {
          const checked = option.label === "전체" ? countries.length === 0 : option.codes.some((code) => countries.includes(code));
          return <button key={option.label} type="button" className={checked ? styles.countryFilterSelected : styles.countryFilter} aria-pressed={checked} onClick={() => change({country: (option.label === "전체" ? [] : checked
              ? countries.filter(code => !option.codes.includes(code))
              : [...new Set([...countries, ...option.codes])]).join(",")})}><span>{option.label === "전체" ? "전 세계" : option.label}</span><span className={checked ? styles.countryCheckboxChecked : styles.countryCheckbox} aria-hidden="true">{checked && option.label !== "전체" ? "✓" : ""}</span></button>;
        })}</details>
        <div className={styles.filterFoot}>{total}건의 동향</div><button type="button" className={styles.mobileFilterDone} onClick={() => setFiltersExpanded(false)}>{total}건 결과 보기</button>
      </aside>
      <div className={styles.results}><div className={styles.mobileAppliedFilters}>{period !== "전체" && <button type="button" onClick={() => change({period: "전체"})}>{period} ×</button>}{selectedCountryOptions.map((option) => <button type="button" key={option.label} onClick={() => change({country: countries.filter(code => !option.codes.includes(code)).join(",")})}>{option.label} ×</button>)}{activeTopic && <button type="button" onClick={() => change({topic: undefined})}>{activeTopic.label} ×</button>}</div>
        <div className={styles.resultHeader}><div><p className={styles.eyebrow}>CURATED INTELLIGENCE</p><strong>{total}<small>건의 동향</small></strong></div><div className={styles.sortSwitch}><button type="button" className={sort === "관련도순" ? styles.sortActive : ""} onClick={() => change({sort: "관련도순"})}>관련도순</button><button type="button" className={sort === "최신순" ? styles.sortActive : ""} onClick={() => change({sort: "최신순"})}>최신순</button></div></div>
        {results.length ? <div className={styles.resultList}>{results.map((story) => <Link key={story.id} prefetch={false} href={`/public/trends/${encodeURIComponent(story.id)}?back=${encodeURIComponent(returnTo)}`} onMouseEnter={() => setSelected(story.id)} onFocus={() => setSelected(story.id)} onClick={() => { try { sessionStorage.setItem("globaltrend-search-scroll", String(window.scrollY)); } catch { /* optional scroll memory */ } }} className={`${styles.storyCard} ${active?.id === story.id ? styles.storySelected : ""}`}>
          <div className={styles.storyMeta}><span>{story.region}</span><i>·</i><span>{story.institution}</span><i>·</i><time>{story.date}</time></div>
          <strong>{story.title}</strong><p>{story.summary}</p><div className={styles.tagList}>{story.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </Link>)}</div> : <div className={styles.emptyState}><span>⌕</span><strong>{loadError ? "자료를 불러오지 못했습니다" : hasCatalog ? "검색 결과가 없습니다" : "아직 표시할 동향이 없습니다"}</strong><p>{loadError ? "잠시 후 다시 확인해 주세요." : hasCatalog ? "검색어를 바꾸거나 국가 필터를 초기화해 보세요." : "새로운 자료가 추가되면 이곳에서 찾을 수 있습니다."}</p></div>}
        {pageCount > 1 && <nav className={styles.searchPagination} aria-label="동향 검색 결과 페이지">
          <button type="button" disabled={pending || page <= 1} onClick={() => change({page: String(page - 1)})}>이전</button>
          <span aria-live="polite">{pending ? "결과를 불러오는 중" : `${page} / ${pageCount} 페이지`}</span>
          <button type="button" disabled={pending || page >= pageCount} onClick={() => change({page: String(page + 1)})}>다음</button>
        </nav>}
      </div>
      {active && <aside className={styles.preview} aria-live="polite">
        <div className={styles.previewTop}><span>선택한 동향</span></div>
        <p className={styles.previewCountry}>{active.region} <i>·</i> {active.institution}</p>
        <h2>{active.title}</h2><p className={styles.previewText}>{active.summary}</p>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>주요 주제</span><div className={styles.tagList}>{active.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>원문 출처</span><a className={styles.featureLink} href={active.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a><Link className={styles.featureLink} href={`/public/trends/${active.id}?back=${encodeURIComponent(returnTo)}`}>상세 보기 →</Link>
      </aside>}
    </div>
    <p className={styles.demoNote}>관련 개념 검색은 현재 정해진 표현을 확장하는 방식입니다.</p>
  </section>;
}
