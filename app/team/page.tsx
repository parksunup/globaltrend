import ReviewShell from "../components/review-shell";
import { loadPublicTeamReviewItems } from "../review-data";
import { submissionPreviewEnabled } from "../../lib/submission-preview";
import { loadReviewedSubmissionView } from "../../lib/publication-display";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { items, source } = await loadPublicTeamReviewItems();
  const showSubmissionPreview = submissionPreviewEnabled();
  const {submissions, documents: submissionDocuments} = showSubmissionPreview
    ? await loadReviewedSubmissionView()
    : {submissions: [], documents: {legal: [], weekly: null}};
  return <ReviewShell initialItems={items} dataSource={source} publicReviewMode showSubmissionPreview={showSubmissionPreview} submissions={submissions} submissionDocuments={submissionDocuments} submissionBranch={process.env.VERCEL_GIT_COMMIT_REF} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA} />;
}
