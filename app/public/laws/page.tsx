"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../public.module.css";

const laws = [
  { code:"KR", flag:"🇰🇷", country:"한국", law:"개인정보 보호법" },
  { code:"JP", flag:"🇯🇵", country:"일본", law:"개인정보보호법" },
  { code:"CN", flag:"🇨🇳", country:"중국", law:"개인정보 보호법" },
  { code:"EU", flag:"🇪🇺", country:"EU", law:"일반개인정보보호규정 (GDPR)" },
  { code:"UK", flag:"🇬🇧", country:"영국", law:"데이터보호법·UK GDPR" },
  { code:"CA", flag:"🇺🇸", country:"캘리포니아", law:"소비자 개인정보 보호법 (CCPA)" },
  { code:"SG", flag:"🇸🇬", country:"싱가포르", law:"개인정보보호법 (PDPA)" },
];
const criteria = [
  "개인정보 범위", "법 적용 대상", "개인정보보호 원칙", "정보주체 권리",
  "처리근거 — 수집", "처리근거 — 이용", "제공", "특별한 보호가 필요한 정보",
  "가명·익명정보", "아동 개인정보", "안전성 확보조치", "처리 위탁",
  "국외이전", "과징금", "시정조치 등", "유출 등의 통지·신고", "데이터활용 촉진",
];

export default function PublicLawComparePage() {
  const [selected, setSelected] = useState(["KR", "JP"]);
  const [activeCriterion, setActiveCriterion] = useState(0);
  const [previewCode, setPreviewCode] = useState("JP");
  const [view, setView] = useState<"summary" | "full">("summary");
  const selectedLaws = laws.filter((law) => selected.includes(law.code));
  const toggle = (code:string) => {
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
  const compareCardsClass = selected.length === 3
    ? `${styles.compareCards} ${styles.compareCardsThree}`
    : styles.compareCards;
  const previewLaw = laws.find((law) => law.code === previewCode) ?? laws[0];
  return <main className={styles.lawPage}>
    <header className={styles.lawHeader}>
      <Link href="/public" className={styles.lawBrand}><span className={styles.brandSerif}>GlobalTrend</span><small>세계의 개인정보 보호, 한눈에</small></Link>
      <nav className={styles.lawNav} aria-label="주요 메뉴"><Link href="/public">동향</Link><Link href="/public#weekly">주간호</Link><Link href="/public/laws">법제</Link><a className={styles.lawNavActive} href="#comparison">비교</a></nav>
      <Link href="/public/search" className={styles.lawSearch} aria-label="검색">⌕</Link>
    </header>
    <section className={styles.lawHero}>
      <div><p className={styles.lawOverline}>GLOBAL PRIVACY LAW ATLAS</p><h1>국가별 개인정보 보호법</h1><p>주요 국가와 지역의 개인정보 보호법을 한눈에 비교해 보세요.</p></div>
      <div className={styles.lawOrbit} aria-hidden="true"><div className={styles.lawOrbitRing}><span>KR</span><i>JP</i><b>EU</b><em>UK</em><strong>CN</strong></div><p>GLOBAL PRIVACY LAW ATLAS</p></div>
    </section>
    <section className={styles.countryGrid} aria-label="비교 국가 선택">
      {laws.map((law) => <button key={law.code} type="button" className={selected.includes(law.code) ? styles.countryCardSelected : styles.countryCard} onClick={() => toggle(law.code)} aria-pressed={selected.includes(law.code)}>
        <span className={styles.flag}>{law.flag}</span><strong>{law.country}</strong><small>{law.law}</small>
      </button>)}
    </section>
    <section id="comparison" className={styles.compareSection}>
      <div className={styles.compareTitle}><div><p className={styles.lawOverline}>COMPARE PRIVACY LAWS</p><h2>17개 기준으로 비교하기</h2></div><p>선택한 국가의 개인정보 보호법을 동일한 기준으로 비교할 수 있습니다.</p><span className={styles.selectCount}>{selected.length}개 국가 선택</span></div>
      <div className={styles.compareGrid}>
        <aside className={styles.criteriaList}><h3>비교 기준 <small>17</small></h3><ol>{criteria.map((criterion,index)=><li key={criterion}><button type="button" onClick={()=>setActiveCriterion(index)} className={activeCriterion===index?styles.criteriaActive:""}><span>{String(index+1).padStart(2,"0")}</span>{criterion}<i>›</i></button></li>)}</ol></aside>
        <div className={compareCardsClass}>
          {selectedLaws.map((law) => <article className={styles.lawCompareCard} key={law.code}>
            <header><span className={styles.flag}>{law.flag}</span><div><h3>{law.country}</h3><p>{law.law}</p></div></header>
            <section><strong>주요 내용</strong><p>기준별 조항을 정리한 검수 자료가 등록되면 여기에서 확인할 수 있습니다.</p><span className={styles.draftLabel}>법제 자료 준비 중</span></section>
            <section><strong>핵심 포인트</strong><ul><li>검수 완료된 비교 요약이 표시됩니다.</li><li>원문 조항과 번역 전문을 연결합니다.</li></ul></section>
            <button type="button" onClick={()=>{setPreviewCode(law.code);setView("full");}} className={styles.readLaw}>번역 전문 보기 <span>→</span></button>
          </article>)}
          <aside className={styles.articlePreview}>
            <div className={styles.previewLawHeader}><span className={styles.docIcon}>▤</span><div><small>{view==="summary"?"선택 기준":"법률 전문"}</small><h3>{previewLaw.country} {previewLaw.law}</h3></div></div>
            <span className={styles.versionBadge}>판본·검수 상태 표시 예정</span>
            <div className={styles.previewTabs}><button type="button" onClick={()=>setView("summary")} className={view==="summary"?styles.previewTabActive:""}>조항 요약</button><button type="button" onClick={()=>setView("full")} className={view==="full"?styles.previewTabActive:""}>번역 전문</button></div>
            <p className={styles.previewNotice}>{view==="summary" ? `‘${criteria[activeCriterion]}’ 기준의 조항 요약이 준비되면 조문 번호와 함께 보여드립니다.` : "해당 법률의 전체 한국어 번역이 등록되면 조문 순서대로 읽고 검색할 수 있습니다."}</p>
            <div className={styles.lawEmptyState}><strong>검수 자료 준비 중</strong><p>한국어 번역 전문과 기준별 조항을 등록하면 이 영역에서 읽을 수 있습니다.</p></div>
          </aside>
        </div>
      </div>
      <p className={styles.lawDisclaimer}>현재는 화면 시안입니다. 실제 조문·번역·비교 요약은 공식 판본 확인과 사람 검수를 거친 뒤 공개합니다.</p>
    </section>
    <footer className={styles.lawFooter}><Link href="/public">GlobalTrend</Link><span>법률 전문 번역과 기준별 비교를 연결합니다.</span><Link href="/public/search">동향 검색</Link></footer>
  </main>;
}
