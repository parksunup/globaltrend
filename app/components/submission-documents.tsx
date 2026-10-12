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
    <div className="document-heading"><span className="panel-kicker">LEGAL COMPARISON · DRAFT</span><h2>개인정보 보호법 비교표</h2><p>17개 기준 × 7개 법제. 한국·일본 작성 셀도 사람 검수 전 초안입니다. ‘미검토’는 규정이 없다는 뜻이 아닙니다.</p><p><a href="/legal-translation">법률별 전체 번역 초안 읽고 조문별 피드백 남기기 →</a></p></div>
    <div className="comparison-scroll"><table className="comparison-table"><thead><tr><th scope="col">비교 기준</th>{jurisdictions.map((code) => <th scope="col" key={code}>{code}</th>)}</tr></thead><tbody>
      {criteria.map((criterion) => <tr key={criterion.id}><th scope="row">{criterion.order}. {criterion.name}</th>{jurisdictions.map((code) => {
        const cell = lookup.get(`${criterion.id}:${code}`);
        const drafted = cell && cell.summary !== "미검토";
        return <td key={code}>{cell ? <button type="button" className={`comparison-cell ${selected?.id === cell.id ? "selected" : ""}`} onClick={() => { setSelectedId(cell.id); document.getElementById("comparison-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span>{drafted ? cell.summary : "미검토"}</span><small>{drafted ? cell.articleNumbers.slice(0, 2).join(" · ") : "추가 조사 필요"}</small></button> : "—"}</td>;
      })}</tr>)}
    </tbody></table></div>
    {selected && <article id="comparison-detail" className="document-detail"><span className="panel-kicker">선택한 비교 셀 · {selected.jurisdiction} · {selected.status}</span><h3>{selected.criterionName}</h3><p className="document-lede">{selected.summary}</p>
      {selected.articleNumbers.length > 0 && <div className="detail-block"><span className="detail-label">관련 조항</span><p>{selected.articleNumbers.join(" · ")}</p></div>}
      {selected.translationLinks.length > 0 && <div className="detail-block"><span className="detail-label">조문·번역 근거</span>{selected.translationLinks.map((link) => {
        const safeSha = commitSha && /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null;
        const [path, anchor] = link.slice(2).split("#");
        const url = safeSha ? `https://github.com/parksunup/globaltrend/blob/${safeSha}/data/legal/${path}${anchor ? `#${anchor}` : ""}` : null;
        return url ? <a key={link} href={url} target="_blank" rel="noopener noreferrer">{path}{anchor ? ` · ${anchor}` : ""} ↗</a> : <p key={link}>{path}{anchor ? ` · ${anchor}` : ""}</p>;
      })}</div>}
      {selected.exceptions && selected.exceptions !== "미검토" && <div className="detail-block"><span className="detail-label">주요 예외·주의</span><p>{selected.exceptions}</p></div>}
      <div className="detail-block"><span className="detail-label">판본</span><p>{selected.sourceVersion}</p></div>
      {selected.sourceUrl && <div className="detail-block"><span className="detail-label">공식 원문</span><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">공식 사이트에서 보기 ↗</a></div>}
      {selected.pendingReason && <div className="detail-block"><span className="detail-label">검수 필요 사항</span><p>{selected.pendingReason}</p></div>}
      <SubmissionFeedback key={selected.id} itemId={selected.id} branch={branch} commitSha={commitSha} />
    </article>}
  </>;
}

export default function SubmissionDocumentsView({ documents, branch, commitSha }: { documents: SubmissionDocuments; branch?: string; commitSha?: string }) {
  if (!documents.legal.length) return null;
  return <LegalDocument cells={documents.legal} branch={branch} commitSha={commitSha} />;
}
