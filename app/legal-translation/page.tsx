import Link from "next/link";
import { listLegalTranslationEntries } from "../../lib/legal-translation-review";
import { submissionPreviewEnabled } from "../../lib/submission-preview";
import { loadReviewedLegalDrafts } from "../../lib/public-legal";
import styles from "../components/translation-review.module.css";

export const dynamic = "force-dynamic";

export default async function LegalTranslationsPage() {
  const original = submissionPreviewEnabled() ? listLegalTranslationEntries() : [];
  const published = await loadReviewedLegalDrafts().then(bundle => bundle.documents).catch(() => []);
  const entries = original.map(entry => published.find(document => document.id === entry.id) ?? entry);
  entries.push(...published.filter(document => !entries.some(entry => entry.id === document.id)));
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/">← 제출물 검수로 돌아가기</Link>
      <p className={styles.kicker}>법제 전문 · 자료별 발행 상태</p>
      <h1>법률별 한국어 번역</h1>
      <p><Link href="/legal-drafts">최신 전체 비교표·근거 자료 열기 →</Link> · <Link href="/work/legal">법제 검수·발행 →</Link></p>
      <p>한국법은 공식 원문 조문 색인으로 제공하며, 외국법은 선정 판본의 한국어 전문을 제공합니다. 각 법률의 현재 발행 상태를 목록에서 확인할 수 있습니다.</p>
      <p>법률을 선택해 전체 조문을 읽고 수정 의견을 남길 수 있습니다. 발행된 판본은 운영 기록을 반영하며, 미발행 자료와 파일 오류도 별도로 표시합니다.</p>
    </header>
    {entries.length ? <div className={styles.documentList}>
      {entries.map((document) => "error" in document ? <div key={document.id} className={styles.documentCard}><strong>{document.id.toUpperCase()} 번역 파일 오류</strong><span>{document.error}</span><small>data/legal/translations/{document.id}.json을 확인해 주세요.</small></div> : <Link key={document.id} href={`/legal-translation/${document.id}`} className={styles.documentCard}>
        <strong>{document.title}</strong>
        <span>{document.officialName}</span>
        <small>선택 판본 시행일: {document.version} · 조문 {document.articleCount}개 · 상태: {document.reviewStatus === "published" ? "검수 완료·발행됨" : document.reviewStatus === "not_started" ? "미발행 · 제출 자료" : document.reviewStatus}</small>
      </Link>)}
    </div> : <div className={styles.article}><h2>이 배포본에는 번역 전문이 없습니다.</h2><p>법제 담당 브랜치의 Preview에서 확인해 주세요. 파일만 있거나 17개 기준 비교표만 있고 조문 데이터가 없으면 이 목록에는 나타나지 않습니다.</p></div>}
  </main>;
}
