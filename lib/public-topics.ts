export type PublicTopic = { id: string; label: string; terms: string[] };

export const publicTopics: PublicTopic[] = [
  { id: "ai", label: "인공지능과 개인정보", terms: ["인공지능", "AI", "생성형AI", "기초모델", "추천시스템", "AI모델공유"] },
  { id: "rights", label: "정보주체 권리", terms: ["정보주체권리", "삭제권", "열람권", "권리구제", "민원", "손해배상"] },
  { id: "children", label: "아동·청소년", terms: ["아동", "아동정보", "학생정보", "청소년"] },
  { id: "security", label: "유출·보안", terms: ["개인정보유출", "보안", "물리적보안", "침해통지", "안전관리"] },
  { id: "sensitive", label: "민감정보·생체정보", terms: ["민감정보", "생체정보", "건강정보", "신경데이터", "음성정보"] },
  { id: "transfer", label: "국외 이전", terms: ["국외이전", "국외 이전", "국제 이전", "역외 이전"] },
  { id: "enforcement", label: "법 집행·과징금", terms: ["과징금", "집행", "취소소송", "규제협력", "공동집행"] },
  { id: "governance", label: "데이터 관리", terms: ["데이터거버넌스", "데이터최소화", "보유기간", "익명화", "투명성", "DPIA", "쿠키", "처리자"] },
];

export function matchesPublicTopic(tags: string[], topicId: string): boolean {
  const topic = publicTopics.find((item) => item.id === topicId);
  if (!topic) return false;
  const normalizedTags = tags.map((tag) => tag.replaceAll(/\s/g, "").toLocaleLowerCase());
  return topic.terms.some((term) => normalizedTags.includes(term.replaceAll(/\s/g, "").toLocaleLowerCase()));
}
