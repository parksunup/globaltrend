"use client";

import { useMemo, useState } from "react";
import questionnaire from "../../../data/business-readiness/questionnaire.json";
import styles from "./business-readiness.module.css";

type Outcome = { level: "check" | "attention" | "unknown" | "not_applicable"; summary: string; actions: string[] };
type Source = { jurisdiction: string; law: string; provisions: string[]; url: string; reviewStatus: string; translationReviewStatus?: string; referenceStatus?: string; comparisonNote?: string };
type Question = { id: string; category: string; title: string; prompt: string; helpText?: string; jurisdictions: string[]; options: { id: string; label: string }[]; outcomes: Record<string, Outcome>; sources: Source[]; reviewStatus: string; jurisdictionMappings?: { jurisdiction: string; status: string; comparisonNote?: string }[] };
type Jurisdiction = { code: string; label: string; shortName: string };
const data = questionnaire as unknown as { schemaVersion: number; jurisdictions: Jurisdiction[]; questions: Question[] };
const stateLabel: Record<Outcome["level"], string> = { check: "확인했어요", attention: "보완할 항목", unknown: "더 확인 필요", not_applicable: "현재 해당 없음" };

export default function BusinessReadinessFlow() {
  const [selected, setSelected] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const questions = useMemo(() => data.questions.filter((question) => question.id !== "markets-and-establishment" && question.jurisdictions.some((code) => selected.includes(code))), [selected]);
  const question = questions[index];

  function toggleJurisdiction(code: string) {
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }
  function reset() { setStarted(false); setIndex(0); setAnswers({}); setShowResult(false); }

  if (showResult) {
    const results = questions.flatMap((item) => {
      const option = answers[item.id];
      if (!option) return [];
      const outcome = item.outcomes[option];
      if (!outcome) return [];
      const sources = item.sources.filter((source) => selected.includes(source.jurisdiction));
      const mappingNotes = selected.map((code) => ({
        code,
        mapping: item.jurisdictionMappings?.find((mapping) => mapping.jurisdiction === code),
      })).filter(({ mapping }) => mapping?.status === "notDirectlyComparable" || mapping?.comparisonNote);
      return [{ item, outcome, sources, mappingNotes }];
    });
    const actionCount = results.filter(({ outcome }) => outcome.level === "attention" || outcome.level === "unknown").length;
    return <section className={styles.flow} aria-live="polite">
      <div className={styles.resultHeader}><p className={styles.kicker}>SELF-CHECK SUMMARY</p><h2>확인할 준비 항목을 정리했어요</h2><p>진출 검토 국가 {selected.length}곳 · 응답한 질문 {results.length}개 · 추가 확인 항목 {actionCount}개</p><p className={styles.caveat}>이 결과는 응답에 따른 참고 목록입니다. 법률상 준수 여부를 판정하지 않습니다.</p></div>
      <div className={styles.resultList}>{results.map(({ item, outcome, sources, mappingNotes }) => <article className={styles.resultCard} key={item.id}>
        <div className={styles.resultMeta}><span>{item.category}</span><b data-level={outcome.level}>{stateLabel[outcome.level]}</b></div>
        <h3>{item.title}</h3><p>{outcome.summary}</p>
        {outcome.actions.length > 0 && <ul>{outcome.actions.map((action) => <li key={action}>{action}</li>)}</ul>}
        {sources.length > 0 && <details><summary>참고 법령·근거 보기</summary><div className={styles.sources}>{sources.map((source) => <p key={`${source.jurisdiction}-${source.law}-${source.provisions.join(",")}`}><strong>{data.jurisdictions.find((jurisdiction) => jurisdiction.code === source.jurisdiction)?.shortName ?? source.jurisdiction} · {source.law}</strong>{source.provisions.length > 0 && ` · ${source.provisions.join(", ")}`}<br /><a href={source.url} target="_blank" rel="noreferrer">공식 원문 또는 자료 열기 ↗</a><small>기존 번역: 사람 검수 완료 · 이 질문과의 조항 연결: 별도 확인 중</small></p>)}</div></details>}
        {mappingNotes.length > 0 && <div className={styles.mappingNote}><strong>국가별 법률 차이</strong>{mappingNotes.map(({ code, mapping }) => <p key={code}><b>{data.jurisdictions.find((jurisdiction) => jurisdiction.code === code)?.shortName ?? code}</b> · {mapping?.status === "notDirectlyComparable" ? "직접 대응하는 법률 개념 없음" : "관련 제도 설명"}<br />{mapping?.comparisonNote}</p>)}</div>}
      </article>)}</div>
      {results.length === 0 && <p className={styles.empty}>응답 결과가 없습니다. 앞 단계로 돌아가 답변을 선택해 주세요.</p>}
      <div className={styles.controls}><button type="button" className={styles.secondary} onClick={() => { setShowResult(false); setIndex(Math.max(questions.length - 1, 0)); }}>답변 돌아보기</button><button type="button" className={styles.primary} onClick={reset}>새로 점검하기</button></div>
      <p className={styles.dataNote}>응답은 이 브라우저 화면에서만 계산하며 서버에 저장하지 않습니다.</p>
    </section>;
  }

  if (!started) return <section className={styles.flow}>
    <div className={styles.stepMeta}><span>시작 전</span><span>진출 국가 선택</span></div>
    <h2>어느 국가로 진출을 준비하고 계신가요?</h2>
    <p className={styles.instruction}>여러 곳을 선택할 수 있습니다. 선택한 국가에 해당하는 질문과 참고 근거를 보여드립니다.</p>
    <div className={styles.jurisdictions}>{data.jurisdictions.map((jurisdiction) => <label key={jurisdiction.code} className={selected.includes(jurisdiction.code) ? styles.jurisdictionSelected : ""}><input type="checkbox" checked={selected.includes(jurisdiction.code)} onChange={() => toggleJurisdiction(jurisdiction.code)} /><span><strong>{jurisdiction.label}</strong><small>{jurisdiction.shortName}</small></span></label>)}</div>
    <div className={styles.controls}><span className={styles.selectionCount}>{selected.length}개 선택됨</span><button type="button" className={styles.primary} disabled={!selected.length || !data.questions.length} onClick={() => { setIndex(0); setStarted(true); }}>점검 시작 <span aria-hidden="true">→</span></button></div>
    {!data.questions.length && <p className={styles.empty}>질문 자료를 준비하고 있습니다.</p>}
  </section>;

  if (!question) return <section className={styles.flow}><h2>선택한 국가에 해당하는 질문이 없습니다.</h2><button className={styles.secondary} onClick={reset}>국가 다시 선택</button></section>;
  const value = answers[question.id] ?? "";
  return <section className={styles.flow}>
    <div className={styles.progressTop}><div><p className={styles.kicker}>BUSINESS PRIVACY CHECK</p><span>{selected.map((code) => data.jurisdictions.find((jurisdiction) => jurisdiction.code === code)?.shortName ?? code).join(" · ")}</span></div><button type="button" className={styles.reset} onClick={reset}>처음부터</button></div>
    <div className={styles.progressTrack} aria-label={`${index + 1} / ${questions.length}`}><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <div className={styles.stepMeta}><span>{question.category}</span><span>{index + 1} / {questions.length}</span></div>
    <h2>{question.title}</h2><p className={styles.questionPrompt}>{question.prompt}</p>{question.helpText && <p className={styles.helpText}>{question.helpText}</p>}
    <fieldset className={styles.options}><legend>현재 상황과 가장 가까운 답을 선택해 주세요.</legend>{question.options.map((option) => <label key={option.id} className={value === option.id ? styles.optionSelected : ""}><input type="radio" name={question.id} value={option.id} checked={value === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} /><span>{option.label}</span></label>)}</fieldset>
    <div className={styles.controls}><button type="button" className={styles.secondary} disabled={index === 0} onClick={() => setIndex((current) => Math.max(current - 1, 0))}>이전</button>{index < questions.length - 1 ? <button type="button" className={styles.primary} disabled={!value} onClick={() => setIndex((current) => current + 1)}>다음 <span aria-hidden="true">→</span></button> : <button type="button" className={styles.primary} disabled={!value} onClick={() => setShowResult(true)}>결과 보기</button>}</div>
    <p className={styles.dataNote}>응답은 저장되지 않습니다. 답을 확신하기 어려우면 ‘모르겠음’에 해당하는 선택지를 고르세요.</p>
  </section>;
}
