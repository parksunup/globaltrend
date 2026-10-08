import Link from "next/link";
import { listLegalTranslations } from "../../lib/legal-translation-review";
import { submissionPreviewEnabled } from "../../lib/submission-preview";
import styles from "../components/translation-review.module.css";

export default function LegalTranslationsPage() {
  const documents = submissionPreviewEnabled() ? listLegalTranslations() : [];
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/">← 제출물 검수로 돌아가기</Link>
      <p className={styles.kicker}>법제 전문 · 사람 검수 전 초안</p>
      <h1>법률별 한국어 번역 초안</h1>
      <p>법률을 선택해 전체 조문을 읽고 조문별 수정 의견을 남겨 주세요. 번역 초안의 존재는 사람 검수나 공개 승인을 뜻하지 않습니다.</p>
    </header>
    {documents.length ? <div className={styles.documentList}>
      {documents.map((document) => <Link key={document.id} href={`/legal-translation/${document.id}`} className={styles.documentCard}>
        <strong>{document.title}</strong>
        <span>{document.officialName}</span>
        <small>선택 판본 시행일: {document.version} · 조문 {document.articleCount}개 · 사람 검수: {document.reviewStatus === "not_started" ? "미착수" : document.reviewStatus}</small>
      </Link>)}
    </div> : <div className={styles.article}><h2>이 배포본에는 번역 전문이 없습니다.</h2><p>법제 담당 브랜치의 Preview에서 확인해 주세요. 파일만 있거나 17개 기준 비교표만 있고 조문 데이터가 없으면 이 목록에는 나타나지 않습니다.</p></div>}
  </main>;
}
