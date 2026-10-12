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

function relatedArticleUrl(translationId: string, article: string, anchorId?: string): string {
  const match = article.match(/제(\d+)조(?:의(\d+))?/);
  return `/public/laws/${translationId}${anchorId ? `#${anchorId}` : match ? `#main-a${match[1]}${match[2] ? `-${match[2]}` : ""}` : ""}`;
}

export default function PublicLawCompare({ cells, instruments, translations, articlePreviews, draftMode, initialView }: {
  cells: LegalComparisonCell[]; instruments: SubmissionItem[];
  translations: LegalTranslationSummary[]; articlePreviews: Record<string, LegalArticlePreview>; draftMode: boolean; initialView: "full" | "compare";
}) {
  const criteria = useMemo(() => Array.from(new Map(cells.map((cell) =>
    [cell.criterionId, { id: cell.criterionId, name: cell.criterionName, order: cell.criterionOrder }]
  )).values()).sort((a, b) => a.order - b.order), [cells]);
  const [view, setView] = useState<"full" | "compare">(initialView);
  const [selected, setSelected] = useState(["KR", "JP"]);
  const [activeCountry, setActiveCountry] = useState("JP");
  const [activeCriterion, setActiveCriterion] = useState(criteria[0]?.id ?? "");
  useEffect(() => setView(initialView), [initialView]);

  const selectedLaws = countries.filter((law) => selected.includes(law.code));
  const criterion = criteria.find((item) => item.id === activeCriterion) ?? criteria[0];
  const recordsFor = (code: string) => instruments.filter((item) =>
    item.kind === "법제 목록" && item.fields.some((field) => field.label === "관할권" && field.value === code));
  const translationFor = (code: string, record?: SubmissionItem) => translations.find((item) =>
    item.jurisdiction === code && (!record || record.id.endsWith(item.id)));
  const toggle = (code: string) => {
    if (view === "full") { setActiveCountry(code); return; }
    if (selected.includes(code)) {
      if (selected.length > 1) setSelected(selected.filter((item) => item !== code));
    } else if (selected.length < 3) setSelected([...selected, code]);
  };
  const setSection = (next: "full" | "compare") => {
    setView(next);
    window.history.replaceState(null, "", `/public/laws?view=${next}`);
  };
  const activeLaw = countries.find((law) => law.code === activeCountry) ?? countries[1];

  return <main className={styles.lawPage}>
    <PublicHeader active="/public/laws" />
    {draftMode && <p className={styles.draftNotice}>통합 테스트 · 법제 담당 조사 자료 · 사람 검수 전 초안입니다. 확정된 법률 해설이 아닙니다.</p>}
    <section className={styles.lawHero}>
      <div><p className={styles.lawOverline}>GLOBAL PRIVACY LAW ATLAS</p><h1>국가별 법제</h1>
      <p>국가·지역별 법률을 읽고, 같은 기준으로 나란히 비교해 보세요.</p></div>
    </section>
    <nav className={styles.lawViewTabs} aria-label="국가별 법제 보기">
      <button type="button" aria-current={view === "full" ? "page" : undefined} className={view === "full" ? styles.lawViewActive : ""} onClick={() => setSection("full")}>법률 전문</button>
      <button type="button" aria-current={view === "compare" ? "page" : undefined} className={view === "compare" ? styles.lawViewActive : ""} onClick={() => setSection("compare")}>법제 비교</button>
    </nav>
    <section className={styles.countryGrid} aria-label={view === "full" ? "법률을 읽을 국가·지역 선택" : "비교할 국가·지역 선택"}>
      {countries.map((law) => {
        const chosen = view === "full" ? activeCountry === law.code : selected.includes(law.code);
        return <button key={law.code} type="button" className={chosen ? styles.countryCardSelected : styles.countryCard}
          onClick={() => toggle(law.code)} aria-pressed={chosen}
          disabled={view === "compare" && !chosen && selected.length >= 3}>
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
              <small>한국어 전문 초안 · {translation.articleCount}개 조문 · 시행일 {translation.version} · 사람 검수: {translation.reviewStatus}</small>
              <Link className={styles.catalogPrimary} href={`/public/laws/${translation.id}`}>제1조부터 전문 읽기 →</Link>
            </> : <><small>한국어 전문 준비 중</small><button type="button" onClick={() => setSection("compare")}>17개 기준 비교 요약 보기 →</button></>}
            {official && <a href={official.url} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
          </article>;
        })}
      </div> : <p className={styles.lawCatalogEmpty}>이 국가·지역의 법률 자료가 아직 준비되지 않았습니다.</p>}
    </section> : <section id="comparison" className={styles.compareSection}>
      <div className={styles.compareTitle}><div><p className={styles.lawOverline}>COMPARE PRIVACY LAWS</p><h2>17개 기준으로 비교하기</h2></div>
        <p>선택한 국가·지역의 요약과 관련 조항을 같은 순서로 비교합니다.</p>
        <span className={styles.selectCount}>{selected.length}/3개 국가·지역 선택</span></div>
      {criteria.length ? <div className={styles.compareGrid}>
        <aside className={styles.criteriaList}><h3>비교 기준 <small>{criteria.length}</small></h3><ol>{criteria.map((item, index) =>
          <li key={item.id}><button type="button" onClick={() => setActiveCriterion(item.id)}
            aria-pressed={criterion?.id === item.id} className={criterion?.id === item.id ? styles.criteriaActive : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>{item.name}<i>›</i></button></li>)}</ol></aside>
        <div className={`${styles.compareCards} ${selected.length === 3 ? styles.compareCardsThree : selected.length === 1 ? styles.compareCardsOne : ""}`}>
          {selectedLaws.map((law) => {
            const cell = cells.find((item) => item.criterionId === criterion?.id && item.jurisdiction === law.code);
            const record = recordsFor(law.code)[0];
            const translation = translationFor(law.code, record);
            const drafted = cell && cell.summary && cell.summary !== "미검토";
            return <article className={styles.lawCompareCard} key={law.code}>
              <header><Image className={styles.flag} src={law.flag} width={42} height={28} alt="" aria-hidden="true" />
                <div><h3>{law.country}</h3><p>{record?.title ?? law.law}</p></div></header>
              <section><strong>{criterion?.name ?? "비교 기준"}</strong>
                <p>{drafted ? cell.summary : "이 기준의 조항 요약은 아직 검토 중입니다."}</p>
                <span className={styles.draftLabel}>{drafted ? "사람 검수 전 초안" : "추가 조사 필요"}</span></section>
              <section><strong>관련 조항</strong>
                {cell?.articleNumbers.length ? <div className={styles.articleLinks}>{cell.articleNumbers.map((number, index) => {
                  const preview = translation ? articlePreviews[`${translation.id}:${number}`] : undefined;
                  const tooltipId = `article-${law.code}-${criterion?.id ?? "none"}-${index}`;
                  const destination = translation
                    ? relatedArticleUrl(translation.id, number, preview?.anchorId)
                    : cell.sourceUrl;
                  return <RelatedArticlePreview key={`${number}-${index}`}
                    citation={number} destination={destination} internal={Boolean(translation)}
                    text={preview?.text} tooltipId={tooltipId} />;
                })}</div> : <p>확인된 조항 없음</p>}</section>
              {cell?.exceptions && cell.exceptions !== "미검토" && <details className={styles.lawExceptions}><summary>주의·예외 보기</summary><p>{cell.exceptions}</p></details>}
              <div className={styles.lawCardLinks}>
                {translation && <Link href={`/public/laws/${translation.id}`}>법률 전문 읽기 →</Link>}
                {cell?.sourceUrl && <a href={cell.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
              </div>
            </article>;
          })}
        </div>
      </div> : <p className={styles.lawCatalogEmpty}>비교 자료가 아직 준비되지 않았습니다.</p>}
      <p className={styles.lawDisclaimer}>비교 요약과 한국어 번역은 공식 원문을 대조하는 사람 검수 전 초안입니다.</p>
    </section>}
    <PublicFooter />
  </main>;
}
