import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a"]);

export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "관리자 계정으로 로그인해 주세요." }, { status: 401 });

  const { data: member } = await db.from("team_memberships")
    .select("role,is_active").eq("user_id", user.id).maybeSingle();
  if (!member?.is_active || member.role !== "admin") {
    return NextResponse.json({ error: "팟캐스트 발행은 총괄 관리자만 할 수 있습니다." }, { status: 403 });
  }

  const form = await request.formData();
  const issueKey = String(form.get("issueKey") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const weekStart = String(form.get("weekStart") ?? "");
  const weekEnd = String(form.get("weekEnd") ?? "");
  const file = form.get("audio");
  let reportIds: unknown;
  try { reportIds = JSON.parse(String(form.get("reportIds") ?? "[]")); } catch { reportIds = null; }

  if (!/^\d{4}-W\d{2}$/.test(issueKey) || !title || title.length > 160 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd) ||
      weekStart > weekEnd || !Array.isArray(reportIds) || reportIds.length < 1 ||
      reportIds.length > 20 || reportIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ error: "주간호 정보와 포함 동향을 확인해 주세요." }, { status: 400 });
  }
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size < 1 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "MP3, WAV, M4A 오디오 파일(최대 50MB)을 선택해 주세요." }, { status: 400 });
  }

  const uniqueIds = [...new Set(reportIds as string[])];
  const { data: reports, error: reportsError } = await db.from("reports")
    .select("id").eq("status", "published").in("id", uniqueIds);
  if (reportsError || reports?.length !== uniqueIds.length) {
    return NextResponse.json({ error: "선택한 동향 중 공개 상태가 아닌 자료가 있습니다. 자료 목록을 새로고침해 주세요." }, { status: 400 });
  }

  const existing = await db.from("weekly_podcast_episodes").select("issue_key").eq("issue_key", issueKey).maybeSingle();
  if (existing.data) {
    return NextResponse.json({ error: "이 주간호의 팟캐스트가 이미 등록되어 있습니다. 기존 발행을 먼저 취소해 주세요." }, { status: 409 });
  }

  const extension = file.type === "audio/mpeg" ? "mp3" : file.type === "audio/wav" ? "wav" : "m4a";
  const audioPath = `${issueKey}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from("weekly-podcasts")
    .upload(audioPath, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "오디오 업로드에 실패했습니다. 다시 시도해 주세요." }, { status: 502 });

  const { error: insertError } = await db.from("weekly_podcast_episodes").insert({
    issue_key: issueKey, title, description, week_start: weekStart, week_end: weekEnd,
    report_ids: uniqueIds, audio_path: audioPath, audio_mime_type: file.type,
    file_size_bytes: file.size, status: "published", created_by: user.id,
    published_at: new Date().toISOString(),
  });
  if (insertError) {
    await db.storage.from("weekly-podcasts").remove([audioPath]);
    return NextResponse.json({ error: "업로드는 됐지만 발행 기록을 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, issueKey, message: "팟캐스트를 공개 주간호에 게시했습니다." });
}
