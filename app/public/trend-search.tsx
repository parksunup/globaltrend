"use client";

import { useMemo, useState } from "react";
import styles from "./public.module.css";

type Story = { country: string; region: string; institution: string; title: string; summary: string; kind: string; tags: string[]; date: string };
const stories: Story[] = [
  { country: "EU", region: "유럽연합", institution: "EDPB", title: "아동의 개인정보를 다루는 온라인 서비스", summary: "연령 확인과 아동 대상 서비스 설계에서 고려할 보호 원칙을 검토하는 예시 자료입니다.", kind: "가이드라인", tags: ["아동", "온라인 안전", "설계 단계"], date: "2026.10.08" },
  { country: "일본", region: "일본", institution: "PPC", title: "아동 관련 정보 처리와 사업자의 보호 조치", summary: "아동의 정보가 수집·이용되는 과정에서 사업자가 살펴볼 쟁점을 정리한 예시 자료입니다.", kind: "감독기구 발표", tags: ["아동", "사업자 의무"], date: "2026.10.02" },
  { country: "영국", region: "영국", institution: "ICO", title: "연령에 적합한 온라인 서비스 설계", summary: "온라인 서비스의 기본 설정과 아동 이용자 보호를 다룬 예시 자료입니다.", kind: "규제기관 지침", tags: ["아동", "기본 설정", "온라인 안전"], date: "2026.09.27" },
  { country: "미국", region: "미국", institution: "FTC", title: "아동 대상 서비스의 데이터 수집 원칙", summary: "서비스가 아동의 개인정보를 수집할 때 확인할 수 있는 항목을 담은 예시 자료입니다.", kind: "정부기관 발표", tags: ["아동", "수집 제한"], date: "2026.09.19" },
  { country: "OECD", region: "국제기구", institution: "OECD", title: "아동의 디지털 환경과 개인정보 보호", summary: "아동의 권리와 데이터 보호를 함께 살펴보는 국제 정책 자료의 예시입니다.", kind: "정책 자료", tags: ["아동", "국제 기준"], date: "2026.09.12" },
  { country: "EU", region: "유럽연합", institution: "CURIA", title: "온라인 서비스와 개인정보 처리에 관한 판례 검색", summary: "온라인 서비스의 개인정보 처리와 관련된 판례를 찾아볼 때의 화면 예시입니다.", kind: "판례", tags: ["온라인 서비스", "법원"], date: "2026.09.05" },
];

const relatedTerms: Record<string, string[]> = {
  "아동": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "아동 개인정보": ["아동", "미성년", "청소년", "연령 확인", "아동 대상"],
  "인공지능": ["인공지능", "생성형 AI", "자동화", "알고리즘"],
  "국외 이전": ["국외 이전", "국제 이전", "역외 이전", "국경 간"],
  "제재": ["제재", "과징금", "집행", "벌금"],
};

export default function TrendSearch({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<"keyword" | "concept">("keyword");
  const [country, setCountry] = useState("전체");
  const [period, setPeriod] = useState("전체");
  const [kind, setKind] = useState("전체");
  const [sort, setSort] = useState<"관련도순" | "최신순">("관련도순");
  const [selected, setSelected] = useState(0);
  const terms = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    if (mode === "concept") {
      const match = Object.keys(relatedTerms).find((key) => normalized.includes(key.toLocaleLowerCase()) || key.toLocaleLowerCase().includes(normalized));
      return match ? relatedTerms[match].map((term) => term.toLocaleLowerCase()) : normalized.split(/\s+/);
    }
    return normalized.split(/\s+/).filter(Boolean);
  }, [query, mode]);
  const results = useMemo(() => {
    const filtered = stories.filter((story) => {
      const countryMatch = country === "전체" || story.country === country;
      const kindMatch = kind === "전체" || story.kind === kind;
      const searchable = [story.title, story.summary, story.institution, ...story.tags].join(" ").toLocaleLowerCase();
      const queryMatch = !terms.length || terms.some((term) => searchable.includes(term));
      const ageInMonths = period === "최근 1개월" ? 1 : period === "최근 6개월" ? 6 : period === "최근 1년" ? 12 : 0;
      const published = new Date(story.date.replaceAll(".", "-"));
      const periodMatch = !ageInMonths || published >= new Date(new Date().setMonth(new Date().getMonth() - ageInMonths));
      return countryMatch && kindMatch && queryMatch && periodMatch;
    });
    return sort === "최신순" ? filtered.slice().sort((a, b) => b.date.localeCompare(a.date)) : filtered.slice().sort((a, b) => {
      const score = (story: Story) => terms.reduce((total, term) => total + (story.title.toLocaleLowerCase().includes(term) ? 3 : story.tags.join(" ").toLocaleLowerCase().includes(term) ? 2 : story.summary.toLocaleLowerCase().includes(term) ? 1 : 0), 0);
      return score(b) - score(a) || b.date.localeCompare(a.date);
    });
  }, [country, kind, period, sort, terms]);
  const active = results[Math.min(selected, Math.max(results.length - 1, 0))];

  return <section className={styles.searchPage}>
    <div className={styles.searchIntro}>
      <p className={styles.eyebrow}><span /> SEARCH THE SIGNALS</p>
      <h1>동향 검색</h1>
      <p>키워드와 관련 개념으로 관심 있는 개인정보 보호 동향을 찾아보세요.</p>
    </div>
    <form className={styles.searchBox} role="search" onSubmit={(event) => { event.preventDefault(); setSelected(0); }}>
      <span aria-hidden="true">⌕</span>
      <input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} aria-label="동향 검색어" placeholder="예: 아동 개인정보" />
      {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
      <button className={styles.searchSubmit} type="submit">검색</button>
    </form>
    <div className={styles.searchControls}>
      <div className={styles.modeSwitch} aria-label="검색 방식">
        <button type="button" className={mode === "keyword" ? styles.modeActive : ""} onClick={() => { setMode("keyword"); setSelected(0); }}>키워드 검색</button>
        <button type="button" className={mode === "concept" ? styles.modeActive : ""} onClick={() => { setMode("concept"); setSelected(0); }}>관련 개념까지</button>
      </div>
      <span className={styles.modeHint}>{mode === "keyword" ? "입력한 단어가 포함된 자료를 찾습니다." : "비슷한 표현을 함께 찾는 화면 시연입니다."}</span>
    </div>
    <div className={styles.searchLayout}>
      <aside className={styles.filters}>
        <div className={styles.filterHeading}><span>검색 필터</span><button type="button" onClick={() => { setCountry("전체"); setPeriod("전체"); setKind("전체"); setSort("관련도순"); setSelected(0); }}>초기화</button></div>
        <details open className={styles.filterGroup}><summary>기간</summary>{["전체", "최근 1개월", "최근 6개월", "최근 1년"].map((value) => <button key={value} type="button" className={period === value ? styles.filterSelected : ""} onClick={() => { setPeriod(value); setSelected(0); }}><span>{value}</span><span>{period === value ? "●" : "○"}</span></button>)}</details>
        <details open className={styles.filterGroup}><summary>국가·지역</summary>{["전체", "EU", "일본", "영국", "미국", "OECD"].map((value) => <button key={value} type="button" className={country === value ? styles.filterSelected : ""} onClick={() => { setCountry(value); setSelected(0); }}><span>{value === "전체" ? "전 세계" : value}</span><span>{country === value ? "●" : "○"}</span></button>)}</details>
        <details open className={styles.filterGroup}><summary>자료 유형</summary>{["전체", ...Array.from(new Set(stories.map((story) => story.kind)))].map((value) => <button key={value} type="button" className={kind === value ? styles.filterSelected : ""} onClick={() => { setKind(value); setSelected(0); }}><span>{value === "전체" ? "전체 유형" : value}</span><span>{kind === value ? "●" : "○"}</span></button>)}</details>
        <div className={styles.filterFoot}><span className={styles.statusDot} /> 화면 예시 데이터</div>
      </aside>
      <div className={styles.results}>
        <div className={styles.resultHeader}><div><p className={styles.eyebrow}>CURATED INTELLIGENCE</p><strong>{results.length}<small>건의 예시 결과</small></strong></div><div className={styles.sortSwitch}><button type="button" className={sort === "관련도순" ? styles.sortActive : ""} onClick={() => setSort("관련도순")}>관련도순</button><button type="button" className={sort === "최신순" ? styles.sortActive : ""} onClick={() => setSort("최신순")}>최신순</button></div></div>
        {results.length ? <div className={styles.resultList}>{results.map((story, index) => <button type="button" key={story.title} onClick={() => setSelected(index)} className={`${styles.storyCard} ${selected === index ? styles.storySelected : ""}`}>
          <div className={styles.storyMeta}><span>{story.region}</span><i>·</i><span>{story.institution}</span><i>·</i><span>{story.kind}</span><time>{story.date}</time></div>
          <strong>{story.title}</strong><p>{story.summary}</p><div className={styles.tagList}>{story.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </button>)}</div> : <div className={styles.emptyState}><span>⌕</span><strong>검색 결과가 없습니다</strong><p>검색어를 바꾸거나 국가 필터를 초기화해 보세요.</p></div>}
      </div>
      {active && <aside className={styles.preview}>
        <div className={styles.previewTop}><span>선택한 동향</span><span>예시</span></div>
        <p className={styles.previewCountry}>{active.region} <i>·</i> {active.institution}</p>
        <h2>{active.title}</h2><p className={styles.previewText}>{active.summary}</p>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>주요 주제</span><div className={styles.tagList}>{active.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <div className={styles.previewDivider} />
        <span className={styles.previewLabel}>원문 출처</span><p className={styles.sourcePending}>자료 연동 후 공식 원문 링크가 표시됩니다.</p>
      </aside>}
    </div>
    <p className={styles.demoNote}>화면 구성 확인을 위한 예시 데이터입니다. 실제 수집·검수된 동향 자료가 아닙니다.</p>
  </section>;
}
