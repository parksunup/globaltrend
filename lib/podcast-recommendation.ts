import {validDay,uuid,type PodcastStory} from './podcast-production.ts';

export const PODCAST_RECOMMENDATION_VERSION='podcast-main-v1';
export const PODCAST_RECOMMENDATION_MIN_SCORE=65;
export type TopicCriterion={label:string;points:number;max:number;reason:string};
export type RankedPodcastStory={story:PodcastStory;score:number;criteria:TopicCriterion[];stage:string;recommended:boolean};
export type PodcastMainChoice={period:string;id:string};
const changePatterns={
 proposal:/초안|의견\s*(?:수렴|모집)|법률?안|개정안|입법\s*예고|제안|발의|draft|consultation/i,
 judgment:/판결|선고|판시|judgment|ruling/i,
 law:/(?:법률?|규정|법령|제도).{0,25}(?:제정|개정|시행|채택|확정)|(?:제정|개정|시행).{0,25}(?:법률?|규정|법령)|adopted regulation|enacted/i,
 guidance:/(?:지침|가이드라인|판단\s*기준).{0,25}(?:발표|채택|확정|변경|수립)|(?:발표|채택|확정|변경).{0,25}(?:지침|가이드라인|판단\s*기준)/,
 enforcement:/시정\s*명령|처리\s*금지|과징금|제재|집행|조사\s*개시|enforcement|fine/i,
 response:/촉구|권고|개선\s*요구|조치\s*요구/,
 analysis:/(?:보고서|정책\s*분석).{0,20}(?:발표|발간|공개|소개)|(?:발표|발간|공개).{0,20}(?:보고서|정책\s*분석)/
};

function hit(text:string,pattern:RegExp){return text.match(pattern)?.[0];}
function eligible(story:PodcastStory,start:string,end:string){
 if(!uuid(story.id)||!validDay(story.officialDate)||story.officialDate<start||story.officialDate>end||!story.title.trim()||!story.details.trim())return false;
 try{const url=new URL(story.officialUrl);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}

/** An explainable editorial suggestion, not a measure of popularity or verified legal impact. */
export function rankPodcastStories(stories:PodcastStory[],start:string,end:string):RankedPodcastStory[]{
 if(!validDay(start)||!validDay(end)||start>end)return [];
 return stories.filter(s=>eligible(s,start,end)).map(story=>{
  const lead=(story.title+' '+story.summary).normalize('NFKC');
  const changeText=Object.values(changePatterns).some(p=>p.test(story.title))?story.title:lead;
  let change=0,stage='변화 유형 미확인',changeReason='제목·요약에서 구체적인 제도·판단 변화 신호를 찾지 못했습니다.';
  const proposal=hit(changeText,changePatterns.proposal);
  const judgment=hit(changeText,changePatterns.judgment);
  const law=hit(changeText,changePatterns.law);
  const guidance=hit(changeText,changePatterns.guidance);
  const enforcement=hit(changeText,changePatterns.enforcement);
  const response=hit(changeText,changePatterns.response),analysis=hit(changeText,changePatterns.analysis);
  if(proposal){change=22;stage='초안·제안·의견수렴';changeReason=`제목·요약의 ‘${proposal}’ 신호: 확정·시행과 구분합니다.`;}
  else if(judgment){change=35;stage='법원 판단';changeReason=`제목·요약에 ‘${judgment}’이 있어 해석·판단 변화 후보로 봅니다. 본안 여부는 원고를 확인해야 합니다.`;}
  else if(law){change=35;stage='법제 변화';changeReason=`제목·요약의 ‘${law}’ 신호를 확인했습니다.`;}
  else if(guidance){change=28;stage='지침·판단 기준';changeReason=`제목·요약의 ‘${guidance}’ 신호를 확인했습니다.`;}
  else if(enforcement){change=25;stage='집행·제재';changeReason=`제목·요약의 ‘${enforcement}’ 신호입니다. 금액 크기만으로 가점을 주지 않습니다.`;}
  else if(response){change=20;stage='대응·권고';changeReason=`제목·요약의 ‘${response}’ 신호입니다. 법적 의무의 신설로 단정하지 않습니다.`;}
  else if(analysis){change=18;stage='정책 분석·보고서';changeReason=`제목·요약의 ‘${analysis}’ 신호입니다. 분석 결과와 확정된 의무를 구분합니다.`;}
  const international=hit(lead,/국경\s*간|국외\s*이전|역외|국제\s*(?:협력|공조|협약)|cross.border/i);
  const general=hit(lead,/모든\s*(?:기업|사업자|기관|이용자)|전\s*산업|전\s*분야|전반|공통\s*(?:기준|의무)|범용|유럽연합\s*전체/);
  const multiple=hit(lead,/대규모|대형\s*플랫폼|주요.{0,16}(?:개발사|사업자|플랫폼)|(?:개발사|사업자)\s*\d+\s*곳/);
  const scope=change?(international?25:general?20:multiple?15:0):0;
  const practical=change?hit(lead,/국외\s*이전|정보주체|삭제|열람|동의|적법\s*(?:근거|성)|처리\s*(?:근거|금지)|보유\s*기간|아동|민감\s*정보|생체\s*정보|신경\s*데이터|안전\s*(?:관리|조치)|보호\s*조치|위험\s*평가|영향\s*평가|인공지능|파운데이션\s*모델|에이전트\s*AI|AI\s*모델/i):undefined;
  const details=story.details.normalize('NFKC');
  const substantial=details.trim().length>=400;
  const conditions=hit(details,/예외|조건|적용\s*(?:대상|범위)|제외|한정|요건/);
  const explanation=hit(details,/기존|종전|배경|후속|시행일|기한|절차|제\s*\d+\s*조/);
  const depth=(substantial?5:0)+(conditions?5:0)+(explanation?5:0);
  const criteria:TopicCriterion[]=[
   {label:'제도·판단 변화',points:change,max:35,reason:changeReason},
   {label:'영향 범위',points:scope,max:25,reason:scope?`제목·요약의 ‘${international??general??multiple}’ 신호입니다. 실제 적용 범위는 원고를 확인해야 합니다.`:'범위가 넓다는 명시적 신호가 없어 가점하지 않았습니다.'},
   {label:'실무 관련성',points:practical?25:0,max:25,reason:practical?`변화 신호와 함께 ‘${practical}’ 쟁점을 확인했습니다.`:'권리·처리 실무와 연결되는 구체적 신호가 부족합니다.'},
   {label:'설명할 근거의 충분함',points:depth,max:15,reason:[substantial?'본문 설명량 확보':null,conditions?`‘${conditions}’ 설명`:null,explanation?`‘${explanation}’ 설명`:null].filter(Boolean).join(' · ')||'심층 설명에 필요한 본문 신호가 부족합니다.'}
  ];
  const score=criteria.reduce((n,c)=>n+c.points,0);
  return {story,criteria,score,stage,recommended:score>=PODCAST_RECOMMENDATION_MIN_SCORE&&depth>=10&&(change>=28||scope>=15)};
 }).sort((a,b)=>b.score-a.score||b.story.officialDate.localeCompare(a.story.officialDate)||a.story.id.localeCompare(b.story.id));
}

export function recommendedPodcastStory(ranked:RankedPodcastStory[]){return ranked.find(s=>s.recommended);}

/** Preserve an explicit choice across refreshes. Missing selections never silently switch topics. */
export function resolvePodcastMain(ranked:RankedPodcastStory[],period:string,choice?:PodcastMainChoice){
 if(choice?.period===period)return ranked.some(r=>r.story.id===choice.id)?choice.id:'';
 return recommendedPodcastStory(ranked)?.story.id??'';
}
