import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import {monthlyWeekIssueKey,podcastEditionNumber} from "../../../../lib/weekly-label";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a"]);

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "관리자 계정으로 로그인해 주세요." }, { status: 401 });

  const { data: member } = await db.from("team_memberships")
    .select("role,is_active").eq("user_id", user.id).maybeSingle();
  if (!member?.is_active || member.role !== "admin") {
    return NextResponse.json({ error: "팟캐스트 발행은 총괄 관리자만 할 수 있습니다." }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "게시 정보를 확인해 주세요." }, { status: 400 });
  }
  const issueKey = typeof payload.issueKey === "string" ? payload.issueKey.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const weekStart = typeof payload.weekStart === "string" ? payload.weekStart : "";
  const weekEnd = typeof payload.weekEnd === "string" ? payload.weekEnd : "";
  const audioPath = typeof payload.audioPath === "string" ? payload.audioPath : "";
  const audioMimeType = typeof payload.audioMimeType === "string" ? payload.audioMimeType : "";
  const fileSizeBytes = Number(payload.fileSizeBytes);
  const reportIds = payload.reportIds;

  if (!/^\d{4}-\d{2}-W[1-5]-[1-9]\d*$/.test(issueKey) ||
      !title || title.length > 160 || description.length > 1000 ||
      !isRealDate(weekStart) || !isRealDate(weekEnd) || weekStart > weekEnd ||
      !Array.isArray(reportIds) || reportIds.length < 1 || reportIds.length > 20 ||
      reportIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) ||
      new Set(reportIds).size !== reportIds.length ||
      !Number.isInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > MAX_FILE_SIZE ||
      !ALLOWED_TYPES.has(audioMimeType)) {
    return NextResponse.json({ error: "주간호 정보, 포함 동향, 오디오 파일을 확인해 주세요." }, { status: 400 });
  }
  if(new Date(`${weekStart}T00:00:00Z`).getUTCDay()!==1||weekEnd!==new Date(new Date(`${weekStart}T00:00:00Z`).valueOf()+6*86400000).toISOString().slice(0,10)||!issueKey.startsWith(`${monthlyWeekIssueKey(weekStart)}-`)||podcastEditionNumber(issueKey)<1){
    return NextResponse.json({ error: "주 시작일과 회차 식별자가 일치하지 않습니다." }, { status: 400 });
  }

  const extension = audioMimeType === "audio/mpeg" ? "mp3" : audioMimeType === "audio/wav" ? "wav" : "m4a";
  const pathPattern = new RegExp(`^${issueKey}/[0-9a-f-]{36}\\.${extension}$`, "i");
  if (!pathPattern.test(audioPath)) {
    return NextResponse.json({ error: "업로드된 오디오 파일 경로를 확인할 수 없습니다." }, { status: 400 });
  }

  const { data: reports, error: reportsError } = await db.from("reports")
    .select("id").eq("status", "published").in("id", reportIds as string[]);
  if (reportsError || reports?.length !== reportIds.length) {
    return NextResponse.json({ error: "선택한 동향 중 공개 상태가 아닌 자료가 있습니다. 자료 목록을 새로고침해 주세요." }, { status: 400 });
  }

  const slash = audioPath.indexOf("/");
  const directory = audioPath.slice(0, slash);
  const fileName = audioPath.slice(slash + 1);
  const { data: objects, error: storageError } = await db.storage.from("weekly-podcasts")
    .list(directory, { search: fileName, limit: 10 });
  const uploaded = objects?.find(object => object.name === fileName);
  const metadata = uploaded?.metadata as { size?: number; mimetype?: string } | undefined;
  if (storageError || !uploaded || Number(metadata?.size) !== fileSizeBytes ||
      (metadata?.mimetype && metadata.mimetype !== audioMimeType)) {
    return NextResponse.json({ error: "Storage에 올라간 파일과 게시 정보가 일치하지 않습니다. 오디오를 다시 선택해 주세요." }, { status: 400 });
  }

  const { error: publishError } = await db.rpc("publish_weekly_podcast_issue", {
    p_issue_key: issueKey,
    p_title: title,
    p_description: description,
    p_week_start: weekStart,
    p_week_end: weekEnd,
    p_report_ids: reportIds,
    p_audio_path: audioPath,
    p_audio_mime_type: audioMimeType,
    p_file_size_bytes: fileSizeBytes,
  });

  if (publishError) {
    await db.storage.from("weekly-podcasts").remove([audioPath]);
    if (publishError.code === "23505") {
      return NextResponse.json({ error: "이미 등록된 주간호입니다. 호수 표기를 확인해 주세요." }, { status: 409 });
    }
    if (publishError.code === "PGRST202" || publishError.code === "42883") {
      return NextResponse.json({ error: "게시 기능을 준비 중입니다. 데이터베이스 배포 후 다시 시도해 주세요." }, { status: 503 });
    }
    return NextResponse.json({ error: "주간호와 팟캐스트 게시에 실패했습니다. 입력 내용을 확인해 주세요." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    issueKey,
    message: "주간호와 팟캐스트를 함께 공개했습니다.",
  });
}
