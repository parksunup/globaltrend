/** Reading prompts, not conclusions about any person's legal obligations. */
export type LearningAudience = 'everyday' | 'work';
export type LearningTopic = {
  id: string; question: string; introduction: string; criterion: string; criterionLabel: string;
  countries: string[]; search: string; terms: string[];
  everyday: { relevance: string; questions: string[] };
  work: { relevance: string; questions: string[] };
};
export const learningTopics: LearningTopic[] = [
  {
    id:'overseas-services',question:'해외 서비스도 한국법의 적용을 받나요?',
    introduction:'서비스를 제공하는 곳과 개인정보를 처리하는 곳이 다를 때, 어느 법의 적용 요건을 확인해야 하는지 살펴봅니다.',
    criterion:'extraterritorial_scope',criterionLabel:'역외 적용',countries:['KR','EU','JP'],search:'역외 적용',
    terms:['역외','해외사업자','해외 사업자','extraterritorial','territorial scope'],
    everyday:{relevance:'해외 서비스를 이용할 때 적용되는 보호 규정과 문의 창구를 찾아보는 데 도움이 됩니다.',questions:['서비스를 이용하는 나라와 사업자가 있는 나라는 어디인가요?','개인정보 처리방침에서 적용 법률과 연락 창구를 확인할 수 있나요?','해외사업자에 대한 법 적용과 개인정보 국외이전은 어떻게 다른가요?']},
    work:{relevance:'해외 이용자를 대상으로 서비스를 제공할 때 확인할 법제의 범위를 정리할 수 있습니다.',questions:['대상 이용자·사업장·처리 활동은 어느 국가·지역과 연결되나요?','재화·서비스 제공이나 행동 분석에 관한 적용 요건이 해당 법에 있나요?','국가별 적용 조건과 예외를 뒷받침할 사실관계는 확보했나요?']},
  },
  {
    id:'children',question:'아이의 개인정보는 어떻게 보호하나요?',
    introduction:'아동의 개인정보를 다룰 때 확인할 연령 기준, 동의와 별도 보호 내용을 국가별로 살펴봅니다.',
    criterion:'children_information',criterionLabel:'아동 개인정보',countries:['KR','EU','US-CA'],search:'아동',
    terms:['아동','청소년','미성년','어린이','children','child','minor'],
    everyday:{relevance:'자녀가 이용하는 서비스의 개인정보 안내를 읽고 확인할 질문을 정리할 수 있습니다.',questions:['해당 법에서 아동을 판단하는 연령 기준은 무엇인가요?','보호자에게 어떤 설명과 동의 절차를 제공하나요?','수집하는 정보와 서비스 설정을 어디서 확인할 수 있나요?']},
    work:{relevance:'아동 이용자가 있는 서비스의 안내·동의·보호 절차를 점검할 때 참고할 수 있습니다.',questions:['대상 국가의 연령 기준과 서비스 이용자의 범위를 확인했나요?','보호자 확인·동의와 아동 대상 안내에 필요한 요건은 무엇인가요?','해당 조항의 적용 대상과 예외가 서비스에 어떻게 관련되나요?']},
  },
  {
    id:'international-transfers',question:'개인정보가 해외로 가면 무엇을 확인하나요?',
    introduction:'정보를 받는 곳, 처리 목적과 국가를 확인하고 국외이전의 근거와 보호조치를 비교합니다.',
    criterion:'cross_border_transfer',criterionLabel:'국외이전',countries:['KR','EU','SG'],search:'국외이전',
    terms:['국외이전','국외 이전','해외 이전','국제 이전','cross-border','cross border','international transfer','적정성'],
    everyday:{relevance:'해외 업체나 클라우드를 이용하는 서비스의 개인정보 안내를 읽는 데 도움이 됩니다.',questions:['내 정보가 어느 나라의 누구에게 전달되거나 보관되나요?','이전 목적과 보유기간, 문의 창구를 확인할 수 있나요?','이전에 관한 안내와 선택 절차는 어디에서 확인하나요?']},
    work:{relevance:'해외 제공·보관·위탁의 처리 구조와 관련 근거를 정리할 때 활용할 수 있습니다.',questions:['이전받는 자, 국가, 처리 목적과 재이전 경로를 파악했나요?','해당 법의 이전 근거와 예외 중 무엇을 검토해야 하나요?','계약·보호조치·정보주체 안내를 뒷받침할 자료가 있나요?']},
  },
  {
    id:'rights',question:'내 정보를 열람하거나 삭제해 달라고 할 수 있나요?',
    introduction:'정보주체가 행사할 수 있는 권리와 그 조건·제한을 비교하고, 관련 조문을 찾아봅니다.',
    criterion:'data_subject_rights',criterionLabel:'정보주체 권리',countries:['KR','EU','JP'],search:'정보주체 권리',
    terms:['열람','삭제','정정','전송요구','이동권','정보주체 권리','data subject right','erasure','access request'],
    everyday:{relevance:'개인정보에 관한 요청을 하기 전에 확인할 내용과 문의 절차를 정리할 수 있습니다.',questions:['원하는 요청은 열람·정정·삭제·이동 중 무엇인가요?','요청을 받는 창구와 본인 확인 방법은 어디에 안내되어 있나요?','해당 법에서 인정하는 조건과 제한은 무엇인가요?']},
    work:{relevance:'정보주체 요청을 접수하고 처리하는 절차의 검토 기준을 찾아볼 수 있습니다.',questions:['요청받은 권리의 대상 정보와 적용 조건은 무엇인가요?','기한·본인 확인·회신 절차와 예외를 확인했나요?','요청 처리와 제한 사유를 어떻게 기록하고 안내하나요?']},
  },
  {
    id:'ai-and-data',question:'AI 서비스가 내 개인정보를 이용할 때 무엇을 보나요?',
    introduction:'AI 서비스의 개인정보 이용 목적과 처리근거를 살펴봅니다. 이 안내의 비교 범위는 개인정보 보호법제입니다.',
    criterion:'processing_basis_use',criterionLabel:'처리근거 — 이용',countries:['KR','EU','JP'],search:'인공지능',
    terms:['인공지능','생성형','파운데이션 모델','자동화된 의사결정','프로파일링','artificial intelligence','generative ai','ai act','ai'],
    everyday:{relevance:'AI 서비스에 입력한 정보가 어떤 목적으로 이용되는지 확인할 질문을 제공합니다.',questions:['어떤 개인정보를 어떤 목적으로 이용한다고 설명하나요?','서비스 제공과 그 밖의 이용 목적을 구별해서 안내하나요?','이용에 관한 선택과 문의 창구는 어디에 있나요?']},
    work:{relevance:'AI 도입 과정에서 개인정보 이용의 목적·근거·범위를 정리할 때 참고할 수 있습니다.',questions:['입력·학습·출력 단계에서 개인정보가 어떻게 이용되나요?','처리 목적별 근거와 추가 이용 조건을 확인했나요?','민감정보·아동·국외이전 등 함께 검토할 사항이 있나요?']},
  },
  {
    id:'breaches',question:'개인정보 유출 소식을 들으면 무엇을 확인하나요?',
    introduction:'유출 등의 통지·신고에 관한 국가별 조건을 살펴보고, 관련 기관의 공식 발표를 확인합니다.',
    criterion:'breach_notification',criterionLabel:'유출 등의 통지·신고',countries:['KR','EU','SG'],search:'개인정보 유출',
    terms:['유출','침해사고','침해 사고','breach','notification'],
    everyday:{relevance:'유출 안내를 받았을 때 사건의 범위와 후속 안내를 확인하는 데 도움이 됩니다.',questions:['어떤 정보가 영향을 받았다고 공식적으로 안내하나요?','사업자가 안내한 대응 방법과 문의 창구는 무엇인가요?','발표일 이후 정정이나 추가 안내가 나왔나요?']},
    work:{relevance:'사고 대응 과정에서 통지와 신고의 검토 항목을 구별해 볼 수 있습니다.',questions:['사고의 유형·범위·인지 시점을 확인했나요?','정보주체 통지와 감독기관 신고의 조건·기한은 각각 무엇인가요?','예외 판단과 후속 안내를 뒷받침하는 기록이 있나요?']},
  },
];
export const learningCountries = ['KR','JP','CN','EU','GB','US-CA','SG'];
export function learningAudience(value?: string): LearningAudience { return value === 'work' ? 'work' : 'everyday'; }
export function learningTopic(id?: string): LearningTopic { return learningTopics.find(topic=>topic.id===id)??learningTopics[0]; }
export function learningCountriesFor(values: string[] | undefined, fallback: string[]): string[] {
  const valid=[...new Set(values?.filter(value=>learningCountries.includes(value))??[])];
  return valid.length?valid:fallback;
}
export function learningHref(topicId: string, audience: LearningAudience='everyday', countries?: string[]): string {
  const params=new URLSearchParams({topic:learningTopic(topicId).id,audience});
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
