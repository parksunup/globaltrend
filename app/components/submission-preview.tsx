"use client";

import { useMemo, useState } from "react";
import type { SubmissionDocuments, SubmissionItem } from "../../lib/submission-preview";
import SubmissionDocumentsView from "./submission-documents";
import SubmissionFeedback from "./submission-feedback";

const groupLabels = { all: "전체", legal: "법제 담당", trends: "동향 담당" } as const;
const statusLabels: Record<string, string> = {
  blocked: "확인 대기", unreviewed: "사람 검수 전", draft: "초안", withheld: "공개 보류", error: "파일 오류",
  verified: "확인됨", reviewed: "검수됨", published: "공개",
};

export default function SubmissionPreview({ items, documents, branch, commitSha }: { items: SubmissionItem[]; documents: SubmissionDocuments; branch?: string; commitSha?: string }) {
  const hasDocument = documents.legal.length > 0 || Boolean(documents.weekly);
  const [showDocument, setShowDocument] = useState(hasDocument);
  const [group, setGroup] = useState<"all" | "legal" | "trends">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const visible = useMemo(() => items.filter((item) =>
    (group === "all" || item.group === group) &&
    [item.title, item.subtitle, item.summary, item.kind].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [group, items, query]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const safeSha = commitSha && /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null;

  return <>
    <header className="topbar">
      <div><p className="eyebrow">WORKSPACE / PR PREVIEW</p><h1>제출물 검수</h1></div>
      <div className="topbar-note">이 배포 브랜치의 파일 · 검수 전 초안</div>
    </header>
    <div className="submission-notice">
      <strong>제출 자료를 결과물에 가까운 형태로 읽어 보세요.</strong>
      <span>표시된 초안과 피드백은 승인·실제 발행을 뜻하지 않습니다. 누구나 로그인 없이 의견을 남길 수 있으며, 저장된 의견은 이 공개 화면에 표시되지 않습니다.</span>
    </div>
    <div className="document-tabs" role="group" aria-label="검수 화면 선택">
      {hasDocument && <button type="button" className={showDocument ? "selected" : ""} onClick={() => setShowDocument(true)}>{documents.legal.length ? "17개 기준 비교표" : "주간 동향 예시 호"}</button>}
      <button type="button" className={!showDocument ? "selected" : ""} onClick={() => setShowDocument(false)}>제출 자료 목록</button>
    </div>
    {showDocument && hasDocument ? <SubmissionDocumentsView documents={documents} branch={branch} commitSha={commitSha} /> : <>
    <div className="toolbar">
      <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·기관·자료 유형 검색" /></label>
      <div className="filter-group" role="group" aria-label="담당자 필터">
        {(Object.keys(groupLabels) as Array<keyof typeof groupLabels>).map((value) =>
          <button key={value} className={group === value ? "selected" : ""} onClick={() => { setGroup(value); setSelectedId(""); }}>{groupLabels[value]}</button>)}
      </div>
    </div>
    <div className="workspace-grid">
      <section className="list-panel">
        <div className="panel-heading"><div><span className="panel-kicker">COMMITTED FILES</span><h2>{visible.length}개 항목</h2></div><span className="muted">현재 Preview 기준</span></div>
        <div className="item-list">
          {visible.map((item) => <button key={item.id} className={`item-card ${selected?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
            <div className="item-card-head"><span className={`submission-status ${item.status === "error" ? "submission-error" : ""}`}>{statusLabels[item.status] ?? item.status}</span><span className="item-type">{item.kind}</span></div>
            <strong>{item.title}</strong><p>{item.summary}</p><div className="chips"><span>{groupLabels[item.group]}</span><span>{item.subtitle}</span></div>
          </button>)}
          {visible.length === 0 && <div className="empty">{items.length === 0 ? "이 브랜치에는 법제·동향 제출 파일이 없습니다. PR #17은 화면 코드만 담고 있으며, 팀원 PR의 자료는 해당 브랜치가 최신 main을 반영한 뒤 그 Preview에서 확인할 수 있습니다." : "현재 검색·담당자 조건에 맞는 제출물이 없습니다."}</div>}
        </div>
      </section>
      <aside className="detail-panel submission-detail">
        {selected ? <>
          <div className="detail-top"><span className="panel-kicker">SUBMITTED ITEM</span><span className={`submission-status ${selected.status === "error" ? "submission-error" : ""}`}>{statusLabels[selected.status] ?? selected.status}</span></div>
          <h2>{selected.title}</h2><p className="detail-subtitle">{selected.kind} · {selected.subtitle}</p>
          <p className="detail-description">{selected.summary}</p>
          {selected.fields.map((field) => <div className="detail-block" key={field.label}><span className="detail-label">{field.label}</span><p className="submission-multiline">{field.value}</p></div>)}
          {selected.links.length > 0 && <div className="detail-block"><span className="detail-label">공식 근거</span>{selected.links.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}: {link.url}<span>↗</span></a>)}</div>}
          <div className="detail-block"><span className="detail-label">제출 파일</span>{selected.files.map((file) => safeSha
            ? <a key={file} href={`https://github.com/parksunup/globaltrend/blob/${safeSha}/${file}`} target="_blank" rel="noopener noreferrer">{file}<span>↗</span></a>
            : <p key={file}>{file}</p>)}</div>
          <SubmissionFeedback key={selected.id} itemId={selected.id} branch={branch} commitSha={commitSha} />
        </> : <div className="empty detail-empty">{items.length === 0 ? "제출 자료가 있는 팀원 브랜치의 Preview에서 실제 내용을 확인해 주세요." : "조건에 맞는 제출물이 없습니다."}</div>}
      </aside>
    </div>
    </>}
  </>;
}
