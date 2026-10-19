"use client";

import Link from "next/link";
import { useState } from "react";
import type { LegalTranslationDocument } from "../../../lib/legal-translation-review";
import styles from "../public.module.css";

const groups = [
  { id: "main", label: "본칙" },
  { id: "supplementary", label: "부칙" },
  { id: "appendix", label: "별표" },
  { id: "reference", label: "서문·고려사항·주석" },
] as const;

export default function PublicLawReader({ law, returnTo }: { law: LegalTranslationDocument; returnTo: string }) {
  const [articleQuery, setArticleQuery] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [tocOpen, setTocOpen] = useState(false);
  const query = articleQuery.trim().toLocaleLowerCase();
  const matchingSections = query ? law.sections.filter((section) => `${section.title} ${section.context}`.toLocaleLowerCase().includes(query) || section.lines.some((line) => `${line.label ?? ""} ${line.text}`.toLocaleLowerCase().includes(query))) : [];
  return <section className={styles.fullLawPage}>
    <Link href={returnTo}>← {returnTo.includes("view=compare") ? "법제 비교로" : "국가별 법제로"} 돌아가기</Link>
    <p className={styles.lawOverline}>KOREAN TRANSLATION</p>
    <h1>{law.title}</h1>
    <p>{law.officialName}</p>
    <div className={styles.draftNotice}>자체 한국어 번역입니다. 공식 원문과 판본·번역 범위를 함께 확인해 주세요.</div>
    <p>선택 판본 시행일: {law.version} · 조문 {law.articleCount}개</p>
    {law.scopeNote && <details className={styles.lawScopeNote}><summary>번역 범위와 판본 안내</summary><p>{law.scopeNote}</p></details>}
    {law.officialUrl && <a href={law.officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
    <div className={styles.lawSearchBar}><label htmlFor="law-article-search">조문 검색</label><input id="law-article-search" type="search" value={articleQuery} onChange={(event) => setArticleQuery(event.target.value)} placeholder="조문 번호나 단어를 입력하세요 (예: 제2조, 개인정보)" />{articleQuery && <button type="button" onClick={() => setArticleQuery("")}>검색 지우기</button>}</div>
    {query && <div className={styles.lawSearchResults} role="status"><strong>검색 결과 {matchingSections.length}개</strong>{matchingSections.length ? <div>{matchingSections.slice(0, 20).map((section) => <a href={`#${section.id}`} key={section.id} onClick={() => setTocOpen(false)}>{section.title}</a>)}{matchingSections.length > 20 && <span>처음 20개를 표시했습니다. 목차에서 나머지도 확인할 수 있습니다.</span>}</div> : <p>일치하는 조문이 없습니다. 다른 단어나 조문 번호로 검색해 보세요.</p>}</div>}
    <div className={styles.lawReaderLayout}>
      {tocOpen && <button type="button" className={styles.lawTocBackdrop} aria-label="목차 닫기" onClick={() => setTocOpen(false)} />}
      <aside className={`${styles.lawToc} ${tocOpen ? styles.lawTocOpen : ""}`}><button type="button" className={styles.lawTocClose} onClick={() => setTocOpen(false)}>목차 닫기 ×</button>
        <h2>조문 목차</h2>
        <p className={styles.lawTocHint}>위의 조문 검색으로 목차를 좁힐 수 있습니다.</p>
        {groups.map((group) => {
          const sections = law.sections.filter((section) => section.group === group.id && (!query || matchingSections.includes(section)));
          if (!sections.length) return null;
          return <details key={group.id} open={Boolean(query) || group.id === "main"}>
            <summary>{group.label} <span>{sections.length}</span></summary>
            <div>{sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setTocOpen(false)}>{section.title}</a>)}</div>
          </details>;
        })}
        {query && matchingSections.length === 0 && <p>일치하는 조문이 없습니다.</p>}
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
                <small>{section.context}</small>
                <h3>{section.title}</h3>
                {section.lines.length ? section.lines.map((line) => <p key={line.id} id={line.id}><strong>{line.label ? `${line.label}. ` : ""}</strong>{line.text}</p>)
                  : <p>이 항목에는 번역 본문이 없습니다.</p>}
              </article>)}
            </section>;
          })}
        </div>
      </div>
    </div>
    <div className={styles.lawMobileReaderTools}><button type="button" onClick={() => setTocOpen(true)}>목차·조문 찾기</button><button type="button" disabled={fontSize <= 14} onClick={() => setFontSize((size) => Math.max(14, size - 2))} aria-label="본문 글자 작게">가−</button><button type="button" disabled={fontSize >= 20} onClick={() => setFontSize((size) => Math.min(20, size + 2))} aria-label="본문 글자 크게">가＋</button></div>
  </section>;
}
