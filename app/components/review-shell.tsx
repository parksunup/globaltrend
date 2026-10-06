"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { kindLabels, statusLabels, type ReviewItem, type ReviewKind, type ReviewStatus } from "../sample-data";
import { updateReviewState } from "../team/actions";
import SubmissionPreview from "./submission-preview";
import type { SubmissionItem } from "../../lib/submission-preview";

const kinds: ReviewKind[] = ["sources", "laws", "criteria"];
const statuses: Array<ReviewStatus | "all"> = ["all", "unreviewed", "in_review", "approved", "rejected", "published"];

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={"status status-" + status}>{statusLabels[status]}</span>;
}

export default function ReviewShell({ initialItems, dataSource, teamMode = false, canReview = false, teamRole, submissions = [], submissionCommitSha }: { initialItems: ReviewItem[]; dataSource: "supabase" | "sample"; teamMode?: boolean; canReview?: boolean; teamRole?: string; submissions?: SubmissionItem[]; submissionCommitSha?: string }) {
  const [reviewItems, setReviewItems] = useState(initialItems);
  const [showSubmissions, setShowSubmissions] = useState(submissions.length > 0);
  const [kind, setKind] = useState<ReviewKind>("sources");
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("edpb");
  const [reviewNote, setReviewNote] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const items = useMemo(() => reviewItems.filter((item) => {
    const matchesKind = item.kind === kind;
    const matchesStatus = status === "all" || item.status === status;
    const haystack = [item.title, item.subtitle, item.description, ...item.metadata].join(" ").toLowerCase();
    return matchesKind && matchesStatus && haystack.includes(query.toLowerCase());
  }), [kind, query, reviewItems, status]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    setReviewNote(selected?.reviewNote ?? "");
    setFeedback(null);
  }, [selected?.id]);

  function selectKind(nextKind: ReviewKind) {
    setShowSubmissions(false);
    setKind(nextKind);
    setStatus("all");
    setQuery("");
    const first = reviewItems.find((item) => item.kind === nextKind);
    setSelectedId(first?.id ?? "");
  }

  function saveReview(nextStatus: "in_review" | "approved" | "rejected") {
    if (!selected || !canReview) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await updateReviewState({ kind: selected.kind, id: selected.id, status: nextStatus, note: reviewNote });
      if (!result.ok || !result.status) {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      setReviewItems((current) => current.map((item) => item.id === selected.id && item.kind === selected.kind
        ? { ...item, status: result.status!, reviewNote: result.note || undefined, reviewedAt: result.reviewedAt }
        : item));
      setFeedback({ kind: "success", message: result.message });
    });
  }

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <div className="brand-mark">GT</div>
        <div className="brand-copy"><strong>GlobalTrend</strong><span>검토 보드</span></div>
        <div className="preview-pill">{teamMode ? `TEAM · ${teamRole ?? "검수"}` : dataSource === "supabase" ? "SUPABASE · 읽기 전용" : "PREVIEW · 샘플 데이터"}</div>
        <nav className="nav-list" aria-label="자료 유형">
          {submissions.length > 0 && <button className={"nav-item " + (showSubmissions ? "active" : "")} onClick={() => setShowSubmissions(true)}>
            <span>PR 제출물</span><em>{submissions.length}</em>
          </button>}
          {kinds.map((itemKind) => (
            <button className={"nav-item " + (!showSubmissions && kind === itemKind ? "active" : "")} key={itemKind} onClick={() => selectKind(itemKind)}>
              <span>{kindLabels[itemKind]}</span>
              <em>{initialItems.filter((item) => item.kind === itemKind).length}</em>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot" /> 실제 공개 전 검수 전용
          <a className="guide-link" href="/guide">팀 가이드</a>
          <a className="guide-link" href={teamMode ? "/" : "/team"}>{teamMode ? "공개 보드" : "팀 검수 로그인"}</a>
        </div>
      </aside>

      <section className="content">
        {showSubmissions ? <SubmissionPreview items={submissions} commitSha={submissionCommitSha} /> : <>
        <header className="topbar">
          <div><p className="eyebrow">WORKSPACE / REVIEW</p><h1>{kindLabels[kind]}</h1></div>
          <div className="topbar-note"><span className="lock">◈</span> {teamMode ? "팀 검수 단계" : "공개 전 단계"} <b>{teamMode ? "로그인됨" : "읽기 전용"}</b></div>
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
              <div className="detail-block"><span className="detail-label">검토 안내</span><p>{selected.note}</p></div>
              <div className="detail-block"><span className="detail-label">공식 원문</span>{selected.url ? <a href={selected.url} target="_blank" rel="noreferrer">{selected.url}<span>↗</span></a> : <p>기준표 내부 항목</p>}</div>
              <div className="detail-block"><span className="detail-label">공개 조건</span><p>{selected.status === "published" ? "검수 완료 · 공개 가능" : "사람 검수와 승인 후 공개"}</p></div>
              {teamMode && canReview ? <div className="review-form">
                <label htmlFor="review-note">검수 메모 <span>{reviewNote.length}/2000</span></label>
                <textarea id="review-note" maxLength={2000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="확인한 근거와 추가로 볼 부분을 적어 주세요. 반려할 때는 이유가 필수입니다." disabled={isPending || selected.status === "published"} />
                {selected.reviewedAt && <p className="reviewed-at">마지막 저장: {new Date(selected.reviewedAt).toLocaleString("ko-KR")}</p>}
                {feedback && <p className={`action-feedback ${feedback.kind}`} aria-live="polite">{feedback.message}</p>}
                <div className="review-actions">
                  <button type="button" className="review-start" onClick={() => saveReview("in_review")} disabled={isPending || selected.status === "published"}>검수 시작</button>
                  <button type="button" className="review-reject" onClick={() => saveReview("rejected")} disabled={isPending || selected.status === "published" || !reviewNote.trim()}>반려</button>
                  <button type="button" className="review-approve" onClick={() => saveReview("approved")} disabled={isPending || selected.status === "published"}>승인</button>
                </div>
                <p className="publish-warning">승인은 검수 결과만 저장합니다. 공개 상태로 자동 변경하지 않습니다.</p>
              </div> : <button className="disabled-action" disabled>검수 상태를 변경할 권한이 없습니다</button>}
            </> : <div className="empty detail-empty">목록에서 항목을 선택해 주세요.</div>}
          </aside>
        </div>
        </>}
      </section>
    </main>
  );
}
