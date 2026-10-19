import PublicHome from "./public/page";
import { PublicThemeProvider } from "./public/public-theme";
import ReviewShell from "./components/review-shell";
import { loadPublicTeamReviewItems } from "./review-data";
import { loadReviewedSubmissionView } from "../lib/publication-display";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.SITE_ENTRY === "public") return <PublicThemeProvider><PublicHome /></PublicThemeProvider>;
  const [{items,source}, {submissions, documents}] = await Promise.all([loadPublicTeamReviewItems(), loadReviewedSubmissionView()]);
  return <ReviewShell initialItems={items} dataSource={source} publicReviewMode showSubmissionPreview
    submissions={submissions} submissionDocuments={documents}
    submissionBranch={process.env.VERCEL_GIT_COMMIT_REF} submissionCommitSha={process.env.VERCEL_GIT_COMMIT_SHA}/>;
}
