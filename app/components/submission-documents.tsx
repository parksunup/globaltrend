"use client";

import { useMemo, useState } from "react";
import type { LegalComparisonCell, SubmissionDocuments } from "../../lib/submission-preview";
import SubmissionFeedback from "./submission-feedback";

const jurisdictions = ["KR", "JP", "CN", "EU", "GB", "US-CA", "SG"];

function LegalDocument({ cells, branch, commitSha }: { cells: LegalComparisonCell[]; branch?: string; commitSha?: string }) {
  const criteria = useMemo(() => Array.from(new Map(cells.map((cell) => [cell.criterionId, { id: cell.criterionId, name: cell.criterionName, order: cell.criterionOrder }])).values()).sort((a, b) => a.order - b.order), [cells]);
  const [selectedId, setSelectedId] = useState(cells.find((cell) => cell.jurisdiction === "KR")?.id ?? cells[0]?.id ?? "");
  const selected = cells.find((cell) => cell.id === selectedId) ?? cells[0];
  const lookup = new Map(cells.map((cell) => [`${cell.criterionId}:${cell.jurisdiction}`, cell]));
  return <>
    <div className="document-heading"><span className="panel-kicker">LEGAL COMPARISON · DRAFT</span><h2>개인정보 보호법 비교표</h2><p>17개 기준 × 7개 법제. 한국·일본 작성 셀도 사람 검수 전 초안입니다. ‘미검토’는 규정이 없다는 뜻이 아닙니다.</p></div>
    <div className="comparison-scroll"><table className="comparison-table"><thead><tr><th scope="col">비교 기준</th>{jurisdictions.map((code) => <th scope="col" key={code}>{code}</th>)}</tr></thead><tbody>
      {criteria.map((criterion) => <tr key={criterion.id}><th scope="row">{criterion.order}. {criterion.name}</th>{jurisdictions.map((code) => {
        const cell = lookup.get(`${criterion.id}:${code}`);
        const drafted = cell && cell.summary !== "미검토";
        return <td key={code}>{cell ? <button type="button" className={`comparison-cell ${selected?.id === cell.id ? "selected" : ""}`} onClick={() => setSelectedId(cell.id)}><span>{drafted ? cell.summary : "미검토"}</span><small>{drafted ? cell.articleNumbers.slice(0, 2).join(" · ") : "추가 조사 필요"}</small></button> : "—"}</td>;
      })}</tr>)}
    </tbody></table></div>
    {selected && <article className="document-detail"><span className="panel-kicker">선택한 비교 셀 · {selected.jurisdiction} · {selected.status}</span><h3>{selected.criterionName}</h3><p className="document-lede">{selected.summary}</p>
      {selected.articleNumbers.length > 0 && <div className="detail-block"><span className="detail-label">관련 조항</span><p>{selected.articleNumbers.join(" · ")}</p></div>}
      {selected.exceptions && selected.exceptions !== "미검토" && <div className="detail-block"><span className="detail-label">주요 예외·주의</span><p>{selected.exceptions}</p></div>}
      <div className="detail-block"><span className="detail-label">판본</span><p>{selected.sourceVersion}</p></div>
      {selected.sourceUrl && <div className="detail-block"><span className="detail-label">공식 원문</span><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">공식 사이트에서 보기 ↗</a></div>}
      {selected.pendingReason && <div className="detail-block"><span className="detail-label">검수 필요 사항</span><p>{selected.pendingReason}</p></div>}
      <SubmissionFeedback key={selected.id} itemId={selected.id} branch={branch} commitSha={commitSha} />
    </article>}
  </>;
}

function WeeklyDocument({ document, branch, commitSha }: { document: NonNullable<SubmissionDocuments["weekly"]>; branch?: string; commitSha?: string }) {
  const [selectedId, setSelectedId] = useState(document.entries[0]?.id ?? "");
  const selected = document.entries.find((entry) => entry.id === selectedId) ?? document.entries[0];
  return <>
    <div className="document-heading"><span className="panel-kicker">WEEKLY TRENDS · EXAMPLE</span><h2>{document.title}</h2><p>{document.notice}</p></div>
    <div className="weekly-layout"><nav className="weekly-toc" aria-label="예시 호 목차"><h3>목차</h3>{document.entries.map((entry, index) => <button type="button" key={entry.id} className={selected?.id === entry.id ? "selected" : ""} onClick={() => setSelectedId(entry.id)}><small>{String(index + 1).padStart(2, "0")} · {entry.category}</small><strong>{entry.title}</strong><span>{entry.organization} · {entry.publishedDate}</span></button>)}</nav>
      {selected && <article className="weekly-article"><span className="panel-kicker">{selected.category} · {selected.publishedDate}</span><h3>{selected.title}</h3><p className="document-original">{selected.originalTitle}</p><p className="document-byline">{selected.organization}</p>
        <div className="detail-block"><span className="detail-label">사실 요약</span><p>{selected.facts}</p></div>
        {selected.keyPoints.length > 0 && <div className="detail-block"><span className="detail-label">주요 내용</span><ul>{selected.keyPoints.map((point, index) => <li key={index}>{point}</li>)}</ul></div>}
        <div className="detail-block"><span className="detail-label">개인정보 보호상 의미 · 편집 의견</span><p>{selected.significance}</p></div>
        {selected.officialUrl && <div className="detail-block"><span className="detail-label">공식 근거</span><a href={selected.officialUrl} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a></div>}
        <div className="detail-block"><span className="detail-label">사람이 확인할 부분</span><ul>{selected.requiredChecks.map((check, index) => <li key={index}>{check}</li>)}</ul></div>
        <SubmissionFeedback key={selected.id} itemId={selected.id} branch={branch} commitSha={commitSha} />
      </article>}
    </div>
  </>;
}

export default function SubmissionDocumentsView({ documents, branch, commitSha }: { documents: SubmissionDocuments; branch?: string; commitSha?: string }) {
  const [kind, setKind] = useState<"legal" | "weekly">(documents.legal.length ? "legal" : "weekly");
  if (!documents.legal.length && !documents.weekly) return null;
  return <>
    {documents.legal.length > 0 && documents.weekly && <div className="document-tabs" role="group" aria-label="문서 선택">
      <button type="button" className={kind === "legal" ? "selected" : ""} onClick={() => setKind("legal")}>법제 비교표</button>
      <button type="button" className={kind === "weekly" ? "selected" : ""} onClick={() => setKind("weekly")}>주간 동향 예시 호</button>
    </div>}
    {kind === "legal" && documents.legal.length > 0 ? <LegalDocument cells={documents.legal} branch={branch} commitSha={commitSha} /> : documents.weekly ? <WeeklyDocument document={documents.weekly} branch={branch} commitSha={commitSha} /> : null}
  </>;
}
