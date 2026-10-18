# Personal Data Protection Commission (Singapore) 수집 출처 후보 조사표

- ID: `pdpc`
- 확인 시각: 2026-10-11T22:28:54+09:00 (한국시간)
- 시작 URL: https://www.pdpc.gov.sg/ — HTTP 200
- 상태: 공식 페이지 확인, 사람 검수 전 unreviewed. 후보이며 자동 수집 미활성화.

## 직접 확인한 목록·상세 범위

- https://www.pdpc.gov.sg/media-events
- https://www.pdpc.gov.sg/organisations/regulations-decisions/enforcement-decisions

표본 상세:

- https://www.pdpc.gov.sg/media-events/joint-advisory-against-using-nric-numbers-for-authentication-by-pdpc-and-csa

## 추출 방법

| 필드 | 직접 확인한 방법 |
| --- | --- |
| title | h1 |
| published_at | .page-banner__date의 Published on (Last updated와 구분) |
| content | 공지 self.__next_f.push의 기사 data.content를 직접 디코드해 확인. 일반 HTML 본문은 빈 상태. 범용 RSC 파서·렌더링 후 본문 선택자는 검토 필요 |
| official_url | 서버 내장 메뉴 데이터의 실제 URL → GET 최종 URL |

확인한 표본 범위에 한정합니다. 다른 페이지 구조나 선택자를 추정하지 않습니다.

## RSS·API

공식 RSS 피드 안내는 확인하지 못했습니다. 미제공으로 단정하지 않으며 추가 검토가 필요합니다.

공식 공개 API 안내·지원 계약 미확인. 동적 렌더링을 공개 API 제공으로 해석하지 않음.

## 유형·본문·날짜의 한계

Media & Events 목록은 Loading 상태입니다. 내장 메뉴 데이터의 실제 상세 링크를 따라 공지 1건의 제목·게시일·기사 data.content를 확인했습니다. 연결 공동 안내와 결정 목록은 읽기 접근/제목 구조를 확인했지만 전문/전체 목록 수집은 추가 검토 필요입니다. 2024 결정 묶음 공지는 복수 사건이고 제목일과 표시 게시일도 달라 이번 표본에서 제외했습니다.

## 제외·중복 기준

- 개인정보 보호와 직접 관련 없는 자료는 실제 본문 확인 후 제외합니다.
- 채용·입찰·행사 일정만 있는 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·쿠키 안내·푸터·공유 링크는 본문으로 저장하지 않습니다.
- 같은 사건의 보도자료·결정문·언어판·HTML/PDF는 연결하고 중복 집계하지 않습니다.
- 게시일 불명·빈 본문·접근 실패는 검토 대기로 기록하고 자료 부재로 해석하지 않습니다.

실제 선정·제외·중복의 한계는 fixtures 검토 메모에 기록했습니다.

## 이용조건·로봇 정책

- 정책: https://www.pdpc.gov.sg/terms-and-conditions
- Terms §§4–8의 저작권·사용 목적 제한·attribution/조건 링크·외부 공개/수정의 허용 범위를 직접 읽음. 독자 요약·번역·Codex 처리·공개 저장 조건은 사람 검토 필요.
- robots.txt: https://www.pdpc.gov.sg/robots.txt — HTTP 200, 접근 제한 확인. 접근 성공은 저작권 허가가 아님.

## 실패 이력 및 후속 검토

기존 프록시 CONNECT 403은 과거 관찰로 JSON에 보존했습니다. 사용자 네트워크 게시 후 이번 홈페이지·열람 목록·상세 HTTP 200을 확인했습니다. 실사 성공은 자료 권리/법률/한국어 검수 완료가 아닙니다.

- 한국어 요약·자료 이용조건과 권리 범위를 사람 검토합니다.
- 연결 결정/안내 전문과 시행·불복·정정 상태를 필요 시 추가 확인합니다.
- 동적 목록·다른 템플릿·다음 페이지에서 수집 방법을 검증합니다.
- RSS/API 공식 안내와 요청 한도·안정성 계약을 추가 확인합니다.

[대응 JSON](pdpc.json) · [표본](../fixtures/pdpc.md) · [검토 메모](../fixtures/review-notes.md)
