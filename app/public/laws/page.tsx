"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../public.module.css";

const laws = ["대한민국 · 개인정보 보호법", "일본 · APPI", "중국 · PIPL", "EU · GDPR", "영국 · UK GDPR", "미국 캘리포니아 · CCPA", "싱가포르 · PDPA"];
const criteria = [
  ["01", "개인정보의 범위"], ["02", "적법 처리 근거"], ["03", "목적 제한"], ["04", "정보주체의 권리"], ["05", "제3자 제공"], ["06", "국외 이전"], ["07", "보유 기간과 파기"]
];

export default function PublicLawComparePage() {
  const [left, setLeft] = useState(laws[0]);
  const [right, setRight] = useState(laws[1]);
  return <main className={styles.lawPage}>
    <header className={styles.lawHeader}>
      <Link href="/public" className={styles.lawBrand}><span className={styles.brandMark}>G</span> GLOBAL<span className={styles.brandAccent}>TREND</span></Link>
      <nav className={styles.nav} aria-label="주요 메뉴"><Link href="/public">글로벌 동향</Link><Link href="/public/search">동향 검색</Link><Link className={styles.navActive} href="/public/laws">법제 비교</Link></nav>
      <span className={styles.headerNote}><i /> LEGAL COMPARISON</span>
    </header>
    <section className={styles.lawIntro}>
      <p className={styles.eyebrow}>COMPARE PRIVACY LAWS</p>
      <h1>나라별 법제를<br /><em>같은 기준으로 읽다.</em></h1>
      <p>비교할 법률을 고르면, 기준별 관련 조문을 나란히 확인할 수 있도록 설계했습니다.</p>
    </section>
    <section className={styles.lawSelectors} aria-label="비교할 법률 선택">
      <label><span>첫 번째 법제</span><select value={left} onChange={(event) => setLeft(event.target.value)}>{laws.map((law) => <option key={law}>{law}</option>)}</select></label>
      <span className={styles.lawVersus}>VS</span>
      <label><span>두 번째 법제</span><select value={right} onChange={(event) => setRight(event.target.value)}>{laws.map((law) => <option key={law}>{law}</option>)}</select></label>
      <button type="button" className={styles.swapButton} onClick={() => { setLeft(right); setRight(left); }}>↔ 바꾸기</button>
    </section>
    <div className={styles.lawWorkspace}>
      <aside className={styles.criteriaRail}><p>비교 기준 <span>17</span></p>{criteria.map(([number, label], index) => <a key={number} className={index === 0 ? styles.criterionActive : ""} href={`#criterion-${number}`}><small>{number}</small>{label}<span>→</span></a>)}<small className={styles.criteriaMore}>나머지 기준 10개</small></aside>
      <div className={styles.comparison}>
        <div className={styles.comparisonHead}><span>기준별 조문 비교</span><span>전체 17개 기준 · 화면 구성 예시</span></div>
        {criteria.slice(0, 5).map(([number, label]) => <section id={`criterion-${number}`} key={number} className={styles.compareRow}>
          <div className={styles.criterionName}><small>{number}</small><strong>{label}</strong><span>관련 조항을 기준별로 모아 읽습니다.</span></div>
          <div className={styles.lawCell}><span>{left.split(" · ")[0]}</span><p>검수된 번역 조항이 등록되면 이 위치에서 확인할 수 있습니다.</p><small>자료 준비 중</small></div>
          <div className={styles.lawCell}><span>{right.split(" · ")[0]}</span><p>검수된 번역 조항이 등록되면 이 위치에서 확인할 수 있습니다.</p><small>자료 준비 중</small></div>
        </section>)}
        <p className={styles.lawNotice}>법률별 전체 한국어 번역과 17개 기준 요약표를 연결해 제공할 예정입니다. 현재는 화면 구조 시안이며 실제 법률 정보가 표시되지 않습니다.</p>
      </div>
    </div>
    <footer className={styles.footer}><span>GLOBAL<span className={styles.brandAccent}>TREND</span></span><p>법률 전문 번역과 기준별 비교를 한 화면에서</p><Link href="/public/search">동향 검색</Link></footer>
  </main>;
}
