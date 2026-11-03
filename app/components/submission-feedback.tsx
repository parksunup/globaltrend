"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { FeedbackPage, PublicFeedback } from "../../lib/public-feedback";
import FeedbackList from "./feedback-list";
import styles from "./feedback.module.css";

export default function SubmissionFeedback({ itemId, branch, commitSha }: { itemId: string; branch?: string; commitSha?: string }) {
  const fieldId = useId();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [draftCommitSha, setDraftCommitSha] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<PublicFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const requestNumber = useRef(0);
  const branchReady = Boolean(branch && /^[A-Za-z0-9._/-]{1,160}$/.test(branch));
  const ready = Boolean(branchReady && commitSha && /^[a-f0-9]{40}$/i.test(commitSha));
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const allParams = new URLSearchParams({ branch: branch ?? "" });
  const itemParams = new URLSearchParams({ branch: branch ?? "", item: itemId });

  useEffect(() => {
    setBody(""); setDraftCommitSha(undefined); setMessage(""); setFeedback([]); setNextOffset(null);
  }, [branch, itemId]);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestNumber.current;
    setFeedback([]); setNextOffset(null); setReadError("");
    if (!branchReady || !configured) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    async function read() {
      try {
        const params = new URLSearchParams({ branch: branch!, item: itemId });
        const response = await fetch(`/api/feedback?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("read failed");
        const result = await response.json() as FeedbackPage;
        if (sequence === requestNumber.current) { setFeedback(result.feedback); setNextOffset(result.nextOffset); }
      } catch {
        if (!controller.signal.aborted && sequence === requestNumber.current) setReadError("저장된 의견을 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.");
      } finally { if (!controller.signal.aborted && sequence === requestNumber.current) setLoading(false); }
    }
    void read();
    return () => controller.abort();
  }, [branch, itemId, branchReady, configured, refresh]);

  async function loadMore() {
    if (nextOffset === null || loading) return;
    const sequence = requestNumber.current;
    setLoading(true); setReadError("");
    try {
      const params = new URLSearchParams({ branch: branch!, item: itemId, offset: String(nextOffset) });
      const response = await fetch(`/api/feedback?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("read failed");
      const result = await response.json() as FeedbackPage;
      if (sequence === requestNumber.current) { setFeedback((previous) => [...previous, ...result.feedback]); setNextOffset(result.nextOffset); }
    } catch { if (sequence === requestNumber.current) setReadError("저장된 의견을 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요."); }
    finally { if (sequence === requestNumber.current) setLoading(false); }
  }

  async function save() {
    const trimmed = body.trim();
    const authorName = name.trim() || "익명";
    if (!ready || !configured || busy || !trimmed || trimmed.length > 4000 || authorName.length > 80) return;
    const sequence = requestNumber.current;
    setBusy(true); setMessage("");
    try {
      const { error } = await createClient().from("submission_feedback").insert({
        branch_name: branch!, item_id: itemId, commit_sha: (draftCommitSha ?? commitSha)!.toLowerCase(), author_name: authorName, body: trimmed,
      });
      if (error) throw error;
      if (sequence === requestNumber.current) { setBody(""); setDraftCommitSha(undefined); setMessage("피드백을 저장했습니다. 아래 목록을 다시 불러옵니다."); setRefresh((value) => value + 1); }
    } catch { if (sequence === requestNumber.current) setMessage("저장하지 못했습니다. 입력 내용은 남겨 두었습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return <section className="feedback-panel" aria-label="항목 피드백">
    <h3>이 항목에 의견 남기기</h3>
    <p>로그인 없이 의견을 남길 수 있으며, 저장된 의견은 누구나 볼 수 있습니다. 비밀이나 개인정보는 적지 마세요. 이름은 본인 확인을 거친 이름이 아닙니다.</p>
    {!ready && <p className="feedback-warning">의견 작성은 작업 브랜치와 버전 정보가 있는 Preview에서 사용할 수 있습니다.</p>}
    {!configured && <p className="feedback-warning">피드백 연결 설정이 없어 의견을 저장하거나 불러올 수 없습니다.</p>}
    {ready && configured && <>
      <label htmlFor={`${fieldId}-name`}>이름 또는 별칭 (선택)</label>
      <input id={`${fieldId}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="비워 두면 익명으로 저장됩니다" />
      <label htmlFor={`${fieldId}-body`}>수정 의견이나 질문</label>
      <textarea id={`${fieldId}-body`} value={body} onChange={(event) => {
        if (!body) setDraftCommitSha(commitSha);
        if (!event.target.value) setDraftCommitSha(undefined);
        setBody(event.target.value);
      }} maxLength={4000} placeholder="예: 이 요약의 날짜가 원문과 다른 것 같습니다. 근거를 다시 확인해 주세요." />
      {body && draftCommitSha && draftCommitSha !== commitSha && <p className="feedback-warning">작성 중 자료가 갱신되었습니다. 입력한 의견은 보존되며, 작성을 시작한 자료 버전 {draftCommitSha.slice(0, 7)}에 연결해 저장합니다.</p>}
      <div className="feedback-actions"><span>{body.length}/4000 · 의견은 공개 목록에 표시됩니다.</span><button type="button" onClick={save} disabled={busy || !body.trim()}>{busy ? "저장 중…" : "피드백 저장"}</button></div>
    </>}
    {message && <p className="feedback-message" role="status">{message}</p>}
    {branchReady && <>
      <div className={styles.heading}><h4>이 항목에 저장된 의견</h4><button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading || !configured}>새로고침</button></div>
      <p className={styles.note}>이전 버전에 남긴 의견도 표시합니다. 목록은 자동으로 반영 완료 여부를 판단하지 않습니다.</p>
      <div className={styles.links}><Link href={`/feedback?${allParams}`}>이 브랜치의 모든 피드백</Link><a href={`/api/feedback?${itemParams}`}>이 항목의 피드백 JSON</a></div>
      {loading && <p role="status">의견을 불러오는 중입니다…</p>}
      {readError && <p role="alert" className={styles.error}>{readError} 저장 성공 안내가 있었다면 의견은 저장되었고, 목록 조회에 실패한 것입니다.</p>}
      {!loading && !readError && configured && !feedback.length && <p className={styles.note}>이 항목에 저장된 의견이 없습니다.</p>}
      {feedback.length > 0 && <FeedbackList feedback={feedback} />}
      {nextOffset !== null && <button type="button" onClick={loadMore} disabled={loading}>다음 의견 보기</button>}
    </>}
  </section>;
}
