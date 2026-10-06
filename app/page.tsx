import ReviewShell from "./components/review-shell";
import { loadReviewItems } from "./review-data";
import { loadSubmissionPreview, submissionPreviewEnabled } from "../lib/submission-preview";

export default async function Home() {
  const { items, source } = await loadReviewItems();
  const submissions = submissionPreviewEnabled() ? loadSubmissionPreview() : [];
  return <ReviewShell initialItems={items} dataSource={source} submissions={submissions} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA} />;
}
