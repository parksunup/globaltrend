import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLegalTranslation } from "../../../../lib/legal-translation-review";
import { publicSubmissionPreviewEnabled } from "../../../../lib/public-submission-preview";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";

export const dynamic = "force-dynamic";

export default async function PublicLawTextPage({ params }: { params: Promise<{ lawId: string }> }) {
  if (!publicSubmissionPreviewEnabled()) notFound();
  const { lawId } = await params;
  const law = loadLegalTranslation(lawId);
  if (!law) notFound();
  const groups = [
    { id: "main", label: "본칙" },
    { id: "supplementary", label: "부칙" },
    { id: "appendix", label: "별표" },
  ] as const;
  return <main className={styles.site}>
    <PublicHeader active="/public/laws" />
    <section className={styles.fullLawPage}>
      <Link href="/public/laws">← 법제 비교로 돌아가기</Link>
      <p className={styles.lawOverline}>KOREAN TRANSLATION DRAFT</p>
      <h1>{law.title}</h1>
      <p>{law.officialName}</p>
      <div className={styles.draftNotice}>사람 검수 전 한국어 번역 초안입니다. 공식 법률 해석이나 확정 번역이 아닙니다.</div>
      <p>선택 판본 시행일: {law.version} · 조문 {law.articleCount}개 · 사람 검수: {law.reviewStatus}</p>
      {law.scopeNote && <p>범위 주의: {law.scopeNote}</p>}
      {law.officialUrl && <a href={law.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
      <nav className={styles.lawGroupLinks} aria-label="번역 범위">
        {groups.map((group) => <a key={group.id} href={`#${group.id}`}>{group.label} {law.sections.filter((section) => section.group === group.id).length}항목</a>)}
      </nav>
      {groups.map((group) => <section key={group.id} id={group.id} className={styles.lawTextGroup}>
        <h2>{group.label}</h2>
        {law.sections.filter((section) => section.group === group.id).map((section) =>
          <article key={section.id} id={section.id} className={styles.lawTextArticle}>
            <small>{section.context} · {section.reviewStatus === "not_started" ? "사람 검수 전" : section.reviewStatus}</small>
            <h3>{section.title}</h3>
            {section.lines.length ? section.lines.map((line) => <p key={line.id}><strong>{line.label ? `${line.label}. ` : ""}</strong>{line.text}</p>) : <p>이 항목에는 번역 본문이 없습니다.</p>}
          </article>)}
      </section>)}
      <Link href={`/legal-translation/${lawId}`}>조문별 피드백 남기기 →</Link>
    </section>
    <PublicFooter />
  </main>;
}
