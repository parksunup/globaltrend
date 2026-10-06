"use client";

import { useMemo, useState } from "react";
import type { SubmissionItem } from "../../lib/submission-preview";

const groupLabels = { all: "전체", legal: "법제 담당", trends: "동향 담당" } as const;
const statusLabels: Record<string, string> = {
  blocked: "확인 대기", unreviewed: "사람 검수 전", draft: "초안", withheld: "공개 보류", error: "파일 오류",
  verified: "확인됨", reviewed: "검수됨", published: "공개",
};

export default function SubmissionPreview({ items, commitSha }: { items: SubmissionItem[]; commitSha?: string }) {
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
      <div><p className="eyebrow">WORKSPACE / PR PREVIEW</p><h1>PR 제출물 확인</h1></div>
      <div className="topbar-note">이 배포 브랜치의 파일 · 읽기 전용</div>
    </header>
    <div className="submission-notice">
      <strong>팀원이 제출한 결과를 확인하는 화면입니다.</strong>
      <span>표시된 내용은 검수·승인·DB 입력·실제 발행을 뜻하지 않습니다. 원문 링크와 검토 필요 상태를 확인해 주세요.</span>
    </div>
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
          {visible.length === 0 && <div className="empty">이 브랜치에 해당 제출물이 없습니다. 파일이 PR에 커밋됐는지 확인해 주세요.</div>}
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
          <p className="publish-warning">이 화면에서는 검수 상태를 변경하거나 자료를 공개하지 않습니다.</p>
        </> : <div className="empty detail-empty">이 브랜치에 표시할 제출물이 없습니다.</div>}
      </aside>
    </div>
  </>;
}
