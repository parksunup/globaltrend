"use client";

import { useMemo, useState } from "react";
import type { LegalComparisonCell, SubmissionDocuments } from "../../lib/submission-preview";
import SubmissionFeedback from "./submission-feedback";

const jurisdictions = ["KR", "JP", "CN", "EU", "GB", "US-CA", "SG"];
const evidenceLabels: Record<string, string> = {
  prior_evidence_unchanged: "기존 조문 대조 초안",
  selected_official_statute: "선택 공식 법령 대조 초안",
  selected_official_statute_and_supplementary_law: "선택 법령·후속 법령 대조 초안",
  official_guidance: "공식 지침 근거 초안 · 법령 전문 대조 필요",
  official_legislative_summary_and_regulator_guidance: "공식 입법 요약·규제기관 지침 근거 초안 · 법령 전문 대조 필요",
  official_summary_and_secondary_statute: "공식 채택 요약·비공식 법문 재게시본 대조 초안 · 공식 현행 조문 확인 필요",
};

function sourceLabel(url: string) {
  const host = new URL(url).hostname;
  return host === "legiscan.com" || host === "law.justia.com" ? "법문 재게시 자료" : "공식 근거";
}

function LegalDocument({ cells, branch, commitSha }: { cells: LegalComparisonCell[]; branch?: string; commitSha?: string }) {
  const criteria = useMemo(() => Array.from(new Map(cells.map((cell) => [cell.criterionId, { id: cell.criterionId, name: cell.criterionName, order: cell.criterionOrder }])).values()).sort((a, b) => a.order - b.order), [cells]);
  const [selectedId, setSelectedId] = useState(cells.find((cell) => cell.jurisdiction === "KR")?.id ?? cells[0]?.id ?? "");
  const selected = cells.find((cell) => cell.id === selectedId) ?? cells[0];
  const selectedSources = selected ? [...new Set([selected.sourceUrl, ...(selected.sourceLinks ?? [])].filter(Boolean))] : [];
  const lookup = new Map(cells.map((cell) => [`${cell.criterionId}:${cell.jurisdiction}`, cell]));
  return <>
    <div className="document-heading"><span className="panel-kicker">LEGAL COMPARISON</span><h2>개인정보 보호법 비교표</h2><p>17개 기준 × 7개 법제 · {cells.length}셀. 각 셀은 운영 기록과 대조한 발행 상태를 표시합니다. 판본·근거·예외도 함께 확인할 수 있습니다. ‘미검토’는 규정이 없다는 뜻이 아닙니다.</p><p><a href="/legal-translation">법률별 전체 번역과 조문별 의견 보기 →</a></p></div>
    <div className="comparison-scroll"><table className="comparison-table"><thead><tr><th scope="col">비교 기준</th>{jurisdictions.map((code) => <th scope="col" key={code}>{code}</th>)}</tr></thead><tbody>
      {criteria.map((criterion) => <tr key={criterion.id}><th scope="row">{criterion.order}. {criterion.name}</th>{jurisdictions.map((code) => {
        const cell = lookup.get(`${criterion.id}:${code}`);
        const drafted = cell && cell.summary !== "미검토";
        return <td key={code}>{cell ? <button type="button" className={`comparison-cell ${selected?.id === cell.id ? "selected" : ""}`} onClick={() => { setSelectedId(cell.id); document.getElementById("comparison-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span>{drafted ? cell.summary : "미검토"}</span><small>{drafted ? cell.articleNumbers.slice(0, 2).join(" · ") : "추가 조사 필요"}</small></button> : "—"}</td>;
      })}</tr>)}
    </tbody></table></div>
    {selected && <article id="comparison-detail" className="document-detail"><span className="panel-kicker">선택한 비교 셀 · {selected.jurisdiction} · {selected.status === "published" ? "검수 완료·발행됨" : selected.status === "unreviewed" ? "미발행 · 제출 자료" : selected.status}</span><h3>{selected.criterionName}</h3><p className="document-lede">{selected.summary}</p>
      {selected.evidenceKind && <div className="detail-block"><span className="detail-label">근거 확인 범위</span><p>{evidenceLabels[selected.evidenceKind] ?? selected.evidenceKind}</p></div>}
      {selected.articleNumbers.length > 0 && <div className="detail-block"><span className="detail-label">관련 조항</span><p>{selected.articleNumbers.join(" · ")}</p></div>}
      {selected.translationLinks.length > 0 && <div className="detail-block"><span className="detail-label">조문·번역 근거</span>{selected.translationLinks.map((link) => {
        if (link.startsWith("/review-drafts/gdpr.html#")) return <a key={link} href={`/legal-translation/gdpr#${link.split("#")[1]}`}>GDPR 번역 · {link.split("#")[1]} →</a>;
        const translation = /^\.\/translations\/([a-z0-9-]+)\.md#([A-Za-z0-9-]+)$/.exec(link);
        if (translation) return <a key={link} href={`/legal-translation/${translation[1]}#${translation[2]}`}>전문 번역 · {translation[2]} →</a>;
        const safeSha = commitSha && /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null;
        const [path, anchor] = link.slice(2).split("#");
        const url = safeSha ? `https://github.com/parksunup/globaltrend/blob/${safeSha}/data/legal/${path}${anchor ? `#${anchor}` : ""}` : null;
        return url ? <a key={link} href={url} target="_blank" rel="noopener noreferrer">{path}{anchor ? ` · ${anchor}` : ""} ↗</a> : <p key={link}>{path}{anchor ? ` · ${anchor}` : ""}</p>;
      })}</div>}
      {selected.exceptions && selected.exceptions !== "미검토" && <div className="detail-block"><span className="detail-label">주요 예외·주의</span><p>{selected.exceptions}</p></div>}
      <div className="detail-block"><span className="detail-label">판본</span><p>{selected.sourceVersion}</p></div>
      {selectedSources.length > 0 && <div className="detail-block"><span className="detail-label">근거 자료</span>{selectedSources.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{sourceLabel(url)} {index + 1} ↗</a>)}</div>}
      {selected.pendingReason && (selected.status === "published"
        ? <details className="detail-block"><summary>작성 당시 검토 기록</summary><p>제출 당시의 확인 메모입니다. 미착수·초안 등의 표현은 당시 기록이며, 현재 이 판본은 검수 완료·발행된 상태입니다.</p><p>{selected.pendingReason}</p></details>
        : <div className="detail-block"><span className="detail-label">추가 확인 기록</span><p>{selected.pendingReason}</p></div>)}
      <SubmissionFeedback key={selected.id} itemId={selected.id} branch={branch} commitSha={commitSha} />
    </article>}
  </>;
}

export default function SubmissionDocumentsView({ documents, branch, commitSha }: { documents: SubmissionDocuments; branch?: string; commitSha?: string }) {
  if (!documents.legal.length) return null;
  return <LegalDocument cells={documents.legal} branch={branch} commitSha={commitSha} />;
}
