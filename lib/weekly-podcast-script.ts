import {loadWeeklySample} from "./weekly-sample";

export type PodcastTurn = {speaker: "Mina" | "Joon"; text: string};

/** Handwritten sample script: TTS only voices verified notes; Gemini does not draft facts. */
export function buildWeeklyPodcastScript() {
  const issue = loadWeeklySample();
  const storyCount = issue.issue.contents.length;
  const turns: PodcastTurn[] = [
    {
      speaker: "Mina",
      text: `안녕하세요. 글로벌트렌드 주간 브리핑입니다. 오늘은 개인정보 보호와 관련된 해외 동향 ${storyCount}건을 살펴봅니다. 여러 시기의 자료를 묶은 제작 테스트 예시이며, 실제 한 주의 발행호는 아닙니다.`,
    },
    {
      speaker: "Joon",
      text: "네. 발표나 판결의 핵심을 확인하고, 각 자료에 담긴 내용을 차례로 짚어보겠습니다.",
    },
  ];

  for (const [index, item] of issue.issue.contents.entries()) {
    const ordinal = index + 1;
    turns.push({
      speaker: "Mina",
      text: `${ordinal}번째 소식입니다. ${item.title}. ${item.leadSummary} 자세한 내용도 함께 살펴보겠습니다.`,
    });
    turns.push({
      speaker: "Joon",
      text: `${item.bodyPoints.map(point => point.text).join(" ")} 원문과 상세 내용은 해당 동향 자료에서 확인하실 수 있습니다.`,
    });
  }

  turns.push({
    speaker: "Mina",
    text: `오늘 준비한 예시 동향 ${storyCount}건을 살펴봤습니다. 이 콘텐츠는 실제 주간 발행물이 아닌 제작 테스트 자료입니다. 들어주셔서 감사합니다.`,
  });

  return {
    title: "개인정보 주간 동향 팟캐스트 제작 테스트",
    notice: `예시 동향 ${storyCount}건으로 만든 제작 테스트입니다. 실제 주간호나 공식 발행물로 인용하지 마세요.`,
    turns,
  };
}
