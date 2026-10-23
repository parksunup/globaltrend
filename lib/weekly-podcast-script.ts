import { loadWeeklySample } from "./weekly-sample";

export type PodcastTurn={speaker:"Mina"|"Joon";text:string};
/** Handwritten sample script: TTS only voices these verified sample notes; it never drafts facts. */
export function buildWeeklyPodcastScript(){
 const issue=loadWeeklySample();
 const turns:PodcastTurn[]=[
  {speaker:"Mina",text:"안녕하세요. 글로벌트렌드 주간 브리핑입니다. 오늘은 개인정보 보호와 관련된 해외 동향 일곱 건을 살펴봅니다. 여러 시기의 자료를 묶은 제작 테스트 예시이며, 실제 한 주의 발행호는 아닙니다."},
  {speaker:"Joon",text:"네. 각 소식의 핵심과 개인정보 보호 측면의 의미를 차례로 짚어보겠습니다."}
 ];
 for(const item of issue.issue.contents){
  turns.push({speaker:"Mina",text:`먼저 ${item.organization} 소식입니다. ${item.title}. ${item.leadSummary}`});
  turns.push({speaker:"Joon",text:`${item.bodyPoints.map(point=>point.text).join(" ")} 이 자료의 원문과 상세 내용은 주간 동향 예시 페이지에서 확인하실 수 있습니다.`});
 }
 turns.push({speaker:"Mina",text:"오늘 준비한 예시 동향 일곱 건을 살펴봤습니다. 이 콘텐츠는 실제 주간 발행물이 아닌 테스트 자료입니다. 들어주셔서 감사합니다."});
 return {title:"개인정보 주간 동향 팟캐스트 제작 테스트",notice:"예시 자료 7건으로 만든 비공개 제작 테스트입니다. 실제 주간호나 공식 발행물로 인용하지 마세요.",turns};
}
