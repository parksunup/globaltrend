# CURIA 출처 조사표

- ID: `curia`
- 기관: Court of Justice of the European Union (CJEU/CURIA)
- 시작 URL: https://curia.europa.eu/site/
- 기존 자료 재대조 시각: 2026-10-12T18:28:28+09:00 (한국시간)
- 상태: 공식 페이지/기존 표본 직접 확인, 사람 검수 전 `unreviewed`
- 이용조건: `unreviewed`; 자동 수집 활성화·승인·발행 변경 없음

## 확인 범위

목록/발견 페이지: https://curia.europa.eu/site/jcms/d2_5158/en/press-releases — HTTP 200. 목록 접속 확인은 전체 자료 유형·페이지 순회 검증이 아닙니다.

기존 상세 표본(모두 HTTP 200):

- https://curia.europa.eu/site/upload/docs/application/pdf/2026-02/cp260011en.pdf
- https://curia.europa.eu/site/upload/docs/application/pdf/2026-03/cp260038en.pdf

검증한 유형: court_press_release입니다. 다른 예정 유형은 검토 필요.

## 제목·게시일·본문·공식 링크

| 필드 | 직접 확인한 방법 |
| --- | --- |
| title | pdftotext -layout로 읽은 기존 보도자료 PDF 1쪽 제목. 판결문 선택자는 미확인. |
| published_at | PDF 1쪽 PRESS RELEASE 번호 아래 Luxembourg 날짜를 보도자료 발행일로 읽음. 선고일은 Judgment / today’s judgment 설명과 별도로 기록. |
| content | 기존 보도자료 PDF 1–2쪽 문단. 미디어용 비구속적 문서이며 판결 전문 확인을 대신하지 않음. |
| official_url | 기존 표본 PDF의 요청 URL과 GET 최종 URL 대조. 사건별 판결 목록은 기존 관련 링크로 연결하고 전문/ECLI는 검토 필요. |

선택자와 추출 방법은 위 기존 표본 범위에 한정합니다. 확인하지 않은 구조는 추정하지 않습니다.

## RSS·API 및 이용조건

공식 RSS/API 안내·지원 계약·실제 피드는 이번 재대조에서 확인하지 않았습니다. 미제공으로 단정하지 않습니다. robots.txt·정책·수집·저장·Codex 처리·번역·요약 공개·재배포 조건은 검토 필요입니다. 접근 성공은 재사용 허가가 아닙니다.

## 제외·보류 및 중복

- 개인정보 보호와 직접 관련 없는 자료는 제외합니다.
- 채용·입찰·행사 일정 등 단순 공지는 내용 확인 후 제외합니다.
- 메뉴·푸터·쿠키 안내는 본문으로 저장하지 않습니다.
- 같은 문서의 완전 중복은 재등록하지 않습니다. 같은 사건의 후속 문서·정정은 별도 문서로 연결합니다.
- 빈 본문·게시일 불명·접근 실패는 조용히 제외하지 않고 검토 대기 상태로 기록합니다.
- 로그인·유료벽·접근 제한을 우회하지 않으며, 이용조건 미확정 자료의 전문은 공개 저장소에 넣지 않습니다.

두 보도자료에서 사건번호 C-97/23 P·C-526/24와 선고일 2026-02-10·2026-03-19를 확인했습니다. 보도자료에는 ECLI가 보이지 않았으며 판결 전문의 ECLI는 검토 필요입니다. 보도자료를 판결 전문으로 분류하지 않습니다.

## 접근 실패 이력·남은 검토

초기 2026-10-06T14:33:38+09:00 프록시 CONNECT 403은 과거 관찰로 JSON에 보존했습니다. 현재 위 기존 표본 접근은 HTTP 200이며, 초기 차단을 현재 실사 상태로 표시하지 않습니다. 원문 전문은 공개 저장소에 넣지 않습니다.

- 한국어 요약·자료 이용조건·관련 문서 전문은 사람 검토 필요.
- 공식 RSS/API 안내, 다른 템플릿·날짜·페이지 순회는 검토 필요.

[대응 JSON](curia.json) · [기존 표본](../fixtures/curia.md) · [검토 메모](../fixtures/review-notes.md)
