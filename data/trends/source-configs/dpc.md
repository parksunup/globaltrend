# Data Protection Commission (Ireland) 수집 출처 후보 조사표

- ID: `dpc`
- 기관·관할권: Data Protection Commission (Ireland) / IE, EU
- 확인 시각: 2026-10-11T16:39:49+09:00 (한국시간)
- 후보 홈: [https://www.dataprotection.ie/](https://www.dataprotection.ie/)
- 시작 URL 후보: [https://www.dataprotection.ie/en/news-media/latest-news](https://www.dataprotection.ie/en/news-media/latest-news)
- 상태: **blocked — 공식 페이지 실사 미완료**. 후보 추가는 자동 수집 활성화가 아닙니다.

## 요청 범위와 확인 범위

뉴스·결정·지침을 조사 대상으로 지정했지만 실제 제공 유형·목록·상세를 확인하지 못했습니다. 위 URL도 이번 실사에서 접근·리디렉션·공식 페이지 내용을 확인하지 못한 후보입니다. 목록 경로가 유효하다고 확정하지 않습니다. 결정·지침 목록 URL은 확인 전이므로 JSON에서 null입니다.

| 필드 | 얻는 방법 및 확인 결과 |
| --- | --- |
| 제목 | 검토 필요: DOM·PDF 위치·선택자 미확인 |
| 원문 게시일 | 검토 필요: 게시일·결정일·최종 수정일·수집일을 구분해야 함; 이번에는 위치·값 미확인 |
| 본문 | 검토 필요: HTML/PDF 및 본문 범위·선택자 미확인 |
| 공식 링크 | 검토 필요: 실제 목록 링크·최종 URL·canonical 미확인 |

공식 RSS/API를 우선 조사할 예정이나 링크·URL·응답·본문 포함 여부·API 안내 모두 미확인입니다. 미제공으로 단정하지 않습니다. 추정 선택자와 임의 피드/API 경로는 기록하지 않았습니다.

## 접근 실패

| 요청 URL | 단계 | 관찰 | 원문 서버 상태 |
| --- | --- | --- | --- |
| https://www.dataprotection.ie/ | HTTPS 프록시 CONNECT | `Tunnel connection failed: 403 Forbidden` | 미확인 |
| https://www.dataprotection.ie/en/news-media/latest-news | HTTPS 프록시 CONNECT | `Tunnel connection failed: 403 Forbidden` | 미확인 |

Python urllib HTTPS GET, Mozilla/5.0·HTML Accept 헤더, 20초 제한, TLS·플랫폼 프록시 유지. 네트워크 추가 초안 저장 및 별도 실행 권한으로 재시도했으나 동일 실패였습니다. 원문 서버 HTTP 403, 페이지 부재, 사이트 자체 차단으로 해석하지 않습니다. 응답 본문을 받지 못해 본문 누락 사례도 검사하지 못했습니다.

## 수집 제외·중복 기준 제안

- 개인정보 보호와 직접 관련 없는 자료는 본문 확인 후 제외합니다.
- 채용·입찰·행사 일정만 있는 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·푸터·쿠키 배너·SNS 링크는 본문으로 저장하지 않습니다.
- 같은 사건의 결정문·보도자료·후속 문서는 연결하고 같은 사건을 중복 집계하지 않습니다.
- 게시일 불명·본문 누락·접근 실패·이용조건 미확정은 검토 대기로 기록하며 누락이나 미제공으로 단정하지 않습니다.

위 기준은 편집 제안이며 실제 자료에 적용한 결과가 아닙니다. 같은 사건의 결정문·보도자료는 related_documents로 연결하고 사건을 한 번만 셉니다. 사건 동일성 근거가 불명확하면 사람 검토로 남깁니다.

## 이용조건

robots.txt·이용정책·수집·저장·Codex 처리·요약·번역·공개 발췌·전문 재배포 모두 검토 필요입니다. 정책 URL은 확인 전으로 null입니다. 전문·무허가 번역문을 넣지 않았으며 읽기 접근이 콘텐츠 재사용 허가를 뜻하지 않습니다.

## 후속 확인

1. 네트워크 초안의 런타임 적용 뒤 시작 URL 및 최종 URL·응답을 다시 확인합니다.
2. 실제 링크로 뉴스·결정·지침 목록과 상세를 확인하고 제목·게시일·본문·canonical/공식 링크 위치를 기록합니다.
3. 확인한 구조에 한해서만 선택자를 기록하고 서로 다른 자료 유형에서 동작을 대조합니다.
4. RSS/API 공식 안내, 피드 응답, 페이지 순회, robots.txt·이용조건을 확인합니다.
5. 공식 개인정보 보호 자료 최대 5건을 근거 위치와 함께 선정하고 사건 기준으로 중복을 연결합니다.

대응 파일: [dpc.json](dpc.json). 표본: [fixtures/dpc.md](../fixtures/dpc.md). 실패 및 보류 판단: [검토 메모](../fixtures/review-notes.md).
