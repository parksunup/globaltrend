import { loadPublishedStories } from "./published-trends";
import { loadSubmittedStories, publicSubmissionPreviewEnabled } from "./public-submission-preview";

/** Production stays on approved reports; the isolated branch previews submitted drafts. */
export async function loadPublicStories() {
  return publicSubmissionPreviewEnabled() ? loadSubmittedStories() : loadPublishedStories();
}
