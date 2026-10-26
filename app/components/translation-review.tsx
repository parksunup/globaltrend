"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SubmissionFeedback from "./submission-feedback";
import styles from "./translation-review.module.css";

export type TranslationSection = {
  id: string;
  group: "main" | "supplementary" | "appendix" | "reference";
  title: string;
  context: string;
  reviewStatus: string;
  lines: { id: string; label: string; text: string }[];
};

type Props = {
  lawId: string;
  title: string;
  sections: TranslationSection[];
  officialName: string;
  officialUrl: string;
  version: string;
  scopeNote: string;
  reviewStatus: string;
  branch?: string;
  commitSha?: string;
  showFeedback?: boolean;
};

const groupNames = { main: "본칙", supplementary: "부칙", appendix: "별표·부속서", reference: "서문·고려사항·주석" } as const;

export default function TranslationReview({ lawId, title, sections, officialName, officialUrl, version, scopeNote, branch, commitSha, showFeedback = true }: Props) {
  const [group, setGroup] = useState<TranslationSection["group"]>(sections.some((section) => section.group === "main") ? "main" : sections[0]?.group ?? "main");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(sections.find((section) => section.group === "main")?.id ?? sections[0]?.id ?? "");
  useEffect(() => {
    const selectHash = () => {
      const section = sections.find((item) => `#${item.id}` === window.location.hash);
      if (!section) return;
      setGroup(section.group);
      setQuery("");
      setSelectedId(section.id);
    };
    selectHash();
    window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, [sections]);
  const visible = useMemo(() => sections.filter((section) =>
    section.group === group && [section.title, section.context, ...section.lines.map((line) => line.text)].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [group, query, sections]);
  const selected = visible.find((section) => section.id === selectedId) ?? visible[0];
  const counts = { main: sections.filter((section) => section.group === "main").length,
    supplementary: sections.filter((section) => section.group === "supplementary").length,
    appendix: sections.filter((section) => section.group === "appendix").length,
    reference: sections.filter((section) => section.group === "reference").length };
  const safeSha = commitSha && /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/legal-translation">← 법률별 번역 목록</Link>
      <p className={styles.kicker}>법제 전문</p>
      <h1>{title}</h1>
      <p>{officialName}의 조문 순서에 따라 한국어 번역을 읽을 수 있습니다. 번역 범위와 공식 원문을 함께 확인해 주세요.</p>
      <div className={styles.meta}><span>판본: {version}</span><span>본칙 {counts.main}항목 · 부칙 {counts.supplementary}항목 · 별표·부속서 {counts.appendix}항목 · 참고 {counts.reference}항목</span></div>
      {scopeNote && <p className={styles.caveat}>번역 범위: {scopeNote}</p>}
      {officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
      {safeSha && <a href={`https://github.com/parksunup/globaltrend/blob/${safeSha}/data/legal/translations/${lawId}.md`} target="_blank" rel="noopener noreferrer">작성 당시 번역 원본 파일 보기 ↗</a>}
    </header>
    <div className={styles.controls}>
      <div className={styles.tabs} role="group" aria-label="번역 범위">
        {(["main", "supplementary", "appendix", "reference"] as const).map((value) => <button type="button" key={value} aria-pressed={group === value} onClick={() => { setGroup(value); setQuery(""); setSelectedId(sections.find((section) => section.group === value)?.id ?? ""); }}>{groupNames[value]} <span>{counts[value]}</span></button>)}
      </div>
      <label className={styles.search}>조문 또는 본문 검색 <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }} placeholder="예: 제2조, 개인정보" /></label>
    </div>
    <div className={styles.layout}>
      <nav className={styles.index} aria-label="조문 목록">
        {visible.map((section) => <button type="button" key={section.id} className={selected?.id === section.id ? styles.active : ""} onClick={() => { setSelectedId(section.id); window.history.replaceState(window.history.state, "", `#${section.id}`); }}>
          <small>{section.context}</small><span>{section.title}</span>
        </button>)}
        {visible.length === 0 && <p>검색 결과가 없습니다.</p>}
      </nav>
      <article id={selected?.id} className={styles.article}>
        {selected ? <>
          <p className={styles.kicker}>{selected.context}</p>
          <h2>{selected.title}</h2>
          {selected.lines.length ? selected.lines.map((line) => <p key={line.id} className={styles.provision}>{line.label && <strong>{line.label}. </strong>}{line.text}</p>) : <p>이 항목에는 번역 본문이 없습니다. 원본 파일과 범위 메모를 확인해 주세요.</p>}
          {showFeedback && <div className={styles.feedback}><SubmissionFeedback key={selected.id} itemId={`translation-${lawId}-${selected.id}`} branch={branch} commitSha={commitSha} /></div>}
        </> : <p>왼쪽에서 조문을 선택해 주세요.</p>}
      </article>
    </div>
  </main>;
}
