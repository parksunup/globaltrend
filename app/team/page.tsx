import ReviewShell from "../components/review-shell";
import { loadPublicTeamReviewItems } from "../review-data";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { items, source } = await loadPublicTeamReviewItems();
  return <ReviewShell initialItems={items} dataSource={source} publicReviewMode />;
}
