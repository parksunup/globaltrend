import { loadPublishedStories } from "./published-trends";
/** Public trend pages only display reports that have been published. */
export async function loadPublicStories() {
  return loadPublishedStories();
}
