export type WeeklyPriorityInput = {
  id: string;
  title: string;
  summary: string;
  details: string;
  date: string;
  documentType: string;
  topics: string[];
  jurisdictions: string[];
  source?: string;
  url?: string;
};

export type WeeklyPriorityCriterion = {
  label: string;
  points: number;
  max: number;
  reason: string;
};

export type WeeklyPriority = {
  score: number;
  criteria: WeeklyPriorityCriterion[];
  stage: string;
  change: number;
  scope: number;
  practical: number;
  depth: number;
  reasons: string[];
};

export const WEEKLY_PRIORITY_VERSION = 'weekly-priority-v2';
export const WEEKLY_PRIORITY_MAX_FINE_ITEMS = 2;
export const WEEKLY_PRIORITY_DEFAULT_SELECTION_SIZE = 8;

const patterns = {
  privacy: /개인정보|개인 데이터|정보주체|프라이버시|privacy|personal data|data protection|data subject/i,
  rights: /열람권|삭제권|동의|권리|자기정보|감시|프로파일링|right to|consent|surveillance/i,
  proposal: /초안|의견\s*(?:수렴|모집)|개정안|입법\s*예고|제안|발의|consultation|draft|proposal/i,
  enacted: /판결|판례|선고|판시|judgment|ruling|(?:법|규정|규칙).{0,20}(?:제정|개정|시행|채택|확정)|(?:제정|개정|시행|채택|확정).{0,20}(?:법|규정|규칙)|enacted|adopted/i,
  guidance: /지침|가이드라인|권고|기준|표준|guideline|guidance|standard|recommendation/i,
  enforcement: /과징금|과태료|벌금|제재|시정\s*명령|처리\s*금지|견책|집행|fine|penalty|sanction|enforcement/i,
  investigation: /조사\s*(?:개시|착수|결과)|점검|감사|investigation|inquiry|audit/i,
  research: /연구|보고서|분석|설문|통계|실태\s*조사|research|report|analysis|survey|study/i,
  korea: /대한민국|한국|한국의|국내|korea|south korea|\bkr\b/i,
  crossBorder: /국경\s*간|국외\s*이전|역외|국제\s*(?:협력|공조|협약)|cross.border|international transfer/i,
  operational: /의무|요건|절차|보유\s*기간|처리\s*근거|위험\s*평가|영향\s*평가|책임|고지|보호\s*조치|obligation|requirement|retention|risk assessment/i,
  sensitive: /민감\s*정보|건강\s*정보|생체\s*정보|유전\s*정보|신경\s*데이터|아동|청소년|취약\s*계층|sensitive|health data|biometric|genetic|children|vulnerable/i,
  broad: /대규모|수백만|수천만|전\s*산업|산업\s*전반|범용|시스템적|광범위|대형\s*플랫폼|systemic|millions|large.scale|industry.wide/i,
  harm: /유출|침해|무단\s*(?:열람|공개|이용)|피해|위험|breach|exposure|unauthorized|harm/i,
  policyLearning: /정책|제도|거버넌스|연구|보고서|기준|표준|권리|공익|policy|governance|research|report|standard|rights/i,
  concreteEvidence: /시행일|발효일|기한|제\s*\d+\s*조|\d+\s*(?:명|건|개국|억|만)|article\s+\d+|effective date|deadline/i,
  monetaryFine: /과징금|과태료|벌금|금전\s*제재|fine|monetary penalty|civil penalty/i,
};

const has = (pattern: RegExp, text: string) => pattern.test(text);

function scoreBreakdown(candidate: WeeklyPriorityInput) {
  const titleSummary = [candidate.title, candidate.summary, ...candidate.topics].join(' ').normalize('NFKC');
  const fullText = [titleSummary, candidate.details].join(' ').normalize('NFKC');
  const type = candidate.documentType.toLocaleLowerCase();

  const directPrivacy = has(patterns.privacy, fullText) || has(patterns.rights, fullText) ? 25 : 0;

  let changeStage = 0;
  let stage = '변화 유형 미확인';
  if (has(patterns.proposal, titleSummary)) {
    changeStage = 14;
    stage = '초안·제안·의견수렴';
  } else if (/^(legislation|judgment|decision)$/.test(type) || has(patterns.enacted, titleSummary)) {
    changeStage = 20;
    stage = '법·판단 확정';
  } else if (/^(guidance|standard)$/.test(type) || has(patterns.guidance, titleSummary)) {
    changeStage = 18;
    stage = '지침·표준·권고';
  } else if (/^(policy_report|opinion)$/.test(type)) {
    changeStage = 14;
    stage = '정책·의견 자료';
  } else if (has(patterns.enforcement, titleSummary)) {
    changeStage = 12;
    stage = '집행·제재';
  } else if (has(patterns.investigation, titleSummary)) {
    changeStage = 12;
    stage = '조사·점검';
  } else if (has(patterns.research, titleSummary)) {
    changeStage = 12;
    stage = '연구·분석';
  } else if (has(patterns.policyLearning, titleSummary)) {
    changeStage = 8;
    stage = '정책·제도 동향';
  }

  const koreaPracticality = has(patterns.korea, [titleSummary, ...candidate.jurisdictions].join(' '))
    ? 15
    : has(patterns.crossBorder, titleSummary) || has(patterns.operational, titleSummary) ? 8 : 0;

  const impactSeverity = Math.min(15,
    (has(patterns.sensitive, fullText) ? 7 : 0)
    + (has(patterns.broad, titleSummary) ? 5 : 0)
    + (has(patterns.harm, titleSummary) ? 3 : 0));

  const policyLearningScore = Math.min(15,
    (has(patterns.policyLearning, titleSummary) ? 8 : 0)
    + (has(patterns.proposal, titleSummary) || has(patterns.research, titleSummary) ? 7 : 0));

  const evidence = Math.min(10,
    (candidate.url?.startsWith('https://') ? 4 : 0)
    + (candidate.source?.trim() ? 2 : 0)
    + (candidate.details.trim().length >= 400 ? 2 : 0)
    + (has(patterns.concreteEvidence, fullText) ? 2 : 0));

  return { directPrivacy, changeStage, stage, koreaPracticality, impactSeverity, policyLearningScore, evidence };
}

export function isMonetaryFine(candidate: WeeklyPriorityInput) {
  return has(patterns.monetaryFine, [candidate.title, candidate.summary].join(' ').normalize('NFKC'));
}

/** Weekly selection uses its own six-part rubric; podcast-main-v1 remains unchanged. */
export function weeklyPriority(candidate: WeeklyPriorityInput): WeeklyPriority {
  const scored = scoreBreakdown(candidate);
  const criteria: WeeklyPriorityCriterion[] = [
    { label: '개인정보·권리 직접성', points: scored.directPrivacy, max: 25, reason: scored.directPrivacy ? '개인정보 처리 또는 정보주체 권리와 직접 연결됩니다.' : '제목·요약·본문에서 직접 연결 신호를 찾지 못했습니다.' },
    { label: '동향 단계', points: scored.changeStage, max: 20, reason: scored.stage },
    { label: '한국 관련성·실무성', points: scored.koreaPracticality, max: 15, reason: scored.koreaPracticality ? '한국 관련성, 국경 간 쟁점 또는 구체적인 처리 실무 신호가 있습니다.' : '한국 관련성이나 구체적인 실무 신호를 찾지 못했습니다.' },
    { label: '영향 범위·심각성', points: scored.impactSeverity, max: 15, reason: '민감정보·취약집단, 확산 범위, 실제 피해 신호를 반영합니다.' },
    { label: '정책·사회 학습 가치', points: scored.policyLearningScore, max: 15, reason: '정책·제도·연구·기준 형성에 주는 학습 가치를 반영합니다.' },
    { label: '원문·근거', points: scored.evidence, max: 10, reason: '공식 원문 링크, 출처 표기, 구체적 조항·기한·수치의 확인 수준을 반영합니다.' },
  ];
  const score = criteria.reduce((total, criterion) => total + criterion.points, 0);
  const reasons = [
    '총점 ' + score + '/100',
    ...criteria.filter((criterion) => criterion.points > 0).map((criterion) => criterion.label + ' ' + criterion.points + '/' + criterion.max),
  ];
  return {
    score,
    criteria,
    stage: scored.stage,
    change: scored.changeStage,
    scope: scored.impactSeverity,
    practical: scored.koreaPracticality,
    depth: scored.evidence,
    reasons,
  };
}

/**
 * The default eight-item selection is diversified after score ranking. If at
 * least six non-fine candidates exist, no more than two fine cases enter it.
 * Editors remain free to replace any item.
 */
export function rankWeeklyCandidates<T extends WeeklyPriorityInput>(candidates: T[]): T[] {
  const compare = (a: T, b: T) => weeklyPriority(b).score - weeklyPriority(a).score || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
  const sorted = [...candidates].sort(compare);
  const nonFine = sorted.filter((candidate) => !isMonetaryFine(candidate));
  const fine = sorted.filter(isMonetaryFine);
  const limit = WEEKLY_PRIORITY_DEFAULT_SELECTION_SIZE;
  const preferredNonFine = nonFine.slice(0, limit - WEEKLY_PRIORITY_MAX_FINE_ITEMS);
  const preferredFine = fine.slice(0, Math.min(WEEKLY_PRIORITY_MAX_FINE_ITEMS, limit - preferredNonFine.length));
  const preferred = [...preferredNonFine, ...preferredFine].sort(compare);
  const preferredIds = new Set(preferred.map((candidate) => candidate.id));
  return [...preferred, ...sorted.filter((candidate) => !preferredIds.has(candidate.id))];
}
