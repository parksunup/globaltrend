export type ReviewStatus = "unreviewed" | "in_review" | "approved" | "rejected" | "published";
export type ReviewKind = "sources" | "laws" | "criteria";

export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  title: string;
  subtitle: string;
  description: string;
  status: ReviewStatus;
  url?: string;
  metadata: string[];
  note: string;
  reviewNote?: string;
  reviewedAt?: string;
};

export const kindLabels: Record<ReviewKind, string> = {
  sources: "수집 출처",
  laws: "법제 목록",
  criteria: "비교 기준"
};

export const statusLabels: Record<ReviewStatus | "all", string> = {
  all: "전체",
  unreviewed: "검수 전",
  in_review: "검수 중",
  approved: "승인",
  rejected: "반려",
  published: "공개"
};

const sourceItems: ReviewItem[] = [
  { id: "edpb", kind: "sources", title: "EDPB 뉴스·보도자료", subtitle: "European Data Protection Board", description: "유럽 데이터보호이사회의 공식 뉴스와 보도자료를 수집합니다.", status: "unreviewed", url: "https://www.edpb.europa.eu/news_en", metadata: ["국제기구", "HTML 수집"], note: "robots.txt와 페이지 구조를 확인한 뒤 수집기를 연결합니다." },
  { id: "oecd", kind: "sources", title: "OECD 개인정보·데이터 보호", subtitle: "Organisation for Economic Co-operation and Development", description: "OECD의 개인정보·데이터 보호 주제 자료를 수집합니다.", status: "in_review", url: "https://www.oecd.org/en/topics/privacy-and-data-protection.html", metadata: ["국제기구", "HTML 수집"], note: "주제 페이지에서 관련 문서 링크를 추출하는 방식으로 검토 중입니다." },
  { id: "curia", kind: "sources", title: "CJEU/CURIA 보도자료·판결 안내", subtitle: "Court of Justice of the European Union", description: "EU 사법재판소의 보도자료와 판결 안내를 수집합니다.", status: "unreviewed", url: "https://curia.europa.eu/site/", metadata: ["법원", "HTML 수집"], note: "판결 원문과 보도자료를 별도 문서 유형으로 분류할 예정입니다." }
];

const lawItems: ReviewItem[] = [
  { id: "kr-pipa", kind: "laws", title: "한국 PIPA", subtitle: "개인정보 보호법", description: "한국 개인정보 보호법의 원문과 한국어 기준 조문을 관리합니다.", status: "unreviewed", url: "https://www.law.go.kr/법령/개인정보보호법", metadata: ["대한민국", "법률"], note: "공식 현행본과 시행일을 확인한 뒤 버전을 등록합니다." },
  { id: "eu-gdpr", kind: "laws", title: "EU GDPR", subtitle: "Regulation (EU) 2016/679", description: "유럽연합 일반개인정보보호법의 조문과 번역을 관리합니다.", status: "in_review", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj", metadata: ["EU", "규정"], note: "EUR-Lex 원문 기준으로 조문 단위 번역 검수를 진행합니다." },
  { id: "uk-gdpr", kind: "laws", title: "UK GDPR", subtitle: "Retained Regulation (EU) 2016/679", description: "영국에서 유지된 GDPR과 관련 국내 법제를 연결합니다.", status: "unreviewed", url: "https://www.legislation.gov.uk/eur/2016/679/contents", metadata: ["영국", "규정"], note: "UK GDPR과 Data Protection Act 2018의 관계를 함께 표시합니다." }
];

const criteriaItems: ReviewItem[] = [
  { id: "scope", kind: "criteria", title: "개인정보 범위", subtitle: "기준 01", description: "개인정보와 관련 개념의 법적 범위를 비교합니다.", status: "approved", metadata: ["한국·일본 기준", "17개 중 1"], note: "한국·일본 비교표의 첫 번째 기준으로 승인된 샘플입니다." },
  { id: "rights", kind: "criteria", title: "정보주체 권리", subtitle: "기준 04", description: "열람·정정·삭제 등 정보주체 권리와 행사 절차를 비교합니다.", status: "in_review", metadata: ["한국·일본 기준", "17개 중 4"], note: "국가별 권리 명칭과 예외 사유를 조문에 연결해야 합니다." },
  { id: "transfer", kind: "criteria", title: "국외이전", subtitle: "기준 13", description: "개인정보를 국외로 이전할 때의 요건과 보호조치를 비교합니다.", status: "unreviewed", metadata: ["한국·일본 기준", "17개 중 13"], note: "표준계약, 적정성, 동의 등 법적 근거를 구분해 입력합니다." }
];

export const sampleItems: ReviewItem[] = [...sourceItems, ...lawItems, ...criteriaItems];
