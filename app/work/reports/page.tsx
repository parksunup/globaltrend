import { createClient } from "../../../lib/supabase/server";
import { readAllPages } from "../../../lib/read-all-pages";
import WorkFrame from "../frame";

export const dynamic = "force-dynamic";
export const metadata = { title: "이용자 의견·오류 신고 · 국제요정 작업실" };

type Report = { id: number; kind: string; page_url: string; body: string; contact_email: string | null; status: string; created_at: string };

export default async function ReportsPage() {
  const db = await createClient();
  let reports: Report[] = [];
  let loadError = false;
  try {
    reports = await readAllPages<Report>(async (offset, count) => {
      const { data, error } = await db.from("site_reports")
        .select("id,kind,page_url,body,contact_email,status,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + count - 1);
      if (error) throw error;
      return (data ?? []) as Report[];
    });
  } catch {
    loadError = true;
  }

  return <WorkFrame active="reports"><section style={{ maxWidth: 900, margin: "24px auto", lineHeight: 1.7 }}>
    <h1>이용자 의견·오류 신고</h1>
    {loadError && <p role="alert">신고 내역을 불러오지 못했습니다. 데이터베이스 연결과 접근 권한을 확인해 주세요.</p>}
    {!loadError && !reports.length && <p>접수된 신고가 없습니다.</p>}
    {reports.map(report => <article key={report.id} style={{ border: "1px solid #aaa", borderRadius: 10, padding: 18, margin: "16px 0", overflowWrap: "anywhere" }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{report.kind === "bug" ? "오류 신고" : "의견"} · {new Date(report.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>{report.body}</p>
      <p>페이지 <a href={report.page_url}>{report.page_url}</a></p>
      {report.contact_email && <p>회신 이메일 {report.contact_email}</p>}
      <small>상태 {report.status}</small>
    </article>)}
  </section></WorkFrame>;
}
