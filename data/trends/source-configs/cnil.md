# Commission nationale de l’informatique et des libertés (CNIL) 수집 출처 후보 조사표

- ID: `cnil`
- 확인 시각: 2026-10-11T17:25:34+09:00 (한국시간)
- 시작 URL: [https://www.cnil.fr/fr/actualites](https://www.cnil.fr/fr/actualites) — 직접 GET HTTP 200
- 상태: 공식 페이지 확인, **사람 검수 전 unreviewed**. 후보이며 자동 수집 활성화 아님.
- 요청 범위: 뉴스·결정·지침. 실제 확인 범위는 아래처럼 구분합니다.

## 목록·상세 확인

- news_list: https://www.cnil.fr/fr/actualites
- decision_list_url: https://www.cnil.fr/fr/tag/Sanction
- decision_list_note: 제재 관련 기사 목록이며 결정 전문 아카이브가 아님. EXTIA 결정 링크는 Légifrance로 연결되어 403 미확인.
- guidance_list_url: https://www.cnil.fr/fr/mediatheque?field_scald_collection_tid=29
- guidance_detail_checked: https://www.cnil.fr/fr/facturation-electronique-quels-enjeux
- pagination_note: 뉴스 목록의 ?page=1 / ?page=31 링크 확인. 다음 페이지 응답은 미검증.

## 제목·게시일·본문·공식 링크 추출

| 필드 | 직접 확인한 방법 |
| --- | --- |
| title | main h1 |
| published_at | main .ctn-gen-auteur (프랑스어 표시 날짜) |
| content | main .page-introduction + main .ctn-gen-body; .ctn-gen-after 관련 기사 및 도구/푸터 제외 |
| official_url | 목록 main .ctn-gen-liste-titre a[href] → 절대 URL → GET 최종 URL; canonical은 별도 검토 |

이 위치/선택자는 읽은 표본에 한정합니다. 다른 유형·PDF·사이트 변경에 대한 보편적 선택자로 확정하지 않습니다. 게시일·결정일·수정일·수집일은 구분합니다.

## RSS·API

- RSS: 열람한 페이지에서 발견하지 못했습니다. 미제공으로 단정하지 않습니다.
- API: 공식 제공 안내·엔드포인트는 미확인입니다. 경로를 추정하지 않았습니다.

## 자료 유형과 날짜 한계

제재 목록과 두 제재 기사, 전자송장 안내 기사, 가이드 자료실을 확인했습니다. 제재 기사는 결정 전문이 아닙니다. EXTIA의 Légifrance 결정 링크는 CONNECT 403입니다. 병원 기사의 표시 게시일은 확인했지만 도입 제재일과 연결 결정 제목 날짜가 달라 결정일은 검토 필요입니다.

## 제외·중복 기준

- 개인정보 보호와 직접 관련 없는 자료는 본문 확인 후 제외합니다.
- 채용·입찰·행사 일정만 있는 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·푸터·쿠키 배너·SNS 링크는 본문으로 저장하지 않습니다.
- 같은 사건의 결정문·보도자료·후속 문서는 연결하고 같은 사건을 중복 집계하지 않습니다.
- 게시일 불명·본문 누락·접근 실패·이용조건 미확정은 검토 대기로 기록하며 누락이나 미제공으로 단정하지 않습니다.

실제 선정·제외 근거는 fixtures 검토 메모에 기록합니다. 같은 사건·자료의 HTML/PDF/번역판은 연결하고 중복 건수로 세지 않습니다.

## 이용조건·robots.txt

Mentions légales의 Réutilisation des contenus: 텍스트 CC-BY-ND 4.0 FR, 출처·라이선스·추출일 표기와 수정 금지. 하단은 같은 조건의 번역 허용을 명시함. 이미지 CC-BY-NC-ND와 오픈데이터 Licence ouverte는 텍스트와 구분. 한국어 독자 요약/발췌·가공의 적용 조건은 사람 검토 필요. 결정/법령은 별도 공식 판본 확인 필요.

robots.txt HTTP 200; /admin/, /search/, /user/ 등 제한과 리소스 허용 확인. 전문 재배포 허가로 해석하지 않음.

조건을 읽은 것과 공개 허가 확정은 다릅니다. terms_status는 unreviewed이며 원문 전문·이미지·로고·무허가 번역을 넣지 않았습니다.

## 접근 실패와 성공 기록

초기 세 사이트의 프록시 CONNECT 403은 과거 관찰로 JSON access_failures에 보존했습니다. 사용자 네트워크 게시 후 현재 뉴스 목록·상세의 HTTP 200을 확인했습니다. CNIL 연결 결정의 다른 호스트 접근 실패는 해소되지 않았습니다. 빈 목록 본문·게시일 미표시·생성 시각 불일치는 조용히 버리지 않고 검토 대상으로 남깁니다.

## 다음 검토

- 출처별 실제 이용조건과 한국어 요약·공개 발췌 범위를 사람 검토합니다.
- 상세 선택자와 날짜 파싱을 다른 자료 유형 및 다음 목록 페이지에서 검증합니다.
- 공식 RSS/공개 API 지원 안내, 요청 한도·갱신 정책을 추가 확인합니다.
- 연결 결정/PDF 전문과 불복·정정 상태는 필요한 경우 별도 검토합니다.

대응 JSON: [cnil.json](cnil.json). 표본: [fixtures/cnil.md](../fixtures/cnil.md). [검토 메모](../fixtures/review-notes.md).

- 확인한 정책: https://www.cnil.fr/fr/mentions-legales
- robots.txt: https://www.cnil.fr/robots.txt
