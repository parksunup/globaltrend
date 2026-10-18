"use client";

import { useState } from "react";
import styles from "./draft-viewer.module.css";

export default function PublicDraftViewer() {
  const [view, setView] = useState<"comparison" | "translation">("comparison");
  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/">← 제출물 검수로 돌아가기</a>
      <h1>법제 비교와 GDPR 번역 초안</h1>
      <p>7법제 × 17기준 비교 119셀 · GDPR 99조와 고려사항 173개</p>
      <p>로그인 없이 읽는 검토용 초안입니다. 사람 검수는 미착수이며, 판본과 추가 확인 범위는 각 자료에 표시했습니다.</p>
      <p>GDPR은 EU 공식 번역이 아닌 자체 한국어 번역입니다. 2016년 영어 관보 원판과 2018년 영어 정오표를 기초로 하며, 2026년 현행성 전체 확인은 미완료입니다.</p>
    </header>
    <nav className={styles.controls} aria-label="초안 선택">
      <button aria-pressed={view === "comparison"} onClick={() => setView("comparison")}>전체 119셀 비교표</button>
      <button aria-pressed={view === "translation"} onClick={() => setView("translation")}>GDPR 번역 전문</button>
      <a href="/review-drafts/criteria-mapping.csv" download>비교 CSV</a>
      <a href="/review-drafts/criteria-mapping.md" download>비교 Markdown</a>
    </nav>
    <iframe className={styles.document}
      title={view === "comparison" ? "전체 법제 비교 초안" : "GDPR 한국어 번역 초안"}
      src={view === "comparison" ? "/review-drafts/comparison.html" : "/review-drafts/gdpr.html#translation"}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
    <p><a href="/review-drafts/publication-notice.txt">출처·판본·재사용 표시</a> · <a href="/legal-drafts/offline">기존 전달 파일 열기</a></p>
  </main>;
}
