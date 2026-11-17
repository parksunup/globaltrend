import { validDay, uuid, type PodcastStory } from './podcast-production.ts';
import { PODCAST_RECOMMENDATION_MIN_SCORE, scorePodcastStory, type PodcastCriterion } from '../supabase/functions/_shared/podcast-scoring.ts';

export const PODCAST_RECOMMENDATION_VERSION = 'podcast-main-v1';
export { PODCAST_RECOMMENDATION_MIN_SCORE };
export type TopicCriterion = PodcastCriterion;
export type RankedPodcastStory = { story: PodcastStory; score: number; criteria: TopicCriterion[]; stage: string; recommended: boolean };
export type PodcastMainChoice = { period: string; id: string };

function eligible(story: PodcastStory, start: string, end: string) {
  if (!uuid(story.id) || !validDay(story.officialDate) || story.officialDate < start || story.officialDate > end || !story.title.trim() || !story.details.trim()) return false;
  try {
    const url = new URL(story.officialUrl);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** An explainable editorial suggestion, not a measure of popularity or verified legal impact. */
export function rankPodcastStories(stories: PodcastStory[], start: string, end: string): RankedPodcastStory[] {
  if (!validDay(start) || !validDay(end) || start > end) return [];
  return stories.filter((story) => eligible(story, start, end)).map((story) => ({
    story,
    ...scorePodcastStory(story),
  })).sort((a, b) => b.score - a.score || b.story.officialDate.localeCompare(a.story.officialDate) || a.story.id.localeCompare(b.story.id));
}

export function recommendedPodcastStory(ranked: RankedPodcastStory[]) {
  return ranked.find((story) => story.recommended);
}

/** Preserve an explicit choice across refreshes. Missing selections never silently switch topics. */
export function resolvePodcastMain(ranked: RankedPodcastStory[], period: string, choice?: PodcastMainChoice) {
  if (choice?.period === period) return ranked.some((story) => story.story.id === choice.id) ? choice.id : '';
  return recommendedPodcastStory(ranked)?.story.id ?? ranked[0]?.story.id ?? '';
}
