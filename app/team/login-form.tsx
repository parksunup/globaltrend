"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(null);
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) { setError("로그인 정보를 확인해 주세요."); setLoading(false); return; }
    window.location.reload();
  }

  return <form className="login-card" onSubmit={submit}>
    <p className="eyebrow">TEAM WORKSPACE</p><h1>팀 검수 공간</h1>
    <p>검수 중인 법제와 비교 기준은 팀원 로그인 후에만 열람할 수 있습니다.</p>
    <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
    <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="primary-action" disabled={loading}>{loading ? "확인 중…" : "로그인"}</button>
  </form>;
}
