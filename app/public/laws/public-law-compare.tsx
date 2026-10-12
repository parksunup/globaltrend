"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import styles from "../public.module.css";
import type { LegalComparisonCell, SubmissionItem } from "../../../lib/submission-preview";
import type { LegalTranslationSummary } from "../../../lib/legal-translation-review";
import { PublicHeader, PublicFooter } from "../public-navigation";

const countries = [
  { code: "KR", flag: "/flags/kr.svg", country: "한국", law: "개인정보 보호법" },
  { code: "JP", flag: "/flags/jp.svg", country: "일본", law: "개인정보보호법" },
  { code: "CN", flag: "/flags/cn.svg", country: "중국", law: "개인정보 보호법" },
  { code: "EU", flag: "/flags/eu.svg", country: "EU", law: "GDPR" },
  { code: "GB", flag: "/flags/gb.svg", country: "영국", law: "UK GDPR" },
  { code: "US-CA", flag: "/flags/us-ca.svg", country: "캘리포니아", law: "CCPA" },
  { code: "SG", flag: "/flags/sg.svg", country: "싱가포르", law: "PDPA" },
];

export default function PublicLawCompare({ cells, instruments, translations, draftMode }: {
  cells: LegalComparisonCell[]; instruments: SubmissionItem[];
  translations: LegalTranslationSummary[]; draftMode: boolean;
}) {
  const previewRef = useRef<HTMLElement>(null);
  const criteria = useMemo(() => Array.from(new Map(cells.map((cell) =>
    [cell.criterionId, { id: cell.criterionId, name: cell.criterionName, order: cell.criterionOrder }]
  )).values()).sort((a, b) => a.order - b.order), [cells]);
  const [selected, setSelected] = useState(["KR", "JP"]);
  const [activeCriterion, setActiveCriterion] = useState(criteria[0]?.id ?? "");
  const [previewCode, setPreviewCode] = useState("JP");
  const [view, setView] = useState<"summary" | "full">("summary");
  const selectedLaws = countries.filter((law) => selected.includes(law.code));
  const criterion = criteria.find((item) => item.id === activeCriterion) ?? criteria[0];
  const cellFor = (code: string) => cells.find((cell) => cell.criterionId === criterion?.id && cell.jurisdiction === code);
  const recordFor = (code: string) => instruments.find((item) =>
    item.kind === "법제 목록" && item.fields.some((field) => field.label === "관할권" && field.value === code));
  const translationFor = (code: string) => translations.find((item) => item.jurisdiction === code);
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      if (selected.length === 1) return;
      const next = selected.filter((item) => item !== code);
      setSelected(next);
      if (previewCode === code) setPreviewCode(next[0]);
      return;
    }
    if (selected.length >= 3) return;
    setSelected([...selected, code]);
    setPreviewCode(code);
  };
  const compareCardsClass = selected.length === 3 ? `${styles.compareCards} ${styles.compareCardsThree}`
    : selected.length === 1 ? `${styles.compareCards} ${styles.compareCardsOne}` : styles.compareCards;
  const previewLaw = countries.find((law) => law.code === previewCode) ?? countries[0];
  const previewCell = cellFor(previewLaw.code);
  const previewTranslation = translationFor(previewLaw.code);
  return <main className={styles.lawPage}>
    <PublicHeader active="/public/laws" />
    {draftMode && <p className={styles.draftNotice}>통합 테스트 · 법제 담당 조사 자료 · 사람 검수 전 초안입니다. 확정된 법률 해설이 아닙니다.</p>}
    <section className={styles.lawHero}>
      <div><p className={styles.lawOverline}>GLOBAL PRIVACY LAW ATLAS</p><h1>국가별 개인정보 보호법</h1>
      <p>{instruments.length}개 법률의 조사 상태와 {criteria.length}개 기준의 비교 초안을 살펴보세요.</p></div>
    </section>
    <section className={styles.countryGrid} aria-label="비교 국가 선택">
      {countries.map((law) => <button key={law.code} type="button"
        className={selected.includes(law.code) ? styles.countryCardSelected : styles.countryCard}
        onClick={() => toggle(law.code)} aria-pressed={selected.includes(law.code)}
        disabled={!selected.includes(law.code) && selected.length >= 3}>
        <Image className={styles.flag} src={law.flag} width={42} height={28} alt="" aria-hidden="true" />
        <strong>{law.country}</strong><small>{recordFor(law.code)?.title ?? law.law}</small>
      </button>)}
    </section>
    <section id="comparison" className={styles.compareSection}>
      <div className={styles.compareTitle}><div><p className={styles.lawOverline}>COMPARE PRIVACY LAWS</p><h2>17개 기준으로 비교하기</h2></div>
      <p>선택한 국가의 제출된 요약과 관련 조항을 비교합니다.</p><span className={styles.selectCount}>{selected.length}/3개 국가 선택</span></div>
      <div className={styles.compareGrid}>
        <aside className={styles.criteriaList}><h3>비교 기준 <small>{criteria.length}</small></h3><ol>{criteria.map((item, index) =>
          <li key={item.id}><button type="button" onClick={() => { setActiveCriterion(item.id); setView("summary"); }}
            aria-pressed={criterion?.id === item.id} className={criterion?.id === item.id ? styles.criteriaActive : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>{item.name}<i>›</i></button></li>)}</ol></aside>
        <div className={compareCardsClass}>
          {selectedLaws.map((law) => {
            const cell = cellFor(law.code);
            const record = recordFor(law.code);
            const drafted = cell && cell.summary && cell.summary !== "미검토";
            return <article className={styles.lawCompareCard} key={law.code}>
              <header><Image className={styles.flag} src={law.flag} width={42} height={28} alt="" aria-hidden="true" />
                <div><h3>{law.country}</h3><p>{record?.title ?? law.law}</p></div></header>
              <section><strong>{criterion?.name ?? "비교 기준"}</strong>
                <p>{drafted ? cell.summary : "이 기준의 조항 요약은 아직 검토 중입니다."}</p>
                <span className={styles.draftLabel}>{drafted ? "사람 검수 전 초안" : "추가 조사 필요"}</span></section>
              <section><strong>관련 조항</strong><ul><li>{cell?.articleNumbers.length ? cell.articleNumbers.join(" · ") : "확인된 조항 없음"}</li></ul></section>
              <button type="button" onClick={() => { setPreviewCode(law.code); setView("summary");
                requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}
                className={styles.readLaw}>자료 자세히 보기 <span>→</span></button>
            </article>;
          })}
          <aside className={styles.articlePreview} ref={previewRef} aria-live="polite">
            <div className={styles.previewLawHeader}><span className={styles.docIcon}>▤</span><div>
              <small>{view === "summary" ? "선택 기준" : "한국어 번역 전문"}</small><h3>{previewLaw.country} {recordFor(previewLaw.code)?.title ?? previewLaw.law}</h3>
            </div></div>
            <span className={styles.versionBadge}>{previewCell?.sourceVersion || "판본 확인 필요"}</span>
            <div className={styles.previewTabs}><button type="button" onClick={() => setView("summary")}
              className={view === "summary" ? styles.previewTabActive : ""}>조항 요약</button>
              <button type="button" onClick={() => setView("full")}
                className={view === "full" ? styles.previewTabActive : ""}>번역 전문</button></div>
            {view === "summary" ? <>
              <p className={styles.previewNotice}>{previewCell?.summary || "비교 자료가 없습니다."}</p>
              {previewCell?.articleNumbers.length ? <p>관련 조항: {previewCell.articleNumbers.join(" · ")}</p> : null}
              {previewCell?.exceptions && previewCell.exceptions !== "미검토" ? <p>주의: {previewCell.exceptions}</p> : null}
              {previewCell?.sourceUrl && <a href={previewCell.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
            </> : previewTranslation ? <div className={styles.lawEmptyState}>
              <strong>{previewTranslation.title}</strong><p>조문 {previewTranslation.articleCount}개 · 사람 검수: {previewTranslation.reviewStatus}</p>
              <Link href={`/public/laws/${previewTranslation.id}`}>전체 번역 초안 읽기 →</Link>
            </div> : <div className={styles.lawEmptyState}><strong>번역 전문 초안 없음</strong>
              <p>현재 제출된 전체 한국어 번역은 이 법률에 없습니다. 비교표의 조항 요약만 확인할 수 있습니다.</p></div>}
          </aside>
        </div>
      </div>
      <p className={styles.lawDisclaimer}>이 화면의 비교 요약과 번역은 공식 원문을 대조하는 사람 검수 전 초안입니다.</p>
    </section>
    <PublicFooter />
  </main>;
}
