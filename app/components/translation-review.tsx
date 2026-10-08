"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SubmissionFeedback from "./submission-feedback";
import styles from "./translation-review.module.css";

export type TranslationSection = {
  id: string;
  group: "main" | "supplementary" | "appendix";
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
};

const groupNames = { main: "본칙", supplementary: "부칙", appendix: "별표" } as const;

export default function TranslationReview({ lawId, title, sections, officialName, officialUrl, version, scopeNote, reviewStatus, branch, commitSha }: Props) {
  const [group, setGroup] = useState<"main" | "supplementary" | "appendix">(sections[0]?.group ?? "main");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(sections.find((section) => section.group === "main")?.id ?? sections[0]?.id ?? "");
  const visible = useMemo(() => sections.filter((section) =>
    section.group === group && [section.title, section.context, ...section.lines.map((line) => line.text)].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [group, query, sections]);
  const selected = visible.find((section) => section.id === selectedId) ?? visible[0];
  const counts = { main: sections.filter((section) => section.group === "main").length,
    supplementary: sections.filter((section) => section.group === "supplementary").length,
    appendix: sections.filter((section) => section.group === "appendix").length };
  const safeSha = commitSha && /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/legal-translation">← 법률별 번역 목록</Link>
      <p className={styles.kicker}>법제 전문 · 사람 검수 전 초안</p>
      <h1>{title}</h1>
      <p>{officialName}의 조문을 순서대로 읽고 의견을 남길 수 있습니다. 이 번역은 비공식 초안이며 검수·공개 승인을 뜻하지 않습니다.</p>
      <div className={styles.meta}><span>선택 판본 시행일: {version}</span><span>사람 검수: {reviewStatus === "not_started" ? "미착수" : reviewStatus}</span><span>본칙 {counts.main}항목 · 부칙 {counts.supplementary}항목 · 별표 {counts.appendix}항목</span></div>
      {scopeNote && <p className={styles.caveat}>범위 주의: {scopeNote}</p>}
      {officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>}
      {safeSha && <a href={`https://github.com/parksunup/globaltrend/blob/${safeSha}/data/legal/translations/${lawId}.md`} target="_blank" rel="noopener noreferrer">번역 초안 원본 파일 보기 ↗</a>}
    </header>
    <div className={styles.controls}>
      <div className={styles.tabs} role="group" aria-label="번역 범위">
        {(["main", "supplementary", "appendix"] as const).map((value) => <button type="button" key={value} aria-pressed={group === value} onClick={() => { setGroup(value); setQuery(""); setSelectedId(sections.find((section) => section.group === value)?.id ?? ""); }}>{groupNames[value]} <span>{counts[value]}</span></button>)}
      </div>
      <label className={styles.search}>조문 또는 본문 검색 <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }} placeholder="예: 제2조, 개인정보" /></label>
    </div>
    <div className={styles.layout}>
      <nav className={styles.index} aria-label="조문 목록">
        {visible.map((section) => <button type="button" key={section.id} className={selected?.id === section.id ? styles.active : ""} onClick={() => setSelectedId(section.id)}>
          <small>{section.context}</small><span>{section.title}</span>
        </button>)}
        {visible.length === 0 && <p>검색 결과가 없습니다.</p>}
      </nav>
      <article className={styles.article}>
        {selected ? <>
          <p className={styles.kicker}>{selected.context} · {selected.reviewStatus === "not_started" ? "사람 검수 전" : selected.reviewStatus}</p>
          <h2>{selected.title}</h2>
          {selected.lines.length ? selected.lines.map((line) => <p key={line.id} className={styles.provision}>{line.label && <strong>{line.label}. </strong>}{line.text}</p>) : <p>이 항목에는 번역 본문이 없습니다. 원본 파일과 범위 메모를 확인해 주세요.</p>}
          <div className={styles.feedback}><SubmissionFeedback key={selected.id} itemId={`translation-${lawId}-${selected.id}`} branch={branch} commitSha={commitSha} /></div>
        </> : <p>왼쪽에서 조문을 선택해 주세요.</p>}
      </article>
    </div>
  </main>;
}
