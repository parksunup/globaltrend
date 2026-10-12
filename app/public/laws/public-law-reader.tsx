"use client";

import Link from "next/link";
import { useState } from "react";
import type { LegalTranslationDocument } from "../../../lib/legal-translation-review";
import styles from "../public.module.css";

const groups = [
  { id: "main", label: "본칙" },
  { id: "supplementary", label: "부칙" },
  { id: "appendix", label: "별표" },
] as const;

export default function PublicLawReader({ law }: { law: LegalTranslationDocument }) {
  const [articleQuery, setArticleQuery] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const query = articleQuery.trim().toLocaleLowerCase();
  return <section className={styles.fullLawPage}>
    <Link href="/public/laws?view=full">← 국가별 법제로 돌아가기</Link>
    <p className={styles.lawOverline}>KOREAN TRANSLATION DRAFT</p>
    <h1>{law.title}</h1>
    <p>{law.officialName}</p>
    <div className={styles.draftNotice}>사람 검수 전 한국어 번역 초안입니다. 공식 법률 해석이나 확정 번역이 아닙니다.</div>
    <p>선택 판본 시행일: {law.version} · 조문 {law.articleCount}개 · 사람 검수: {law.reviewStatus === "not_started" ? "검수 전" : law.reviewStatus}</p>
    {law.scopeNote && <details className={styles.lawScopeNote}><summary>번역 범위와 판본 안내</summary><p>{law.scopeNote}</p></details>}
    {law.officialUrl && <a href={law.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
    <div className={styles.lawReaderLayout}>
      <aside className={styles.lawToc}>
        <h2>조문 목차</h2>
        <label>조문 찾기<input type="search" value={articleQuery} onChange={(event) => setArticleQuery(event.target.value)} placeholder="예: 제2조, 개인정보" /></label>
        {groups.map((group) => {
          const sections = law.sections.filter((section) => section.group === group.id &&
            (!query || `${section.title} ${section.context}`.toLocaleLowerCase().includes(query)));
          if (!sections.length) return null;
          return <details key={group.id} open={Boolean(query) || group.id === "main"}>
            <summary>{group.label} <span>{sections.length}</span></summary>
            <div>{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</div>
          </details>;
        })}
        {query && !law.sections.some((section) => `${section.title} ${section.context}`.toLocaleLowerCase().includes(query)) && <p>일치하는 조문이 없습니다.</p>}
      </aside>
      <div className={styles.lawReaderBody}>
        <div className={styles.lawReaderTools}><span>본문 글자 크기</span>
          <button type="button" onClick={() => setFontSize((size) => Math.max(14, size - 2))} disabled={fontSize <= 14} aria-label="글자 작게">가−</button>
          <button type="button" onClick={() => setFontSize((size) => Math.min(20, size + 2))} disabled={fontSize >= 20} aria-label="글자 크게">가＋</button>
        </div>
        <div style={{ fontSize: `${fontSize}px` }}>
          {groups.map((group) => {
            const sections = law.sections.filter((section) => section.group === group.id);
            if (!sections.length) return null;
            return <section key={group.id} id={group.id} className={styles.lawTextGroup}>
              <h2>{group.label}</h2>
              {sections.map((section) => <article key={section.id} id={section.id} className={styles.lawTextArticle}>
                <small>{section.context} · {section.reviewStatus === "not_started" ? "사람 검수 전" : section.reviewStatus}</small>
                <h3>{section.title}</h3>
                {section.lines.length ? section.lines.map((line) => <p key={line.id} id={line.id}><strong>{line.label ? `${line.label}. ` : ""}</strong>{line.text}</p>)
                  : <p>이 항목에는 번역 본문이 없습니다.</p>}
              </article>)}
            </section>;
          })}
        </div>
      </div>
    </div>
    <Link href={`/legal-translation/${law.id}`}>조문별 피드백 남기기 →</Link>
  </section>;
}
