"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type FeedbackRow = {
  id: number;
  item_id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null } | null;
};

export default function SubmissionFeedback({ itemId, branch, commitSha }: { itemId: string; branch?: string; commitSha?: string }) {
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = Boolean(branch && /^[A-Za-z0-9._/-]{1,160}$/.test(branch) && commitSha && /^[a-f0-9]{40}$/i.test(commitSha));
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  const refresh = useCallback(async () => {
    if (!ready || !configured) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setCanWrite(false); setRows([]); return; }
    const membership = await supabase.from("team_memberships").select("role,is_active").eq("user_id", user.id).maybeSingle();
    const allowed = Boolean(membership.data?.is_active && ["admin", "editor", "reviewer"].includes(membership.data.role));
    setCanWrite(allowed);
    if (!allowed) { setRows([]); return; }
    const result = await supabase.from("submission_feedback")
      .select("id,item_id,body,created_at,author_id,profiles!submission_feedback_author_id_fkey(display_name)")
      .eq("branch_name", branch!)
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });
    if (result.error) {
      setMessage("피드백을 불러오지 못했습니다. DB 마이그레이션 적용 상태를 확인해 주세요.");
      return;
    }
    setRows(result.data as unknown as FeedbackRow[]);
  }, [branch, configured, itemId, ready]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function sendLink() {
    if (!email.trim() || !configured) return;
    setBusy(true); setMessage("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
    setMessage(error ? "로그인 링크를 보내지 못했습니다. 등록된 팀 계정인지 확인해 주세요." : "등록된 팀 계정으로 로그인 링크를 보냈습니다. 이메일을 확인해 주세요.");
    setBusy(false);
  }

  async function save() {
    const trimmed = body.trim();
    if (!ready || !canWrite || !trimmed || trimmed.length > 4000) return;
    setBusy(true); setMessage("");
    const { error } = await createClient().from("submission_feedback").insert({
      branch_name: branch!, item_id: itemId, commit_sha: commitSha!.toLowerCase(), body: trimmed,
    });
    if (error) setMessage("저장하지 못했습니다. 팀 권한과 DB 마이그레이션을 확인해 주세요.");
    else { setBody(""); setMessage("피드백을 저장했습니다. 담당자가 이후 작업에서 확인할 수 있습니다."); await refresh(); }
    setBusy(false);
  }

  return <section className="feedback-panel" aria-label="항목 피드백">
    <h3>이 항목에 의견 남기기</h3>
    <p>의견은 항목·브랜치·커밋과 함께 DB에 기록됩니다. 승인이나 공개로 바뀌지 않습니다.</p>
    {!ready && <p className="feedback-warning">피드백은 커밋 정보가 있는 PR Preview에서만 사용할 수 있습니다.</p>}
    {ready && !configured && <p className="feedback-warning">Supabase 연결 설정이 없어 피드백을 사용할 수 없습니다.</p>}
    {ready && configured && !userId && <div className="feedback-login">
      <label htmlFor="feedback-email">팀 계정 이메일</label>
      <input id="feedback-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
      <button type="button" onClick={sendLink} disabled={busy || !email.trim()}>로그인 링크 받기</button>
      <small>Preview 열람에는 로그인이 필요 없습니다. 의견 작성·조회에는 등록된 Supabase 팀 계정이 필요합니다.</small>
    </div>}
    {ready && userId && !canWrite && <p className="feedback-warning">로그인한 계정에 팀 권한이 없습니다. 프로젝트 리드에게 팀 계정 등록을 요청해 주세요.</p>}
    {ready && canWrite && <>
      <div className="feedback-list">
        {rows.length === 0 ? <p>아직 이 항목에 남긴 의견이 없습니다.</p> : rows.map((row) =>
          <article key={row.id}><div><strong>{row.profiles?.display_name || "팀원"}</strong><time>{new Date(row.created_at).toLocaleString("ko-KR")}</time></div><p>{row.body}</p></article>)}
      </div>
      <label htmlFor="feedback-body">자연어로 수정 의견이나 질문을 적어 주세요</label>
      <textarea id="feedback-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="예: 이 요약의 날짜가 원문과 다른 것 같습니다. 근거를 다시 확인해 주세요." />
      <div className="feedback-actions"><span>{body.length}/4000</span><button type="button" onClick={save} disabled={busy || !body.trim()}>피드백 저장</button></div>
    </>}
    {message && <p className="feedback-message" role="status">{message}</p>}
  </section>;
}
