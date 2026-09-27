import ReviewShell from "./components/review-shell";
import { loadReviewItems } from "./review-data";

export default async function Home() {
  const { items, source } = await loadReviewItems();
  return <ReviewShell initialItems={items} dataSource={source} />;
}