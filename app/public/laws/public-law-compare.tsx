"use client";

import Link from "next/link";
import Image from "next/image";
import RelatedArticlePreview from "./related-article-preview";
import { useEffect, useMemo, useState } from "react";
import styles from "../public.module.css";
import type { LegalComparisonCell, SubmissionItem } from "../../../lib/submission-preview";
import type { LegalArticlePreview, LegalTranslationSummary } from "../../../lib/legal-translation-review";
import { PublicHeader, PublicFooter } from "../public-navigation";

const countries = [
  { code: "KR", flag: "/flags/kr.svg", country: "한국", law: "개인정보 보호법" },
  { code: "JP", flag: "/flags/jp.svg", country: "일본", law: "개인정보보호법" },
  { code: "CN", flag: "/flags/cn.svg", country: "중국", law: "개인정보 보호법" },
  { code: "EU", flag: "/flags/eu.svg", country: "유럽연합(EU)", law: "GDPR" },
  { code: "GB", flag: "/flags/gb.svg", country: "영국", law: "UK GDPR" },
  { code: "US-CA", flag: "/flags/us-ca.svg", country: "미국·캘리포니아", law: "CCPA" },
  { code: "SG", flag: "/flags/sg.svg", country: "싱가포르", law: "PDPA" },
];

function relatedArticleUrl(translationId: string, article: string, anchorId?: string, back?: string): string {
  return `/public/laws/${translationId}${back ? `?back=${encodeURIComponent(back)}` : ""}${anchorId ? `#${anchorId}` : ""}`;
}

function readableOfficialUrl(url: string, translation?: LegalTranslationSummary): string {
  let candidate = translation?.officialUrl || url;
  if (/laws\.e-gov\.go\.jp\/api\/2\/law_data\//i.test(candidate)) {
    const lawId = candidate.match(/law_data\/([^_/?]+)/i)?.[1];
    if (lawId) return `https://laws.e-gov.go.jp/document?lawid=${lawId}`;
  }
  if (/www\.legislation\.gov\.uk\/[^?#]*\/data\.xml/i.test(candidate)) candidate = candidate.replace(/\/data\.xml(?=[?#]|$)/i, "");
  if (/\/api\/|\.(?:json|xml)(?:[?#]|$)/i.test(candidate)) return "";
  return candidate;
}

function citationSourceUrl(citation: string, cell: LegalComparisonCell, index: number): string {
  const sources = (cell.sourceLinks ?? []).map((url) => readableOfficialUrl(url)).filter(Boolean);
  if (sources.length === cell.articleNumbers.length) return sources[index] ?? "";
  const find = (pattern: RegExp) => sources.find((url) => pattern.test(url)) ?? "";
  if (/^DPA\s*2018\b/i.test(citation)) {
    const section = citation.match(/제(\d+[A-Z]?)조(?:\D|$)/i)?.[1];
    if (section) return find(new RegExp(`/ukpga/2018/12/section/${section}(?:$|[?#])`, "i"));
    const schedule = citation.match(/Schedule\s+(\d+)/i)?.[1];
    const paragraph = citation.match(/제(\d+)문단/i)?.[1];
    if (schedule && paragraph) return find(new RegExp(`/ukpga/2018/12/schedule/${schedule}/paragraph/${paragraph}(?:$|[?#])`, "i"));
  }
  const dpaSchedule = citation.match(/^DPA\s+Schedule\s+(\d+)/i)?.[1];
  if (dpaSchedule) {
    const paragraph = citation.match(/제(\d+)문단/i)?.[1];
    if (paragraph) return find(new RegExp(`/ukpga/2018/12/schedule/${dpaSchedule}/paragraph/${paragraph}(?:$|[?#])`, "i"));
  }
  const si = citation.match(/S\.I\.\s*(\d{4})\/(\d+)/i);
  if (si) return find(new RegExp(`/uksi/${si[1]}/${si[2]}/`, "i"));
  if (/DUAA/i.test(citation)) return find(/\/ukpga\/2025\/18\/schedule\//i);
  if (/네트워크 데이터 안전관리 조례/.test(citation)) return find(/gov\.cn\/gongbao\/2024|govdata\/gov\/202409\/30/i);
  if (/얼굴인식 기술 응용 안전관리 방법/.test(citation)) return find(/cac\.gov\.cn\/2025-03\/21/i);
  if (/미성년자 네트워크 보호 조례/.test(citation)) return find(/govdata\/gov\/202310\/24/i);
  if (/2025 준수감사 관리방법/.test(citation)) return find(/cac\.gov\.cn\/2025-02\/14/i);
  if (/아동 개인정보 네트워크 보호 규정/.test(citation)) return find(/gov\.cn\/gongbao\/content\/2019|govdata\/gov\/202310\/24/i);
  if (/2024 국외 데이터 흐름 규칙/.test(citation)) return find(/cac\.gov\.cn\/2024-03\/22/i);
  if (/국가 네트워크 안전사고 보고 관리방법/.test(citation)) return find(/cac\.gov\.cn\/2025-09\/15/i);
  if (/Act\s+2\/2026/i.test(citation)) return find(/sso\.agc\.gov\.sg\/Acts-Supp\/2-2026/i);
  if (/2020 개정법/.test(citation)) return find(/sso\.agc\.gov\.sg\/Acts-Supp\/40-2020/i);
  if (/불복 개정 규칙 S576\/2024/i.test(citation)) return find(/sso\.agc\.gov\.sg\/SL-Supp\/S576-2024/i);
  if (/불복 규칙 S65\/2021/i.test(citation)) return find(/sso\.agc\.gov\.sg\/SL\/PDPA2012-S62-2021/i);
  if (/일반 규칙|유출 통지 규칙|집행 규칙/.test(citation)) return find(/sso\.agc\.gov\.sg\/SL\/PDPA2012-/i);
  if (/Basic Anonymisation/i.test(citation)) return find(/pdpc\.gov\.sg\/.*Basic-Anonymisation/i);
  if (/Children Digital Environment/i.test(citation)) return find(/pdpc\.gov\.sg\/.*Children/i);
  if (/^CCR\s/i.test(citation)) return find(/cppa\.ca\.gov\/regulations\//i);
  if (/1798\.82/.test(citation)) return find(/leginfo\.legislature\.ca\.gov\/faces\/codes_displaySection/i);
  if (/SB\s*446/i.test(citation)) return find(/apcp\.assembly\.ca\.gov\/.*2025-legislative-bill-summary/i);
  if (/DRE\s+2026/i.test(citation)) return find(/dre\.ca\.gov\/files\/pdf\/relaw\//i);
  if (/개인정보보호위원회/.test(citation)) return find(/pipc\.go\.kr/i);
  return "";
}

export default function PublicLawCompare({ cells, instruments, translations, articlePreviews, draftMode, initialView, initialSelected, initialCriterion }: {
  cells: LegalComparisonCell[]; instruments: SubmissionItem[];
  translations: LegalTranslationSummary[]; articlePreviews: Record<string, LegalArticlePreview>; draftMode: boolean; initialView: "full" | "compare"; initialSelected?: string[]; initialCriterion?: string;
}) {
  const criteria = useMemo(() => Array.from(new Map(cells.map((cell) =>
    [cell.criterionId, { id: cell.criterionId, name: cell.criterionName, order: cell.criterionOrder }]
  )).values()).sort((a, b) => a.order - b.order), [cells]);
  const [view, setView] = useState<"full" | "compare">(initialView);
  const [selected, setSelected] = useState(() => { const valid = initialSelected && [...new Set(initialSelected.filter((code) => countries.some((country) => country.code === code)))]; return valid?.length ? valid : ["KR", "JP"]; });
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});
  const [activeCountry, setActiveCountry] = useState("KR");
  const [activeCriterion, setActiveCriterion] = useState(criteria.some((item) => item.id === initialCriterion) ? initialCriterion! : criteria[0]?.id ?? "");
  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => { const params = new URLSearchParams({ view }); if (view === "compare") { params.set("countries", selected.join(",")); if (activeCriterion) params.set("criterion", activeCriterion); } window.history.replaceState(null, "", `/public/laws?${params}`); }, [view, selected, activeCriterion]);

  const selectedLaws = countries.filter((law) => selected.includes(law.code));
  const criterion = criteria.find((item) => item.id === activeCriterion) ?? criteria[0];
  const recordsFor = (code: string) => instruments.filter((item) =>
    item.kind === "법제 목록" && item.fields.some((field) => field.label === "관할권" && field.value === code));
  const translationFor = (code: string, record?: SubmissionItem) => translations.find((item) =>
    item.jurisdiction === code && (code === "KR" || !record || record.id.endsWith(item.id)));
  const toggle = (code: string) => {
    if (view === "full") { setActiveCountry(code); return; }
    if (selected.includes(code)) {
      if (selected.length > 1) setSelected(selected.filter((item) => item !== code));
    } else setSelected([...selected, code]);
  };
  const setSection = (next: "full" | "compare") => {
    setView(next);

  };
  const activeLaw = countries.find((law) => law.code === activeCountry) ?? countries[1];
  const currentPath = view === "compare" ? `/public/laws?view=compare&countries=${encodeURIComponent(selected.join(","))}&criterion=${encodeURIComponent(activeCriterion)}` : "/public/laws?view=full";
  const selectedNames = view === "compare" ? selectedLaws.map((law) => law.country).join(" · ") : activeLaw.country;
  const criterionIndex = criteria.findIndex((item) => item.id === criterion?.id);

  return <main className={styles.lawPage}>
    <PublicHeader active="/public/laws" />
    {draftMode && <p className={styles.draftNotice}>미리보기 환경 · 각 법률의 판본과 공식 원문을 확인해 주세요.</p>}
    <section className={styles.lawHero}>
      <div><p className={styles.lawOverline}>GLOBAL PRIVACY LAW ATLAS</p><h1>국가별 법제</h1>
      <p>국가·지역별 법률을 읽고, 같은 기준으로 나란히 비교해 보세요.</p></div>
    </section>
    <nav className={styles.lawViewTabs} aria-label="국가별 법제 보기">
      <button type="button" aria-current={view === "full" ? "page" : undefined} className={view === "full" ? styles.lawViewActive : ""} onClick={() => setSection("full")}>법률 전문</button>
      <button type="button" aria-current={view === "compare" ? "page" : undefined} className={view === "compare" ? styles.lawViewActive : ""} onClick={() => setSection("compare")}>법제 비교</button>
    </nav>
    <button type="button" className={styles.mobileCountryToggle} aria-expanded={countryPickerOpen} onClick={() => setCountryPickerOpen((open) => !open)}>선택 국가: {selectedNames} · {countryPickerOpen ? "선택 닫기" : "국가 변경"}</button>
    <section className={`${styles.countryGrid} ${countryPickerOpen ? styles.countryGridOpen : ""}`} aria-label={view === "full" ? "법률을 읽을 국가·지역 선택" : "비교할 국가·지역 선택"}>
      {countries.map((law) => {
        const chosen = view === "full" ? activeCountry === law.code : selected.includes(law.code);
        return <button key={law.code} type="button" className={chosen ? styles.countryCardSelected : styles.countryCard}
          onClick={() => { toggle(law.code); if (view === "full") setCountryPickerOpen(false); }} aria-pressed={chosen}
          >
          <Image className={styles.flag} src={law.flag} width={42} height={28} alt="" aria-hidden="true" />
          <strong>{law.country}</strong><small>{recordsFor(law.code)[0]?.title ?? law.law}</small>
        </button>;
      })}
    </section>

    {view === "full" ? <section className={styles.lawCatalog}>
      <div className={styles.compareTitle}><div><p className={styles.lawOverline}>READ THE LAW</p><h2>{activeLaw.country} 법률 전문</h2></div>
        <p>법률을 선택하면 제1조부터 마지막 조문까지 순서대로 읽을 수 있습니다.</p></div>
      {recordsFor(activeCountry).length ? <div className={styles.lawCatalogGrid}>
        {recordsFor(activeCountry).map((record) => {
          const translation = translationFor(activeCountry, record);
          const official = record.links.find((link) => link.url.startsWith("https://"));
          return <article className={styles.lawCatalogCard} key={record.id}>
            <h3>{record.title}</h3><p>{record.subtitle}</p>
            {translation ? <>
              <small>{translation.reviewStatus === "official" ? `공식 한국어 원문 · 본칙 조문 표제 ${translation.articleCount}개` : `한국어 전문 · ${translation.articleCount}개 조문`} · 시행일 {translation.version}</small>
              <Link className={styles.catalogPrimary} href={`/public/laws/${translation.id}?back=${encodeURIComponent(currentPath)}`}>제1조부터 전문 읽기 →</Link>
            </> : <><small>{activeCountry === "KR" ? "한국어 공식 원문 조문 색인 · 본문은 공식 원문에서 열람" : activeCountry === "EU" ? "한국어 번역 없이 영어 공식 원문과 비교 요약 제공" : "공식 원문과 비교 요약 제공"}</small><button type="button" onClick={() => setSection("compare")}>{criteria.length}개 기준 비교 요약 보기 →</button></>}
            {official && <a href={official.url} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
          </article>;
        })}
      </div> : <p className={styles.lawCatalogEmpty}>이 국가·지역의 법률 자료가 아직 준비되지 않았습니다.</p>}
    </section> : <section id="comparison" className={styles.compareSection}>
      <div className={styles.compareTitle}><div><p className={styles.lawOverline}>COMPARE PRIVACY LAWS</p><h2>{criteria.length}개 기준으로 비교하기</h2></div>
        <p>선택한 국가·지역의 요약과 관련 조항을 같은 순서로 비교합니다.</p>
        <button type="button" onClick={() => setSelected(countries.map((country) => country.code))} disabled={selected.length === countries.length}>전체 국가·지역 선택</button>
        <span className={styles.selectCount}>{selected.length}/{countries.length}개 국가·지역 선택</span></div>
      {criteria.length ? <><div className={styles.mobileCriterion}><label htmlFor="mobile-criterion">비교 기준</label><select id="mobile-criterion" value={criterion?.id ?? ""} onChange={(event) => setActiveCriterion(event.target.value)}>{criteria.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.name}</option>)}</select><div><button type="button" disabled={criterionIndex <= 0} onClick={() => setActiveCriterion(criteria[criterionIndex - 1].id)}>← 이전</button><button type="button" disabled={criterionIndex >= criteria.length - 1} onClick={() => setActiveCriterion(criteria[criterionIndex + 1].id)}>다음 →</button></div></div><div className={styles.compareGrid}>
        <aside className={styles.criteriaList}><h3>비교 기준 <small>{criteria.length}</small></h3><ol>{criteria.map((item, index) =>
          <li key={item.id}><button type="button" onClick={() => setActiveCriterion(item.id)}
            aria-pressed={criterion?.id === item.id} className={criterion?.id === item.id ? styles.criteriaActive : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>{item.name}<i>›</i></button></li>)}</ol></aside>
        <div className={`${styles.compareCards} ${selected.length >= 3 ? styles.compareCardsThree : selected.length === 1 ? styles.compareCardsOne : ""}`}>
          {selectedLaws.map((law) => {
            const cell = cells.find((item) => item.criterionId === criterion?.id && item.jurisdiction === law.code);
            const record = recordsFor(law.code)[0];
            const translation = translationFor(law.code, record);
            const drafted = cell && cell.summary && cell.summary !== "미검토";
            return <article className={styles.lawCompareCard} key={law.code}>
              <header><Image className={styles.flag} src={law.flag} width={42} height={28} alt="" aria-hidden="true" />
                <div><h3>{law.country}</h3><p>{record?.title ?? law.law}</p></div></header>
              <section><strong>{criterion?.name ?? "비교 기준"}</strong>
                <p>{drafted ? cell.summary : "이 기준의 조항 요약은 아직 제공되지 않습니다."}</p>
                {!drafted && <span className={styles.draftLabel}>자료 준비 중</span>}</section>
              <section><strong>관련 조항</strong>
                {cell?.articleNumbers.length ? <div className={styles.articleLinks}>{cell.articleNumbers.map((number, index) => {
                  const preview = translation ? articlePreviews[`${translation.id}:${number}`] : undefined;
                  const articleKey = `${law.code}:${criterion?.id ?? ""}`;
                  const tooltipId = `article-${law.code}-${criterion?.id ?? "none"}-${index}`;
                  const separateDpa = /\bDPA\s*2018\b/i.test(number);
                  const citationSource = citationSourceUrl(number, cell, index);
                  const euRegulation = number.match(/Regulation\s*\(EU\)\s*(\d{4})\/(\d+)/i);
                  const destination = preview && translation
                    ? relatedArticleUrl(translation.id, number, preview.anchorId, currentPath)
                    : citationSource
                    ? citationSource
                    : separateDpa
                    ? "https://www.legislation.gov.uk/ukpga/2018/12"
                    : euRegulation
                      ? `https://eur-lex.europa.eu/eli/reg/${euRegulation[1]}/${euRegulation[2]}/oj`
                    : translation
                      ? relatedArticleUrl(translation.id, number, undefined, currentPath)
                      : readableOfficialUrl(cell.sourceUrl);
                  return <span key={`${number}-${index}`} className={index >= 4 && !expandedArticles[articleKey] ? styles.articleExtra : undefined}><RelatedArticlePreview
                    citation={number} destination={destination} internal={Boolean(preview && translation)}
                    text={preview?.text} tooltipId={tooltipId} /></span>;
                })}{cell.articleNumbers.length > 4 && !expandedArticles[`${law.code}:${criterion?.id ?? ""}`] && <button type="button" className={styles.mobileArticleMore} onClick={() => setExpandedArticles((current) => ({ ...current, [`${law.code}:${criterion?.id ?? ""}`]: true }))}>관련 조항 {cell.articleNumbers.length - 4}개 더 보기</button>}</div> : <p>확인된 조항 없음</p>}</section>
              {cell?.exceptions && cell.exceptions !== "미검토" && <details className={styles.lawExceptions}><summary>주의·예외 보기</summary><p>{cell.exceptions}</p></details>}
              <div className={styles.lawCardLinks}>
                {translation && <Link href={`/public/laws/${translation.id}?back=${encodeURIComponent(currentPath)}`}>법률 전문 읽기 →</Link>}
              {cell?.sourceUrl && readableOfficialUrl(cell.sourceUrl, translation) && <a href={readableOfficialUrl(cell.sourceUrl, translation)} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
              </div>
            </article>;
          })}
        </div>
      </div></> : <p className={styles.lawCatalogEmpty}>비교 자료가 아직 준비되지 않았습니다.</p>}
      <p className={styles.lawDisclaimer}>선택한 법률의 판본·번역 범위와 공식 원문을 함께 확인해 주세요.</p>
    </section>}
    <PublicFooter />
  </main>;
}

