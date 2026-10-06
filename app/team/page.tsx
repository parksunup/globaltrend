import { redirect } from "next/navigation";
import ReviewShell from "../components/review-shell";
import LoginForm from "./login-form";
import { loadTeamReviewItems } from "../review-data";
import { createClient } from "../../lib/supabase/server";
import { loadSubmissionPreview, submissionPreviewEnabled } from "../../lib/submission-preview";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="login-page"><LoginForm /></main>;
  const { data: membership } = await supabase
    .from("team_memberships")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership?.is_active) {
    return <main className="login-page"><section className="login-card"><p className="eyebrow">TEAM WORKSPACE</p><h1>접근 권한이 없습니다</h1><p>로그인은 되었지만 활성 팀원으로 등록되지 않았습니다. 프로젝트 리드에게 GitHub 초대와 별도로 Supabase 팀 권한 등록을 요청해 주세요.</p></section></main>;
  }
  const { items } = await loadTeamReviewItems(supabase);
  const showSubmissionPreview = submissionPreviewEnabled();
  const submissions = showSubmissionPreview ? loadSubmissionPreview() : [];
  return <ReviewShell initialItems={items} dataSource="supabase" teamMode canReview teamRole={membership.role} showSubmissionPreview={showSubmissionPreview} submissions={submissions} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA} />;
}
