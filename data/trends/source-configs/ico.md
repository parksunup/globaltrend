# Information Commission’s Office (ICO) 수집 출처 후보 조사표

- ID: `ico`
- 확인 시각: 2026-10-11T17:25:34+09:00 (한국시간)
- 시작 URL: [https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/) — 직접 GET HTTP 200
- 상태: 공식 페이지 확인, **사람 검수 전 unreviewed**. 후보이며 자동 수집 활성화 아님.
- 요청 범위: 뉴스·결정·지침. 실제 확인 범위는 아래처럼 구분합니다.

## 목록·상세 확인

- news_list: https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/
- decision_list_url: https://ico.org.uk/action-weve-taken/enforcement/
- guidance_list_url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/
- guidance_detail_checked: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/building-trust-and-transparency-into-generative-ai-development-our-work-to-create-regulatory-certainty/
- pagination_note: /api/search 응답 pagination(totalResults/perPage/showingPageNumber/totalPages/hasMore) 확인. pageNumber 2 호출은 미검증.

## 제목·게시일·본문·공식 링크 추출

| 필드 | 직접 확인한 방법 |
| --- | --- |
| title | h1; 목록 JSON results[].title |
| published_at | main li에서 span 텍스트 Date의 형제 strong; 목록 filterItemMetaData 표시 날짜와 대조. createdDateTime은 게시일로 사용하지 않음 |
| content | 뉴스 main .rich-text .prose (구간별 수집, Notes to editors 구분); 집행 main 본문; 복합 지침 페이지 자동 추출은 검토 필요 |
| official_url | POST /api/search의 results[].url을 https://ico.org.uk와 결합하고 GET 최종 URL 확인 |

이 위치/선택자는 읽은 표본에 한정합니다. 다른 유형·PDF·사이트 변경에 대한 보편적 선택자로 확정하지 않습니다. 게시일·결정일·수정일·수집일은 구분합니다.

## RSS·API

- RSS: 열람한 페이지에서 발견하지 못했습니다. 미제공으로 단정하지 않습니다.
- 내부 검색 엔드포인트: https://ico.org.uk/api/search, POST. 목록 HTML #filter-page-container data-node-id와 /js/search.js 호출을 실제 확인했습니다. 다음 두 payload의 JSON 응답을 HTTP 200으로 확인했습니다. 공개 API 문서·안정적 계약·재사용 한도는 미확인입니다.

```json
[
  {
    "filters": [],
    "pageNumber": 1,
    "order": "newest",
    "rootPageId": 2816
  },
  {
    "filters": [],
    "pageNumber": 1,
    "order": "newest",
    "rootPageId": 17222
  }
]
```

results의 title/url/filterItemMetaData로 발견합니다. createdDateTime은 CMS 생성 시각으로 화면 게시일과 다른 예가 있어 게시일로 쓰지 않습니다.

## 자료 유형과 날짜 한계

뉴스 2건, 과징금·집행명령(TWLS) 상세 2건, 2023 TikTok 집행 상세, AI 보고서/지침 HTML을 확인했습니다. 집행 상세의 Date는 게시일·결정일 의미를 추가 확인해야 합니다. 목록은 2024-12-31 이전 자료 날짜 오류 가능성을 명시합니다. 같은 TWLS 사건의 두 집행 문서는 하나의 사건으로 연결할 대상이며 이번 뉴스 표본으로 추가 집계하지 않습니다.

## 제외·중복 기준

- 개인정보 보호와 직접 관련 없는 자료는 본문 확인 후 제외합니다.
- 채용·입찰·행사 일정만 있는 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·푸터·쿠키 배너·SNS 링크는 본문으로 저장하지 않습니다.
- 같은 사건의 결정문·보도자료·후속 문서는 연결하고 같은 사건을 중복 집계하지 않습니다.
- 게시일 불명·본문 누락·접근 실패·이용조건 미확정은 검토 대기로 기록하며 누락이나 미제공으로 단정하지 않습니다.
- FOI/EIR만 다루는 자료는 개인정보 보호와 직접 관련된 내용이 있는지 확인 후 제외합니다.

실제 선정·제외 근거는 fixtures 검토 메모에 기록합니다. 같은 사건·자료의 HTML/PDF/번역판은 연결하고 중복 건수로 세지 않습니다.

## 이용조건·robots.txt

본문: 별도 표시가 없는 텍스트는 OGL v3.0. 기관·문서명·발행일·라이선스 attribution 요구; 이미지·로고 및 Data Protection Essentials 콘텐츠는 예외. OGL 원문 링크는 다른 호스트이며 이번 확인 범위에서 미열람. 자료별 예외·AI 처리·재배포 조건은 검토 필요.

robots.txt HTTP 200; User-agent * Crawl-delay 6, /private 및 /restricted 제외. 확인 후 ICO 후속 요청은 6초 간격을 적용. 안정적 수집 주기·한도는 별도 검토.

조건을 읽은 것과 공개 허가 확정은 다릅니다. terms_status는 unreviewed이며 원문 전문·이미지·로고·무허가 번역을 넣지 않았습니다.

## 접근 실패와 성공 기록

초기 세 사이트의 프록시 CONNECT 403은 과거 관찰로 JSON access_failures에 보존했습니다. 사용자 네트워크 게시 후 현재 뉴스 목록·상세의 HTTP 200을 확인했습니다. CNIL 연결 결정의 다른 호스트 접근 실패는 해소되지 않았습니다. 빈 목록 본문·게시일 미표시·생성 시각 불일치는 조용히 버리지 않고 검토 대상으로 남깁니다.

## 다음 검토

- 출처별 실제 이용조건과 한국어 요약·공개 발췌 범위를 사람 검토합니다.
- 상세 선택자와 날짜 파싱을 다른 자료 유형 및 다음 목록 페이지에서 검증합니다.
- 공식 RSS/공개 API 지원 안내, 요청 한도·갱신 정책을 추가 확인합니다.
- 연결 결정/PDF 전문과 불복·정정 상태는 필요한 경우 별도 검토합니다.

대응 JSON: [ico.json](ico.json). 표본: [fixtures/ico.md](../fixtures/ico.md). [검토 메모](../fixtures/review-notes.md).

- 확인한 정책: https://ico.org.uk/global/copyright-and-re-use-of-materials/
- robots.txt: https://ico.org.uk/robots.txt
