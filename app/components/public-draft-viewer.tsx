"use client";

import { useState } from "react";
import type { SubmissionDocuments } from "../../lib/submission-preview";
import type { LegalTranslationDocument } from "../../lib/legal-translation-review";
import SubmissionDocumentsView from "./submission-documents";
import TranslationReview from "./translation-review";
import styles from "./draft-viewer.module.css";

export default function PublicDraftViewer({documents, gdpr, branch, commitSha}: {documents: SubmissionDocuments; gdpr: LegalTranslationDocument | null; branch?: string; commitSha?: string}) {
  const [view, setView] = useState<"comparison" | "translation">("comparison");
  const published = documents.legal.filter(cell => cell.status === "published").length;
  return <div className={styles.page}>
    <header className={styles.header}>
      <a href="/team">← 제출 자료로 돌아가기</a>
      <h1>법제 비교와 한국어 번역</h1>
      <p>17개 기준 비교 {documents.legal.length}셀 · 검수 완료·발행된 비교 내용 {published}셀</p>
      <p>자료별 운영 발행 상태를 표시합니다. 작성 당시의 추가 확인 메모는 현재 상태와 구분해서 보관합니다.</p>
      <p>한국어 번역은 자체 번역입니다. 공식 원문과 판본·번역 범위는 각 자료에서 확인할 수 있습니다.</p>
    </header>
    <nav className={styles.controls} aria-label="자료 선택">
      <button aria-pressed={view === "comparison"} onClick={() => setView("comparison")}>전체 기준 비교표</button>
      <button aria-pressed={view === "translation"} onClick={() => setView("translation")}>GDPR 번역 전문</button>
      <a href="/legal-translation">법률별 번역 목록</a>
    </nav>
    {view === "comparison" ? <section aria-label="법제 비교표"><SubmissionDocumentsView documents={documents} branch={branch} commitSha={commitSha}/></section>
      : gdpr ? <TranslationReview lawId={gdpr.id} title={gdpr.title} sections={gdpr.sections} officialName={gdpr.officialName} officialUrl={gdpr.officialUrl} version={gdpr.version} scopeNote={gdpr.scopeNote} reviewStatus={gdpr.reviewStatus} branch={branch} commitSha={commitSha}/>
      : <p>이 배포본에서 GDPR 번역 본문을 불러오지 못했습니다. <a href="/legal-translation">번역 목록 보기</a> · <a href="/legal-drafts/offline">전달 파일 열기</a></p>}
    <details><summary>작성 당시 파일·내려받기</summary><p>아래 파일 안의 초안·미착수 표기는 작성 당시 기록이며 현재 운영 검수·발행 상태와 별개입니다.</p>
      <a href="/review-drafts/criteria-mapping.csv" download>비교 CSV</a> · <a href="/review-drafts/criteria-mapping.md" download>비교 Markdown</a> · <a href="/review-drafts/publication-notice.txt">출처·판본·재사용 표시</a> · <a href="/legal-drafts/offline">전달 파일 열기</a>
    </details>
  </div>;
}
