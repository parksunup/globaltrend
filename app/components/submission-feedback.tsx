"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function SubmissionFeedback({ itemId, branch, commitSha }: { itemId: string; branch?: string; commitSha?: string }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = Boolean(branch && /^[A-Za-z0-9._/-]{1,160}$/.test(branch) && commitSha && /^[a-f0-9]{40}$/i.test(commitSha));
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function save() {
    const trimmed = body.trim();
    const authorName = name.trim() || "익명";
    if (!ready || !configured || busy || !trimmed || trimmed.length > 4000 || authorName.length > 80) return;
    setBusy(true); setMessage("");
    const { error } = await createClient().from("submission_feedback").insert({
      branch_name: branch!, item_id: itemId, commit_sha: commitSha!.toLowerCase(), author_name: authorName, body: trimmed,
    });
    if (error) setMessage("저장하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 프로젝트 리드에게 알려 주세요.");
    else { setBody(""); setMessage("피드백을 저장했습니다. 담당자가 이후 작업에서 확인할 수 있습니다."); }
    setBusy(false);
  }

  return <section className="feedback-panel" aria-label="항목 피드백">
    <h3>이 항목에 의견 남기기</h3>
    <p>로그인 없이 의견을 남길 수 있습니다. 이름은 확인되지 않으며, 의견은 브랜치·항목·커밋과 함께 검토 대기열에 저장됩니다. 승인이나 공개로 바뀌지 않습니다.</p>
    {!ready && <p className="feedback-warning">피드백은 커밋 정보가 있는 PR Preview에서만 사용할 수 있습니다.</p>}
    {ready && !configured && <p className="feedback-warning">Supabase 연결 설정이 없어 피드백을 사용할 수 없습니다.</p>}
    {ready && configured && <>
      <label htmlFor="feedback-name">이름 또는 별칭 (선택)</label>
      <input id="feedback-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="비워 두면 익명으로 저장됩니다" />
      <label htmlFor="feedback-body">수정 의견이나 질문</label>
      <textarea id="feedback-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="예: 이 요약의 날짜가 원문과 다른 것 같습니다. 근거를 다시 확인해 주세요." />
      <div className="feedback-actions"><span>{body.length}/4000 · 저장된 의견은 이 공개 화면에 표시되지 않습니다.</span><button type="button" onClick={save} disabled={busy || !body.trim()}>{busy ? "저장 중…" : "피드백 저장"}</button></div>
    </>}
    {message && <p className="feedback-message" role="status">{message}</p>}
  </section>;
}
