import Link from "next/link";
import { loadSubmittedSources, publicSubmissionPreviewEnabled } from "../../../lib/public-submission-preview";
import { PublicHeader, PublicFooter } from "../public-navigation";
import styles from "../public.module.css";

export const dynamic = "force-dynamic";

export default function PublicSourcesPage() {
  const draftMode = publicSubmissionPreviewEnabled();
  const sources = draftMode ? loadSubmittedSources() : [];
  return <main className={styles.site}>
    <PublicHeader active="/public/sources" />
    <section className={styles.sourcesPage}>
      <p className={styles.lawOverline}>OFFICIAL SOURCE CANDIDATES</p>
      <h1>수집 출처</h1>
      <p>동향 담당자가 조사한 공식 출처와 표본 현황입니다.</p>
      {draftMode && <div className={styles.draftNotice}>수집 방법과 공식 사이트를 출처별로 살펴보실 수 있습니다.</div>}
      <div className={styles.sourceGrid}>
        {sources.map((source) => <article key={source.id} className={styles.sourceCard}>
          <small>{source.id.toUpperCase()} · 표본 {source.sampleCount}건</small>
          <h2>{source.organization}</h2>
          <p>자료 유형: {source.documentTypes.join(" · ") || "검토 필요"}</p>
          <p>{source.collectionMethod}</p>
          {source.startUrl && <a href={source.startUrl} target="_blank" rel="noopener noreferrer">공식 사이트 보기 ↗</a>}
          <Link href="/public/search">관련 동향 표본 보기 →</Link>
        </article>)}
      </div>
      {!sources.length && <p>표시할 수집 출처가 없습니다.</p>}
    </section>
    <PublicFooter />
  </main>;
}
