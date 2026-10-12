# Data Protection Commission (Ireland) 수집 출처 후보 조사표

- ID: `dpc`
- 확인 시각: 2026-10-11T17:25:34+09:00 (한국시간)
- 시작 URL: [https://www.dataprotection.ie/en/news-media/latest-news](https://www.dataprotection.ie/en/news-media/latest-news) — 직접 GET HTTP 200
- 상태: 공식 페이지 확인, **사람 검수 전 unreviewed**. 후보이며 자동 수집 활성화 아님.
- 요청 범위: 뉴스·결정·지침. 실제 확인 범위는 아래처럼 구분합니다.

## 목록·상세 확인

- news_list: https://www.dataprotection.ie/en/news-media/latest-news
- decision_list_url: https://www.dataprotection.ie/en/dpc-guidance/decisions
- guidance_list_url: https://www.dataprotection.ie/en/dpc-guidance
- decision_detail_checked: https://www.dataprotection.ie/en/dpc-guidance/decisions/inquiry-midlands-regional-hospital-tullamore
- guidance_detail_checked: https://www.dataprotection.ie/en/dpc-guidance/data-subject-access-requests-faq
- pagination_note: 목록 HTML의 실제 다음 링크만 사용; 페이지 순회 응답 미검증.

## 제목·게시일·본문·공식 링크 추출

| 필드 | 직접 확인한 방법 |
| --- | --- |
| title | h1 |
| published_at | 뉴스 main p.date (01st 등 서수 제거 후 파싱); 결정 Decision Date는 별도 사건일; 지침 FAQ는 게시일 미표시 |
| content | 뉴스 .field--name-body; 결정·FAQ 본문 구조는 아래 확인 범위 참고, 범용 선택자는 검토 필요 |
| official_url | 뉴스 main article.node--view-mode-teaser h2 a[href] 및 결정/지침 실제 링크 → GET 최종 URL; canonical은 별도 검토 |

이 위치/선택자는 읽은 표본에 한정합니다. 다른 유형·PDF·사이트 변경에 대한 보편적 선택자로 확정하지 않습니다. 게시일·결정일·수정일·수집일은 구분합니다.

## RSS·API

- RSS: 열람한 페이지에서 발견하지 못했습니다. 미제공으로 단정하지 않습니다.
- API: 공식 제공 안내·엔드포인트는 미확인입니다. 경로를 추정하지 않았습니다.

## 자료 유형과 날짜 한계

뉴스 2건, 결정 목록과 Midlands Regional Hospital Tullamore 결정 설명 HTML, 접근요청 FAQ를 확인했습니다. 결정 상세의 IN-19-9-4 및 Decision Date 10 June 2026는 사건 식별자/결정일이며 페이지 게시일이 아닙니다. PDF 링크는 확인했지만 전문은 미열람입니다. FAQ는 게시일을 확인하지 못했습니다. CHI·Google 뉴스는 결정 전문을 추후 공개한다고 안내합니다.

## 제외·중복 기준

- 개인정보 보호와 직접 관련 없는 자료는 본문 확인 후 제외합니다.
- 채용·입찰·행사 일정만 있는 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·푸터·쿠키 배너·SNS 링크는 본문으로 저장하지 않습니다.
- 같은 사건의 결정문·보도자료·후속 문서는 연결하고 같은 사건을 중복 집계하지 않습니다.
- 게시일 불명·본문 누락·접근 실패·이용조건 미확정은 검토 대기로 기록하며 누락이나 미제공으로 단정하지 않습니다.

실제 선정·제외 근거는 fixtures 검토 메모에 기록합니다. 같은 사건·자료의 HTML/PDF/번역판은 연결하고 중복 건수로 세지 않습니다.

## 이용조건·robots.txt

확인한 뉴스·결정·지침 및 푸터에서 명시적 저작권/재사용 정책 링크를 확보하지 못함. Data Protection Statement/Cookie Policy는 개인정보·쿠키 정책이며 저작권 허가로 쓰지 않음. 수집·저장·Codex 처리·요약·번역·재배포 모두 검토 필요.

robots.txt HTTP 200; /admin/, /search/, /user/ 등 제한 확인. 공개 기사 접근 허가와 저작권/재배포 허가는 구분.

조건을 읽은 것과 공개 허가 확정은 다릅니다. terms_status는 unreviewed이며 원문 전문·이미지·로고·무허가 번역을 넣지 않았습니다.

## 접근 실패와 성공 기록

초기 세 사이트의 프록시 CONNECT 403은 과거 관찰로 JSON access_failures에 보존했습니다. 사용자 네트워크 게시 후 현재 뉴스 목록·상세의 HTTP 200을 확인했습니다. CNIL 연결 결정의 다른 호스트 접근 실패는 해소되지 않았습니다. 빈 목록 본문·게시일 미표시·생성 시각 불일치는 조용히 버리지 않고 검토 대상으로 남깁니다.

## 다음 검토

- 출처별 실제 이용조건과 한국어 요약·공개 발췌 범위를 사람 검토합니다.
- 상세 선택자와 날짜 파싱을 다른 자료 유형 및 다음 목록 페이지에서 검증합니다.
- 공식 RSS/공개 API 지원 안내, 요청 한도·갱신 정책을 추가 확인합니다.
- 연결 결정/PDF 전문과 불복·정정 상태는 필요한 경우 별도 검토합니다.

대응 JSON: [dpc.json](dpc.json). 표본: [fixtures/dpc.md](../fixtures/dpc.md). [검토 메모](../fixtures/review-notes.md).
- robots.txt: https://www.dataprotection.ie/robots.txt
