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

const criteria = [
  {label:'법·정책 변경', points:5, type:/^(legislation|guidance|policy_report|opinion)$/, words:/법률|법안|시행|개정|규정|규제|정책|가이드라인|지침|기준|legislation|regulation|policy|guideline/i},
  {label:'중요 판결·집행', points:4, type:/^(judgment|decision)$/, words:/판결|판례|결정|제재|과징금|시정|조사 결과|court|judgment|enforcement|fine/i},
  {label:'개인정보 처리 영향', points:3, type:/^$/, words:/개인정보|개인 데이터|정보주체|프라이버시|동의|유출|감시|personal data|privacy|data protection|consent|breach/i},
  {label:'국경 간·신기술 쟁점', points:2, type:/^$/, words:/국경|역외|국제 이전|인공지능|생성형|생체|아동|cross.border|transfer|artificial intelligence|biometric|children/i},
];

export function weeklyPriority(candidate:WeeklyPriorityInput){
  const text=[candidate.title,candidate.summary,candidate.details,...candidate.topics].join(' ');
  const reasons=criteria.filter(rule=>rule.type.test(candidate.documentType)||rule.words.test(text)).map(rule=>rule.label);
  const score=criteria.filter(rule=>reasons.includes(rule.label)).reduce((total,rule)=>total+rule.points,0);
  return {score,reasons:reasons.length?reasons:['이번 주 동향 후보']};
}

export function rankWeeklyCandidates<T extends WeeklyPriorityInput>(candidates:T[]):T[]{
  return [...candidates].sort((a,b)=>weeklyPriority(b).score-weeklyPriority(a).score || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
