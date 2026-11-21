"use client";

import { useMemo, useState } from "react";
import jp from "../../../data/business-readiness/questions/JP.json";
import cn from "../../../data/business-readiness/questions/CN.json";
import eu from "../../../data/business-readiness/questions/EU.json";
import uk from "../../../data/business-readiness/questions/UK.json";
import california from "../../../data/business-readiness/questions/US-CA.json";
import singapore from "../../../data/business-readiness/questions/SG.json";
import styles from "./business-readiness.module.css";

type Answer = "ready" | "partial" | "not_started" | "unknown" | "not_applicable";
type Question = { id: string; category: string; question: string; helpText: string; sourceNote: string; sourceUrl?: string; jurisdiction: string };
type QuestionFile = { jurisdiction: string; guidePath: string; questions: Omit<Question, "jurisdiction">[] };
type Jurisdiction = { code: string; label: string; shortName: string; guideUrl: string };

const questionFiles: Record<string, QuestionFile> = {
  JP: jp as QuestionFile,
  CN: cn as QuestionFile,
  EU: eu as QuestionFile,
  UK: uk as QuestionFile,
  "US-CA": california as QuestionFile,
  SG: singapore as QuestionFile,
};

const jurisdictions: Jurisdiction[] = [
  { code: "JP", label: "일본", shortName: "개인정보 보호법(APPI)", guideUrl: "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/" },
  { code: "CN", label: "중국", shortName: "개인정보보호법(PIPL)", guideUrl: "https://www.cac.gov.cn/2025-02/14/c_1741233507681519.htm" },
  { code: "EU", label: "EU", shortName: "GDPR", guideUrl: "https://www.edpb.europa.eu/sme_en" },
  { code: "UK", label: "영국", shortName: "UK GDPR", guideUrl: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/" },
  { code: "US-CA", label: "미국 캘리포니아주", shortName: "CCPA/CPRA", guideUrl: "https://cppa.ca.gov/regulations/" },
  { code: "SG", label: "싱가포르", shortName: "PDPA", guideUrl: "https://www.pdpc.gov.sg/guidelines-and-consultation" },
];

const answerOptions: { id: Answer; label: string }[] = [
  { id: "ready", label: "네, 준비해서 하고 있어요" },
  { id: "partial", label: "일부만 준비했어요" },
  { id: "not_started", label: "아직 준비하지 못했어요" },
  { id: "unknown", label: "잘 모르겠어요" },
  { id: "not_applicable", label: "우리 회사에는 해당하지 않아요" },
];

const answerSummary: Record<Answer, { label: string; summary: string; needsAction: boolean }> = {
  ready: { label: "준비됨", summary: "준비되어 있다고 답하셨습니다. 실제 업무와 자료에도 그대로 적용되는지 확인해 보세요.", needsAction: false },
  partial: { label: "일부 보완", summary: "일부만 준비되어 있다고 답하셨습니다. 아래 확인사항을 참고해 빠진 부분을 살펴보세요.", needsAction: true },
  not_started: { label: "확인할 항목", summary: "아직 준비하지 않았다고 답하셨습니다. 아래 안내에서 시작할 일을 확인해 보세요.", needsAction: true },
  unknown: { label: "자료 확인 필요", summary: "현재 상태를 잘 모른다고 답하셨습니다. 관련 문서나 담당자와 먼저 확인해 보세요.", needsAction: true },
  not_applicable: { label: "해당 없음", summary: "회사에 해당하지 않는다고 답하셨습니다. 그렇게 판단한 이유를 기록해 두면 다시 확인할 때 도움이 됩니다.", needsAction: false },
};

export default function BusinessReadinessFlow() {
  const [selected, setSelected] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [naReasons, setNaReasons] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState("");

  const questions = useMemo(() => jurisdictions
    .filter(({ code }) => selected.includes(code))
    .flatMap(({ code }) => questionFiles[code].questions.map((question) => ({ ...question, jurisdiction: code }))), [selected]);
  const question = questions[index];

  function toggleJurisdiction(code: string) {
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  function reset() {
    setStarted(false);
    setIndex(0);
    setAnswers({});
    setNaReasons({});
    setShowResult(false);
    setHandoffBusy(false);
    setHandoffError("");
  }

  async function consultWithResult(results: { item: Question; answer: Answer; outcome: { needsAction: boolean }; reason?: string }[]) {
    setHandoffError("");
    setHandoffBusy(true);
    try {
      if (typeof CompressionStream === "undefined") throw new Error("현재 브라우저에서 앱 연결을 지원하지 않습니다. Chrome 또는 Edge 최신 버전에서 다시 시도해 주세요.");
      const details = results.filter(({ outcome }) => outcome.needsAction).map(({ item, answer }) => ({
        jurisdiction: jurisdictions.find(({ code }) => code === item.jurisdiction)?.label ?? item.jurisdiction,
        questionId: item.id,
        question: item.question,
        status: answerSummary[answer].label,
        preparationGuide: item.helpText,
      }));
      const counts = selected.map((code) => {
        const country = jurisdictions.find(({ code: candidate }) => candidate === code);
        const jurisdictionResults = results.filter(({ item }) => item.jurisdiction === code);
        return { jurisdiction: country?.label ?? code, total: jurisdictionResults.length, needsAction: jurisdictionResults.filter(({ outcome }) => outcome.needsAction).length };
      });
      const payload = JSON.stringify({ version: 1, jurisdictions: selected, counts, findings: details });
      const compressed = await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
      if (compressed.byteLength > 24_000) throw new Error("전달할 결과가 앱 연결 크기를 초과했습니다. 선택한 지역을 나누어 점검한 뒤 다시 시도해 주세요.");
      const bytes = new Uint8Array(compressed);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      window.location.href = `globaltrend-advisor://assessment#${encoded}`;
      window.setTimeout(() => setHandoffBusy(false), 1600);
    } catch (cause) {
      setHandoffBusy(false);
      setHandoffError(cause instanceof Error ? cause.message : "상담 앱으로 결과를 전달하지 못했습니다.");
    }
  }

  if (showResult) {
    const results = questions.flatMap((item) => {
      const answer = answers[item.id];
      return answer ? [{ item, answer, outcome: answerSummary[answer], reason: naReasons[item.id] }] : [];
    });
    const actionCount = results.filter(({ outcome }) => outcome.needsAction).length;
    return <section className={styles.flow} aria-live="polite">
      <div className={styles.resultHeader}>
        <p className={styles.kicker}>점검 결과</p>
        <h2>확인할 준비 항목을 모았어요</h2>
        <p>선택한 관할 {selected.length}곳 · 답변한 질문 {results.length}개 · 추가로 살펴볼 항목 {actionCount}개</p>
        <p className={styles.caveat}>이 결과는 답변을 정리한 참고자료입니다. 법률상 준수 여부나 위반 여부를 판정하지 않습니다.</p>
      </div>
      <div className={styles.resultList}>{results.map(({ item, answer, outcome, reason }) => {
        const jurisdiction = jurisdictions.find(({ code }) => code === item.jurisdiction);
        return <article className={styles.resultCard} key={item.id}>
          <div className={styles.resultMeta}><span>{jurisdiction?.label} · {item.category}</span><b data-level={answer === "ready" ? "check" : outcome.needsAction ? "attention" : "unknown"}>{outcome.label}</b></div>
          <h3>{item.question}</h3>
          <p>{outcome.summary}</p>
          {answer === "not_applicable" && reason && <p><strong>적용하지 않는 이유:</strong> {reason}</p>}
          {outcome.needsAction && <div className={styles.nextAction}><strong>확인해 볼 내용</strong><p>{item.helpText}</p></div>}
          <details>
            <summary>근거와 안내자료 보기</summary>
            <div className={styles.sources}>
              <p>{item.sourceNote}</p>
              {jurisdiction && <p><a href={item.sourceUrl || jurisdiction.guideUrl} target="_blank" rel="noreferrer">{item.sourceUrl ? "관련 공식 안내 열기 ↗" : `${jurisdiction.label} 공식 안내자료 열기 ↗`}</a></p>}
            </div>
          </details>
        </article>;
      })}</div>
      {results.length === 0 && <p className={styles.empty}>응답 결과가 없습니다. 앞 단계로 돌아가 답을 선택해 주세요.</p>}
      <div className={styles.controls}>
        <button type="button" className={styles.secondary} onClick={() => { setShowResult(false); setIndex(Math.max(questions.length - 1, 0)); }}>답변 돌아보기</button>
        <button type="button" className={styles.primary} onClick={reset}>새로 점검하기</button>
      </div>
      <div className={styles.advisorHandoff}>
        <div><strong>결과를 바탕으로 더 알아볼까요?</strong><p>보완이 필요한 답변을 상담 앱으로 넘기면 관련 자료와 웹 검색을 함께 확인해 준비 순서를 안내합니다. 버튼을 누르면 결과가 이 기기의 상담 앱으로 전달됩니다.</p></div>
        <button type="button" className={styles.primary} disabled={handoffBusy} onClick={() => void consultWithResult(results)}>{handoffBusy ? "상담 앱을 여는 중…" : "자가점검 결과를 토대로 AI 상담하기"}<span aria-hidden="true"> →</span></button>
        <a className={styles.appDownload} href="/public/business-advisor-download">상담 앱이 아직 없다면 내려받기 ↗</a>
        {handoffError && <p className={styles.handoffError} role="alert">{handoffError} <a href="/public/business-advisor-download">상담 앱 내려받기 ↗</a></p>}
        <p className={styles.handoffNote}>답변은 이 사이트에 저장하지 않습니다. 버튼을 누르면 선택한 지역과 보완 항목이 상담 앱으로 전달되고, 상담을 시작할 때 사용자의 ChatGPT 연결로 전송됩니다. 해당 없음의 자유 입력 사유와 준비 완료 답변은 전달하지 않습니다.</p>
      </div>
      <p className={styles.dataNote}>응답은 이 브라우저 화면에서만 계산하며 서버에 저장하지 않습니다.</p>
    </section>;
  }

  if (!started) {
    const selectedQuestions = jurisdictions.filter(({ code }) => selected.includes(code)).reduce((sum, { code }) => sum + questionFiles[code].questions.length, 0);
    return <section className={styles.flow}>
      <div className={styles.stepMeta}><span>시작 전</span><span>진출 지역 선택</span></div>
      <h2>어느 지역으로 진출을 준비하고 계신가요?</h2>
      <p className={styles.instruction}>지역마다 다른 질문을 보여드립니다. 선택한 지역이 여러 곳이면 각 지역 질문이 차례로 이어집니다.</p>
      <div className={styles.jurisdictions}>{jurisdictions.map((jurisdiction) => <label key={jurisdiction.code} className={selected.includes(jurisdiction.code) ? styles.jurisdictionSelected : ""}>
        <input type="checkbox" checked={selected.includes(jurisdiction.code)} onChange={() => toggleJurisdiction(jurisdiction.code)} />
        <span><strong>{jurisdiction.label}</strong><small>{jurisdiction.shortName} · {questionFiles[jurisdiction.code].questions.length}개 질문</small></span>
      </label>)}</div>
      <div className={styles.controls}>
        <span className={styles.selectionCount}>{selected.length}개 지역 · 질문 {selectedQuestions}개</span>
        <button type="button" className={styles.primary} disabled={!selected.length} onClick={() => { setIndex(0); setStarted(true); }}>점검 시작 <span aria-hidden="true">→</span></button>
      </div>
    </section>;
  }

  if (!question) return <section className={styles.flow}><h2>선택한 지역의 질문을 찾을 수 없습니다.</h2><button className={styles.secondary} onClick={reset}>지역 다시 선택</button></section>;
  const value = answers[question.id] ?? "";
  const currentJurisdiction = jurisdictions.find(({ code }) => code === question.jurisdiction);
  return <section className={styles.flow}>
    <div className={styles.progressTop}>
      <div><p className={styles.kicker}>해외 진출 개인정보 점검</p><span>{selected.map((code) => jurisdictions.find((item) => item.code === code)?.label ?? code).join(" · ")}</span></div>
      <button type="button" className={styles.reset} onClick={reset}>처음부터</button>
    </div>
    <div className={styles.progressTrack} aria-label={`${index + 1} / ${questions.length}`}><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <div className={styles.stepMeta}><span>{currentJurisdiction?.label} · {question.category}</span><span>{index + 1} / {questions.length}</span></div>
    <h2>{question.question}</h2>
    <p className={styles.questionPrompt}>현재 회사에서 어느 정도 준비되어 있나요?</p>
    <p className={styles.helpText}>{question.helpText}</p>
    <fieldset className={styles.options}>
      <legend>가장 가까운 답을 골라 주세요.</legend>
      {answerOptions.map((option) => <label key={option.id} className={value === option.id ? styles.optionSelected : ""}>
        <input type="radio" name={question.id} value={option.id} checked={value === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />
        <span>{option.label}</span>
      </label>)}
    </fieldset>
    {value === "not_applicable" && <label className={styles.reasonField}>해당하지 않는 이유 <span>(선택)</span><textarea value={naReasons[question.id] ?? ""} onChange={(event) => setNaReasons((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="예: 이 정보를 다루는 업무가 없습니다." /></label>}
    <div className={styles.controls}>
      <button type="button" className={styles.secondary} disabled={index === 0} onClick={() => setIndex((current) => Math.max(current - 1, 0))}>이전</button>
      {index < questions.length - 1
        ? <button type="button" className={styles.primary} disabled={!value} onClick={() => setIndex((current) => current + 1)}>다음 <span aria-hidden="true">→</span></button>
        : <button type="button" className={styles.primary} disabled={!value} onClick={() => setShowResult(true)}>결과 보기</button>}
    </div>
    <p className={styles.dataNote}>잘 모르겠으면 ‘잘 모르겠어요’를 골라 주세요. 이 답변 하나만으로 위반이라고 판단하지 않습니다.</p>
  </section>;
}
