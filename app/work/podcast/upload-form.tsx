"use client";
import { useState, type FormEvent } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "../work.module.css";
import {formatMonthlyWeek} from "../../../lib/weekly-label";

type Report = { id: string; title_ko: string; one_line_summary_ko: string | null; published_at: string | null };
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a"]);

function extensionFor(type: string) {
  return type === "audio/mpeg" ? "mp3" : type === "audio/wav" ? "wav" : "m4a";
}

export default function PodcastUploadForm({ reports }: { reports: Report[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const startDate=new Date(`${weekStart}T00:00:00Z`);
  const weekLabel=weekStart&&/^\d{4}-\d{2}-\d{2}$/.test(weekStart)&&!Number.isNaN(startDate.valueOf())&&startDate.toISOString().slice(0,10)===weekStart&&startDate.getUTCDay()===1?formatMonthlyWeek(weekStart):"";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("audio");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size < 1 || file.size > MAX_FILE_SIZE) {
      setMessage("MP3, WAV, M4A 오디오 파일(최대 50MB)을 선택해 주세요.");
      return;
    }

    setMessage("");
    const selectedWeekStart=String(data.get("weekStart")??"");
    const selectedWeekEnd=String(data.get("weekEnd")??"");
    if(!weekLabel||selectedWeekStart!==weekStart||selectedWeekEnd!==new Date(startDate.valueOf()+6*86400000).toISOString().slice(0,10)){
      setMessage("월요일 시작일과 그 주 일요일을 선택해 주세요.");
      return;
    }
    const reportIds = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="report"]:checked'), input => input.value);
    if(!reportIds.length){setMessage('팟캐스트에 포함할 공개 동향을 하나 이상 선택해 주세요.');return;}
    setBusy(true);
    try {
      const reservation=await fetch('/api/podcast/next-issue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weekStart:selectedWeekStart})});
      const reserved=await reservation.json();
      if(!reservation.ok||typeof reserved.issueKey!=='string')throw Error(reserved.error??'새 팟캐스트 회차를 예약하지 못했습니다.');
      const issueKey=reserved.issueKey;
      const audioPath = `${issueKey}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      const storage = createClient().storage.from("weekly-podcasts");
      const { error: uploadError } = await storage.upload(audioPath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        setMessage("오디오 저장에 실패했습니다. 인터넷 연결과 파일 크기를 확인해 주세요.");
        return;
      }

      const response = await fetch("/api/podcast/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey,
          title: data.get("title"),
          description: data.get("description"),
          weekStart: data.get("weekStart"),
          weekEnd: data.get("weekEnd"),
          reportIds,
          audioPath,
          audioMimeType: file.type,
          fileSizeBytes: file.size,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        await storage.remove([audioPath]);
        setMessage(result.error ?? "게시에 실패했습니다. 입력 내용을 확인해 주세요.");
        return;
      }
      setMessage(result.message ?? "주간 팟캐스트를 게시했습니다.");
      form.reset();setWeekStart('');setWeekEnd('');
    } catch(error) {
      setMessage(error instanceof Error?error.message:"연결이 끊겼습니다. 게시 상태를 새로고침해 확인한 뒤 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  return <section className={styles.card}>
    <h2>NotebookLM 오디오 게시</h2>
    <p>주간호 정보와 실제 포함된 공개 동향, NotebookLM 오디오를 한 번 등록하면 주간호와 팟캐스트가 함께 공개됩니다. 이미 공개된 자료만 선택할 수 있습니다.</p>
    <form className={styles.form} onSubmit={submit}>
      <p>{weekLabel?`호 표기: ${weekLabel} · 회차 번호 자동 지정`:'월요일 시작일을 선택하면 월 기준 호 표기를 표시합니다.'}</p>
      <label>팟캐스트 제목<input name="title" maxLength={160} required /></label>
      <div className={styles.fields}><label>주 시작일<input name="weekStart" type="date" value={weekStart} onChange={event=>{const value=event.target.value;setWeekStart(value);const date=new Date(`${value}T00:00:00Z`);setWeekEnd(!Number.isNaN(date.valueOf())?new Date(date.valueOf()+6*86400000).toISOString().slice(0,10):'');}} required /></label><label>주 종료일<input name="weekEnd" type="date" value={weekEnd} onChange={event=>setWeekEnd(event.target.value)} required /></label></div>
      <label>간단한 소개<textarea name="description" rows={3} maxLength={1000} /></label>
      <label>NotebookLM에서 받은 오디오<input name="audio" type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a" required /></label>
      <fieldset style={{border:"1px solid #d8e5db",borderRadius:8,padding:16}}>
        <legend>주간호에 실제 포함된 공개 동향 선택</legend>
        {reports.length ? reports.map(report => <label key={report.id} style={{display:"flex",alignItems:"start",gap:10,borderBottom:"1px solid #edf1ee",padding:"10px 0",fontWeight:400}}>
          <input type="checkbox" name="report" value={report.id} style={{width:18,height:18,marginTop:3}} />
          <span><strong>{report.title_ko}</strong><br/><small>{report.published_at ? new Date(report.published_at).toLocaleDateString("ko-KR") : ""} · {report.one_line_summary_ko ?? ""}</small></span>
        </label>) : <p>연결할 공개 동향이 없습니다.</p>}
      </fieldset>
      <button disabled={busy || reports.length === 0}>{busy ? "오디오를 올리는 중…" : "공개 주간호에 게시"}</button>
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </form>
  </section>;
}
