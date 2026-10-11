# Federal Trade Commission (United States) 수집 출처 후보 조사표

- ID: `ftc`
- 확인 시각: 2026-10-11T22:28:54+09:00 (한국시간)
- 시작 URL: https://www.ftc.gov/ — HTTP 200
- 상태: 공식 페이지 확인, 사람 검수 전 unreviewed. 후보이며 자동 수집 미활성화.

## 직접 확인한 목록·상세 범위

- https://www.ftc.gov/news-events/news/press-releases?field_consumer_protection_topics=1420
- https://www.ftc.gov/business-guidance/privacy-security
- https://www.ftc.gov/legal-library/browse/cases-proceedings/222-3105-illuminate-education-inc-matter

표본 상세:

- https://www.ftc.gov/news-events/news/press-releases/2026/08/ftc-finalizes-orders-cox-media-group-two-other-firms-settling-charges-they-deceived-customers-about
- https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-gives-final-approval-order-against-illuminate-settling-allegations-it-failed-secure-students

## 추출 방법

| 필드 | 직접 확인한 방법 |
| --- | --- |
| title | h1 |
| published_at | article.node--view-mode-banner time의 표시 날짜와 datetime; 사이트 메뉴에 있는 다른 time을 쓰지 않음 |
| content | main article.node--view-mode-full .field--name-body; 담당자 biography 본문 제외 |
| official_url | 목록 실제 a[href] 또는 RSS item/link → GET 최종 URL |

확인한 표본 범위에 한정합니다. 다른 페이지 구조나 선택자를 추정하지 않습니다.

## RSS·API

FTC RSS 안내와 실제 XML 확인. PDPC/PPC 피드 안내 미확인, 미제공으로 단정하지 않음.

- RSS: https://www.ftc.gov/feeds/press-release-consumer-protection.xml — HTTP 200, item/title/link/pubDate/description 확인. Consumer Protection은 개인정보 외 소비자보호도 포함하므로 본문 관련성 선별 필요. 전문 포함 여부와 날짜는 상세와 대조해야 함.
공식 공개 API 안내·지원 계약 미확인. 동적 렌더링을 공개 API 제공으로 해석하지 않음.

## 유형·본문·날짜의 한계

privacy/security 주제 필터 값 1420을 HTML select에서 확인한 후 실제 목록 응답으로 기사 2건을 선택했습니다. 소장 주장은 allegation, 합의 명령 최종 승인은 별도로 기록합니다. 관련 case HTML과 명령 PDF는 연결하되 PDF 전문 법적 검수는 미완료입니다.

## 제외·중복 기준

- 개인정보 보호와 직접 관련 없는 자료는 실제 본문 확인 후 제외합니다.
- 채용·입찰·행사 일정만 있는 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·쿠키 안내·푸터·공유 링크는 본문으로 저장하지 않습니다.
- 같은 사건의 보도자료·결정문·언어판·HTML/PDF는 연결하고 중복 집계하지 않습니다.
- 게시일 불명·빈 본문·접근 실패는 검토 대기로 기록하고 자료 부재로 해석하지 않습니다.
- 경쟁법·소비자보호 일반 자료는 개인정보/데이터 보안과 직접 관련되는지 본문 확인 후 제외합니다. 소장 주장을 확정 위반 판단으로 쓰지 않습니다.

실제 선정·제외·중복의 한계는 fixtures 검토 메모에 기록했습니다.

## 이용조건·로봇 정책

- 정책: https://www.ftc.gov/policy-notices/website-policy
- Copyright Permission은 대부분의 연방정부 저작물을 public domain으로 설명하고 가능한 출처 표기를 요구함. 모든 제3자 자료까지 재사용 허가로 단정하지 않으며 예외·처리/공개 범위는 사람 검토 필요.
- robots.txt: https://www.ftc.gov/robots.txt — HTTP 200, 접근 제한 확인. 접근 성공은 저작권 허가가 아님.

## 실패 이력 및 후속 검토

기존 프록시 CONNECT 403은 과거 관찰로 JSON에 보존했습니다. 사용자 네트워크 게시 후 이번 홈페이지·열람 목록·상세 HTTP 200을 확인했습니다. 실사 성공은 자료 권리/법률/한국어 검수 완료가 아닙니다.

- 한국어 요약·자료 이용조건과 권리 범위를 사람 검토합니다.
- 연결 결정/안내 전문과 시행·불복·정정 상태를 필요 시 추가 확인합니다.
- 동적 목록·다른 템플릿·다음 페이지에서 수집 방법을 검증합니다.
- RSS/API 공식 안내와 요청 한도·안정성 계약을 추가 확인합니다.

[대응 JSON](ftc.json) · [표본](../fixtures/ftc.md) · [검토 메모](../fixtures/review-notes.md)
