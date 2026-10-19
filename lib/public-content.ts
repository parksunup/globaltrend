import { loadPublishedStories } from "./published-trends";
import { loadSubmittedStories, publicSubmissionPreviewEnabled } from "./public-submission-preview";
import { withStoryPublication } from "./publication-status";

/** Production stays on approved reports; the isolated branch previews submitted drafts. */
export async function loadPublicStories() {
  if (!publicSubmissionPreviewEnabled()) return loadPublishedStories();
  const submitted = loadSubmittedStories();
  try { return withStoryPublication(submitted, await loadPublishedStories()); }
  catch (error) { console.error("Unable to confirm preview publication status", error); return withStoryPublication(submitted, null); }
}
