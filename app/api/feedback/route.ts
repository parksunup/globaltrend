import { FeedbackQueryError, getPublicFeedback, parseFeedbackQuery } from "../../../lib/public-feedback";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = parseFeedbackQuery(new URL(request.url).searchParams);
    return Response.json({ ...await getPublicFeedback(query), deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof FeedbackQueryError ? error.message : "저장된 피드백을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: error instanceof FeedbackQueryError ? 400 : 503, headers });
  }
}
