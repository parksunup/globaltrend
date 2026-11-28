"use client";

import { useEffect, useState } from "react";
import styles from "./report.module.css";

export default function ReportForm() {
  const [kind, setKind] = useState<"feedback" | "bug">("feedback");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin && referrer.pathname.startsWith("/public")) {
        setPageUrl(referrer.origin + referrer.pathname);
      }
    } catch { /* Direct visits leave the optional page field empty. */ }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/public/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, body, contactEmail: email, pageUrl: pageUrl || window.location.origin + "/public", website: "" }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setMessage(result?.error || "접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setBody("");
    setMessage("접수했습니다. 알려주셔서 감사합니다.");
  }

  return <section className={styles.panel}>
    <h1>의견·오류 신고</h1>
    <p>국제요정을 사용하며 불편했던 점이나 잘못된 화면을 알려주세요.</p>
    <form onSubmit={submit}>
      <fieldset><legend>유형</legend>
        <label><input type="radio" checked={kind === "feedback"} onChange={() => setKind("feedback")} /> 의견</label>
        <label><input type="radio" checked={kind === "bug"} onChange={() => setKind("bug")} /> 오류 신고</label>
      </fieldset>
      <label>문제가 발생한 페이지 주소<input type="url" value={pageUrl} onChange={event => setPageUrl(event.target.value)} placeholder="비워 두면 국제요정 메인으로 접수됩니다" /></label>
      <label>내용<textarea required minLength={10} maxLength={4000} value={body} onChange={event => setBody(event.target.value)} placeholder="어떤 문제가 있었는지 자세히 적어 주세요." /></label>
      <label>답변받을 이메일 <small>선택</small><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label>
      <button disabled={busy || body.trim().length < 10}>{busy ? "접수 중…" : "보내기"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
