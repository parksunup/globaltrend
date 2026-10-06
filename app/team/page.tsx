import ReviewShell from "../components/review-shell";
import { loadPublicTeamReviewItems } from "../review-data";
import { loadSubmissionPreview, submissionPreviewEnabled } from "../../lib/submission-preview";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { items, source } = await loadPublicTeamReviewItems();
  const showSubmissionPreview = submissionPreviewEnabled();
  const submissions = showSubmissionPreview ? loadSubmissionPreview() : [];
  return <ReviewShell initialItems={items} dataSource={source} publicReviewMode showSubmissionPreview={showSubmissionPreview} submissions={submissions} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA} />;
}
