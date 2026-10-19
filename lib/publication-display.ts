import { loadReviewedLegalDrafts } from './public-legal';
import { loadPublishedStories } from './published-trends';
import { loadSubmittedStories } from './public-submission-preview';
import { withStoryPublication } from './publication-status';
import { loadSubmissionDocuments, loadSubmissionPreview } from './submission-preview';

/** Read current publication state without returning reviewer identity or dates. */
export async function loadReviewedSubmissionView() {
  const submissions = loadSubmissionPreview();
  const documents = loadSubmissionDocuments();
  const [legal, stories] = await Promise.all([loadReviewedLegalDrafts(), loadPublishedStories().then(stories => withStoryPublication(loadSubmittedStories(), stories)).catch(() => withStoryPublication(loadSubmittedStories(), null))]);
  const instruments = new Map(legal.instruments.map(item => [item.id, item]));
  const cells = new Map(legal.cells.map(cell => [cell.id, cell]));
  const byUrl = new Map(stories.map(story => [story.officialUrl, story]));
  return {
    submissions: submissions.map(item => {
      if (item.kind === '법제 목록') return {...item, status: instruments.get(item.id)?.status ?? item.status};
      if (item.kind === '동향 표본') {
        const story = item.links.map(link => byUrl.get(link.url)).find(Boolean);
        return {...item, status: story?.publicationStatus ?? 'unknown'};
      }
      return item;
    }),
    documents: {...documents, legal: documents.legal.map(cell => cells.get(cell.id) ?? cell)},
  };
}
