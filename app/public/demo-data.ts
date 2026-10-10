export type Story = { id: string; country: string; region: string; institution: string; title: string; summary: string; kind: string; tags: string[]; date: string };
export const stories: Story[] = [
  { id: "sample-1", country: "EU", region: "유럽연합", institution: "EDPB", title: "아동의 개인정보를 다루는 온라인 서비스", summary: "연령 확인과 아동 대상 서비스 설계에서 고려할 보호 원칙을 검토하는 예시 자료입니다.", kind: "가이드라인", tags: ["아동", "온라인 안전", "설계 단계"], date: "2026.10.08" },
  { id: "sample-2", country: "일본", region: "일본", institution: "PPC", title: "아동 관련 정보 처리와 사업자의 보호 조치", summary: "아동의 정보가 수집·이용되는 과정에서 사업자가 살펴볼 쟁점을 정리한 예시 자료입니다.", kind: "감독기구 발표", tags: ["아동", "사업자 의무"], date: "2026.10.02" },
  { id: "sample-3", country: "영국", region: "영국", institution: "ICO", title: "연령에 적합한 온라인 서비스 설계", summary: "온라인 서비스의 기본 설정과 아동 이용자 보호를 다룬 예시 자료입니다.", kind: "규제기관 지침", tags: ["아동", "기본 설정", "온라인 안전"], date: "2026.09.27" },
  { id: "sample-4", country: "미국", region: "미국", institution: "FTC", title: "아동 대상 서비스의 데이터 수집 원칙", summary: "서비스가 아동의 개인정보를 수집할 때 확인할 수 있는 항목을 담은 예시 자료입니다.", kind: "정부기관 발표", tags: ["아동", "수집 제한"], date: "2026.09.19" },
  { id: "sample-5", country: "OECD", region: "국제기구", institution: "OECD", title: "아동의 디지털 환경과 개인정보 보호", summary: "아동의 권리와 데이터 보호를 함께 살펴보는 국제 정책 자료의 예시입니다.", kind: "정책 자료", tags: ["아동", "국제 기준"], date: "2026.09.12" },
  { id: "sample-6", country: "EU", region: "유럽연합", institution: "CURIA", title: "온라인 서비스와 개인정보 처리에 관한 판례 검색", summary: "온라인 서비스의 개인정보 처리와 관련된 판례를 찾아볼 때의 화면 예시입니다.", kind: "판례", tags: ["온라인 서비스", "법원"], date: "2026.09.05" },
];

