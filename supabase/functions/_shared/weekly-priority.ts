import { scorePodcastStory, type PodcastScore } from './podcast-scoring.ts';

export type WeeklyPriorityInput = {
  id: string;
  title: string;
  summary: string;
  details: string;
  date: string;
  documentType: string;
  topics: string[];
  jurisdictions: string[];
};

export type WeeklyPriority = Omit<PodcastScore, 'recommended'> & { reasons: string[] };

/** Weekly selection and podcast recommendations share the exact podcast-main-v1 points. */
export function weeklyPriority(candidate: WeeklyPriorityInput): WeeklyPriority {
  const scored = scorePodcastStory(candidate);
  return {
    score: scored.score,
    criteria: scored.criteria,
    stage: scored.stage,
    change: scored.change,
    scope: scored.scope,
    practical: scored.practical,
    depth: scored.depth,
    reasons: [
      `${scored.score}점`,
      `제도·판단 변화 ${scored.change}/35`,
      `영향 범위 ${scored.scope}/25`,
      `실무 관련성 ${scored.practical}/25`,
      `설명 근거 ${scored.depth}/15`,
    ],
  };
}

export function rankWeeklyCandidates<T extends WeeklyPriorityInput>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => weeklyPriority(b).score - weeklyPriority(a).score || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
