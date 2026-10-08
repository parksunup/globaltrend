import ReviewShell from "../components/review-shell";
import { loadPublicTeamReviewItems } from "../review-data";
import { loadSubmissionDocuments, loadSubmissionPreview, submissionPreviewEnabled } from "../../lib/submission-preview";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { items, source } = await loadPublicTeamReviewItems();
  const showSubmissionPreview = submissionPreviewEnabled();
  const submissions = showSubmissionPreview ? loadSubmissionPreview() : [];
  const submissionDocuments = showSubmissionPreview ? loadSubmissionDocuments() : { legal: [], weekly: null };
  return <ReviewShell initialItems={items} dataSource={source} publicReviewMode showSubmissionPreview={showSubmissionPreview} submissions={submissions} submissionDocuments={submissionDocuments} submissionBranch={process.env.VERCEL_GIT_COMMIT_REF} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA} />;
}
