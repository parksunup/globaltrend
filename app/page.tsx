import PublicHome from "./public/page";
import { PublicThemeProvider } from "./public/public-theme";
import ReviewShell from "./components/review-shell";
import { loadPublicTeamReviewItems } from "./review-data";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../lib/submission-preview";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.SITE_ENTRY === "public") return <PublicThemeProvider><PublicHome /></PublicThemeProvider>;
  const {items,source} = await loadPublicTeamReviewItems();
  return <ReviewShell initialItems={items} dataSource={source} publicReviewMode showSubmissionPreview
    submissions={loadSubmissionPreview()} submissionDocuments={loadSubmissionDocuments()}
    submissionBranch={process.env.VERCEL_GIT_COMMIT_REF} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA}/>;
}
