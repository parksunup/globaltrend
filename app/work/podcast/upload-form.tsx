"use client";
import { useState, type FormEvent } from "react";
import styles from "../work.module.css";

type Report = { id: string; title_ko: string; one_line_summary_ko: string | null; published_at: string | null };

export default function PodcastUploadForm({ reports }: { reports: Report[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    data.set("reportIds", JSON.stringify(Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[name="report"]:checked'), input => input.value)));
    try {
      const response = await fetch("/api/podcast/publish", { method: "POST", body: data });
      const result = await response.json();
      setMessage(result.message ?? result.error ?? "처리 결과를 확인할 수 없습니다.");
      if (response.ok) event.currentTarget.reset();
    } catch {
      setMessage("업로드에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.");
    } finally { setBusy(false); }
  }

  return <section className={styles.card}>
    <h2>NotebookLM 오디오 게시</h2>
    <p>NotebookLM에서 다운로드한 오디오 파일을 선택하고, 해당 주간호에 실제 포함된 공개 동향만 골라 주세요. 게시 후 공개 주간 팟캐스트 페이지에 바로 표시됩니다.</p>
    <form className={styles.form} onSubmit={submit}>
      <label>주간호 표기<input name="issueKey" placeholder="예: 2026-W43" pattern="[0-9]{4}-W[0-9]{2}" required /></label>
      <label>팟캐스트 제목<input name="title" maxLength={160} required /></label>
      <div className={styles.fields}><label>주 시작일<input name="weekStart" type="date" required /></label><label>주 종료일<input name="weekEnd" type="date" required /></label></div>
      <label>간단한 소개<textarea name="description" rows={3} maxLength={1000} /></label>
      <label>NotebookLM에서 받은 오디오<input name="audio" type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a" required /></label>
      <fieldset style={{border:"1px solid #d8e5db",borderRadius:8,padding:16}}>
        <legend>주간호에 실제 포함된 공개 동향 선택</legend>
        {reports.length ? reports.map(report => <label key={report.id} style={{display:"flex",gridTemplateColumns:"auto 1fr",alignItems:"start",gap:10,borderBottom:"1px solid #edf1ee",padding:"10px 0",fontWeight:400}}>
          <input type="checkbox" name="report" value={report.id} style={{width:18,height:18,marginTop:3}} />
          <span><strong>{report.title_ko}</strong><br/><small>{report.published_at ? new Date(report.published_at).toLocaleDateString("ko-KR") : ""} · {report.one_line_summary_ko ?? ""}</small></span>
        </label>) : <p>연결할 공개 동향이 없습니다.</p>}
      </fieldset>
      <button disabled={busy || reports.length === 0}>{busy ? "오디오를 올리는 중…" : "공개 주간호에 게시"}</button>
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </form>
  </section>;
}
