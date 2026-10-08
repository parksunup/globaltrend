import ReviewShell from "./components/review-shell";
import { loadReviewItems } from "./review-data";
import { loadSubmissionDocuments, loadSubmissionPreview, submissionPreviewEnabled } from "../lib/submission-preview";

export default async function Home() {
  const { items, source } = await loadReviewItems();
  const showSubmissionPreview = submissionPreviewEnabled();
  const submissions = showSubmissionPreview ? loadSubmissionPreview() : [];
  const submissionDocuments = showSubmissionPreview ? loadSubmissionDocuments() : { legal: [], weekly: null };
  return <ReviewShell initialItems={items} dataSource={source} showSubmissionPreview={showSubmissionPreview} submissions={submissions} submissionDocuments={submissionDocuments} submissionBranch={process.env.VERCEL_GIT_COMMIT_REF} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA} />;
}
