import type { PublishedStory } from './published-trends.ts';

/** Deployment type never establishes whether a particular version was reviewed. */
export function withStoryPublication(submitted: PublishedStory[], published: PublishedStory[] | null): PublishedStory[] {
  const byUrl = new Map((published ?? []).map(story => [story.officialUrl, story]));
  return submitted.map(story => {
    const live = byUrl.get(story.officialUrl);
    const same = live && live.title === story.title && live.summary === story.summary
      && live.details === story.details && live.originalTitle === story.originalTitle
      && live.date === story.date && JSON.stringify(live.jurisdictions ?? []) === JSON.stringify(story.jurisdictions ?? [])
      && JSON.stringify(live.tags) === JSON.stringify(story.tags);
    return {...story, publicationStatus: published === null ? 'unknown' : same ? 'published' : 'draft'};
  });
}

export function publicationLabel(status?: string): string {
  return status === 'published' ? '검수 완료 · 발행됨'
    : status === 'draft' || status === 'not_started' || status === 'unreviewed' ? '미발행 작업본'
    : status === 'verified' || status === 'reviewed' ? '검수 완료 · 미발행' : '발행 상태 확인 필요';
}
