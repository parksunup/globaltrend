"use client";

import { useMemo, useState } from "react";
import { kindLabels, statusLabels, type ReviewItem, type ReviewKind, type ReviewStatus } from "../sample-data";

const kinds: ReviewKind[] = ["sources", "laws", "criteria"];
const statuses: Array<ReviewStatus | "all"> = ["all", "unreviewed", "in_review", "approved", "published"];

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={"status status-" + status}>{statusLabels[status]}</span>;
}

export default function ReviewShell({ initialItems, dataSource }: { initialItems: ReviewItem[]; dataSource: "supabase" | "sample" }) {
  const [kind, setKind] = useState<ReviewKind>("sources");
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("edpb");

  const items = useMemo(() => initialItems.filter((item) => {
    const matchesKind = item.kind === kind;
    const matchesStatus = status === "all" || item.status === status;
    const haystack = [item.title, item.subtitle, item.description, ...item.metadata].join(" ").toLowerCase();
    return matchesKind && matchesStatus && haystack.includes(query.toLowerCase());
  }), [kind, query, status]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  function selectKind(nextKind: ReviewKind) {
    setKind(nextKind);
    setStatus("all");
    setQuery("");
    const first = initialItems.find((item) => item.kind === nextKind);
    setSelectedId(first?.id ?? "");
  }

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <div className="brand-mark">GT</div>
        <div className="brand-copy"><strong>GlobalTrend</strong><span>검토 보드</span></div>
        <div className="preview-pill">{dataSource === "supabase" ? "SUPABASE · 읽기 전용" : "PREVIEW · 샘플 데이터"}</div>
        <nav className="nav-list" aria-label="자료 유형">
          {kinds.map((itemKind) => (
            <button className={"nav-item " + (kind === itemKind ? "active" : "")} key={itemKind} onClick={() => selectKind(itemKind)}>
              <span>{kindLabels[itemKind]}</span>
              <em>{initialItems.filter((item) => item.kind === itemKind).length}</em>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot" /> 실제 공개 전 검수 전용
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">WORKSPACE / REVIEW</p><h1>{kindLabels[kind]}</h1></div>
          <div className="topbar-note"><span className="lock">◈</span> 팀 검수 단계 <b>읽기 전용</b></div>
        </header>
        <div className="toolbar">
          <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="항목명, 설명, 국가로 검색" /></label>
          <div className="filter-group" role="group" aria-label="상태 필터">
            {statuses.map((itemStatus) => <button key={itemStatus} className={status === itemStatus ? "selected" : ""} onClick={() => setStatus(itemStatus)}>{statusLabels[itemStatus]}</button>)}
          </div>
        </div>

        <div className="workspace-grid">
          <section className="list-panel">
            <div className="panel-heading"><div><span className="panel-kicker">REVIEW QUEUE</span><h2>{items.length}개 항목</h2></div><span className="muted">업데이트 대기</span></div>
            <div className="item-list">
              {items.map((item) => <button key={item.id} className={"item-card " + (selected?.id === item.id ? "selected" : "")} onClick={() => setSelectedId(item.id)}>
                <div className="item-card-head"><StatusBadge status={item.status} /><span className="item-type">{item.subtitle}</span></div>
                <strong>{item.title}</strong><p>{item.description}</p><div className="chips">{item.metadata.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </button>)}
              {items.length === 0 && <div className="empty">조건에 맞는 항목이 없습니다.</div>}
            </div>
          </section>

          <aside className="detail-panel">
            {selected ? <><div className="detail-top"><span className="panel-kicker">SELECTED ITEM</span><StatusBadge status={selected.status} /></div><h2>{selected.title}</h2><p className="detail-subtitle">{selected.subtitle}</p><p className="detail-description">{selected.description}</p>
              <div className="detail-block"><span className="detail-label">검토 메모</span><p>{selected.note}</p></div>
              <div className="detail-block"><span className="detail-label">공식 원문</span>{selected.url ? <a href={selected.url} target="_blank" rel="noreferrer">{selected.url}<span>↗</span></a> : <p>기준표 내부 항목</p>}</div>
              <div className="detail-block"><span className="detail-label">공개 조건</span><p>{selected.status === "published" ? "검수 완료 · 공개 가능" : "사람 검수와 승인 후 공개"}</p></div>
              <button className="disabled-action" disabled>검수 상태 변경 · 다음 단계에서 연결</button>
            </> : <div className="empty detail-empty">목록에서 항목을 선택해 주세요.</div>}
          </aside>
        </div>
      </section>
    </main>
  );
}