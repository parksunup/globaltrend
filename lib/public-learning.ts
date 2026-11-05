/** Reading prompts, not conclusions about any person's legal obligations. */
export type LearningTopic = {
  id: string; question: string; introduction: string; criterion: string; criterionLabel: string;
  countries: string[]; search: string; terms: string[];
  relevance: string; questions: string[];
};
export const learningTopics: LearningTopic[] = [
  {
    id:'overseas-services',question:'해외 서비스도 한국법의 적용을 받나요?',
    introduction:'서비스를 제공하는 곳과 개인정보를 처리하는 곳이 다를 때, 어느 법의 적용 요건을 확인해야 하는지 살펴봅니다.',
    criterion:'extraterritorial_scope',criterionLabel:'역외 적용',countries:['KR','EU','JP'],search:'역외 적용',
    terms:['역외','해외사업자','해외 사업자','extraterritorial','territorial scope'],
    relevance:"해외 서비스의 개인정보 보호 규정과 적용 조건, 문의 창구를 함께 살펴볼 수 있습니다.",
    questions:["서비스 이용자·사업장·개인정보 처리 활동은 어느 국가·지역과 연결되나요?", "재화·서비스 제공이나 행동 분석에 관한 적용 요건과 예외는 무엇인가요?", "개인정보 처리방침에서 적용 법률과 연락 창구를 확인할 수 있나요?", "해외사업자에 대한 법 적용과 개인정보 국외이전은 어떻게 구별하나요?"],
  },
  {
    id:'children',question:'아이의 개인정보는 어떻게 보호하나요?',
    introduction:'아동의 개인정보를 다룰 때 확인할 연령 기준, 동의와 별도 보호 내용을 국가별로 살펴봅니다.',
    criterion:'children_information',criterionLabel:'아동 개인정보',countries:['KR','EU','US-CA'],search:'아동',
    terms:['아동','청소년','미성년','어린이','children','child','minor'],
    relevance:"아동이 이용하는 서비스의 개인정보 안내와 보호 절차를 살펴볼 수 있습니다.",
    questions:["해당 국가의 아동 연령 기준과 서비스 이용자의 범위는 무엇인가요?", "수집하는 정보·이용 목적·서비스 설정은 어디에서 확인하나요?", "보호자 확인·동의와 아동 대상 안내에는 어떤 조건이 있나요?", "관련 조항의 적용 범위와 예외, 문의 절차는 무엇인가요?"],
  },
  {
    id:'international-transfers',question:'개인정보가 해외로 가면 무엇을 확인하나요?',
    introduction:'정보를 받는 곳, 처리 목적과 국가를 확인하고 국외이전의 근거와 보호조치를 비교합니다.',
    criterion:'cross_border_transfer',criterionLabel:'국외이전',countries:['KR','EU','SG'],search:'국외이전',
    terms:['국외이전','국외 이전','해외 이전','국제 이전','cross-border','cross border','international transfer','적정성'],
    relevance:"개인정보가 해외로 제공·보관·위탁되는 구조와 보호 내용을 함께 살펴봅니다.",
    questions:["어느 국가의 누구에게, 어떤 목적으로 이전하며 보유기간과 재이전 경로는 무엇인가요?", "해당 법의 이전 근거와 예외 중 무엇을 확인해야 하나요?", "이전 안내·선택 절차와 문의 창구는 어디에 있나요?", "계약과 보호조치의 내용을 확인할 자료가 있나요?"],
  },
  {
    id:'rights',question:'내 정보를 열람하거나 삭제해 달라고 할 수 있나요?',
    introduction:'정보주체가 행사할 수 있는 권리와 그 조건·제한을 비교하고, 관련 조문을 찾아봅니다.',
    criterion:'data_subject_rights',criterionLabel:'정보주체 권리',countries:['KR','EU','JP'],search:'정보주체 권리',
    terms:['열람','삭제','정정','전송요구','이동권','정보주체 권리','data subject right','erasure','access request'],
    relevance:"개인정보에 관한 요청의 종류와 행사 조건, 처리 절차를 함께 살펴봅니다.",
    questions:["요청하려는 권리는 열람·정정·삭제·이동 중 무엇이며 대상 정보는 무엇인가요?", "요청 창구와 본인 확인 방법은 어디에 안내되어 있나요?", "처리 기한·회신 절차와 권리 행사의 조건·제한은 무엇인가요?", "요청 처리 결과나 제한 사유는 어떻게 기록하고 안내하나요?"],
  },
  {
    id:'ai-and-data',question:'AI 서비스가 내 개인정보를 이용할 때 무엇을 보나요?',
    introduction:'AI 서비스의 개인정보 이용 목적과 처리근거를 살펴봅니다. 이 안내의 비교 범위는 개인정보 보호법제입니다.',
    criterion:'processing_basis_use',criterionLabel:'처리근거 — 이용',countries:['KR','EU','JP'],search:'인공지능',
    terms:['인공지능','생성형','파운데이션 모델','자동화된 의사결정','프로파일링','artificial intelligence','generative ai','ai act','ai'],
    relevance:"AI 서비스에서 개인정보가 어떤 목적으로 이용되는지 확인할 수 있습니다.",
    questions:["입력·학습·출력 단계에서 어떤 개인정보를 어떤 목적으로 이용하나요?", "서비스 제공과 그 밖의 이용 목적을 구별하고, 목적별 처리근거와 추가 이용 조건을 확인할 수 있나요?", "이용에 관한 선택과 문의 창구는 어디에 있나요?", "민감정보·아동·국외이전 등 함께 살펴볼 사항이 있나요?"],
  },
  {
    id:'breaches',question:'개인정보 유출 소식을 들으면 무엇을 확인하나요?',
    introduction:'유출 등의 통지·신고에 관한 국가별 조건을 살펴보고, 관련 기관의 공식 발표를 확인합니다.',
    criterion:'breach_notification',criterionLabel:'유출 등의 통지·신고',countries:['KR','EU','SG'],search:'개인정보 유출',
    terms:['유출','침해사고','침해 사고','breach','notification'],
    relevance:"유출 소식의 범위와 후속 안내, 통지·신고 조건을 함께 살펴봅니다.",
    questions:["공식 발표에서 확인되는 사고 유형·인지 시점·영향받은 정보의 범위는 무엇인가요?", "정보주체 통지와 감독기관 신고의 조건·기한은 각각 무엇인가요?", "안내된 대응 방법·문의 창구와 예외 판단의 근거는 무엇인가요?", "처음 발표한 뒤 정정이나 추가 안내가 나왔나요?"],
  },
];
export const learningCountries = ['KR','JP','CN','EU','GB','US-CA','SG'];
export function learningTopic(id?: string): LearningTopic { return learningTopics.find(topic=>topic.id===id)??learningTopics[0]; }
export function learningCountriesFor(values: string[] | undefined, fallback: string[]): string[] {
  const valid=[...new Set(values?.filter(value=>learningCountries.includes(value))??[])];
  return valid.length?valid:fallback;
}
export function learningHref(topicId: string, countries?: string[]): string {
  const params=new URLSearchParams({topic:learningTopic(topicId).id});
  for(const code of countries??[])if(learningCountries.includes(code))params.append('country',code);
  return `/public/explore?${params}`;
}
export function learningComparisonHref(topic: LearningTopic, countries=topic.countries): string {
  return `/public/laws?${new URLSearchParams({view:'compare',countries:learningCountriesFor(countries,topic.countries).join(','),criterion:topic.criterion})}`;
}
function matchesTerm(text:string,term:string):boolean { return term==='ai'?/\bai\b/.test(text):text.includes(term); }
export function matchedLearningTopics(story: {title:string;summary:string;tags:string[]}): LearningTopic[] {
  const title=story.title.toLocaleLowerCase(),tags=story.tags.join(' ').toLocaleLowerCase(),summary=story.summary.toLocaleLowerCase();
  return learningTopics.map((topic,index)=>({topic,index,score:topic.terms.reduce((score,term)=>score+(matchesTerm(title,term)?3:0)+(matchesTerm(tags,term)?2:0)+(matchesTerm(summary,term)?1:0),0)}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(item=>item.topic);
}
