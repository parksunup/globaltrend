# 법제 목록 조사표 — 공식 원문 확인 대기

조사 시도일: 2026-10-06 (Asia/Seoul) · 담당: 법제 담당 · 대상: 지정된 7개 법제

**공식 사이트·번역 조사 사이트에 대한 요청이 환경의 HTTPS 프록시에서 모두 403으로 차단되어, 원문 본문·현행 판본·시행일·번역 유무·이용조건을 확인하지 못했습니다. 조사 완료 자료가 아니라 확인을 이어가기 위한 초안입니다.**

법률명과 공식 원문 URL은 저장소의 지정 범위 및 공식기관 주소를 바탕으로 정리한 **확인 대상 후보**입니다. 각 URL의 유효성·본문 일치·공식 표제는 원문 접근 후 재확인해야 합니다. 원어 표제와 상세 영문 표제도 이번에 본문에서 검증한 값이 아닙니다. UK GDPR은 영국에서 개정된 적용 법문이며 EU GDPR의 원문과 동일한 현행 법으로 취급하지 않습니다.

CSV의 7개 행과 아래 7개 행은 같은 `record_id`로 대응합니다. 날짜·번역 직접 출처 URL의 빈 문자열은 **미확인**을 뜻하며, 법률 미시행 또는 번역 없음이라는 뜻이 아닙니다.

- `korean_translation_status=unreviewed`: 번역의 존재·범위·판본 일치 및 출처 확인 전. 한국은 한국어 원문이 기준이며 별도 한국어 번역 대상이 아닙니다.
- `reuse_status=unreviewed`: 원문·기존 번역의 수집·저장·번역·재배포 조건 확인 전.
- `review_status=blocked`: 네트워크 접근 제한으로 실질 조사가 막힌 상태. 검수 완료로 표시하지 않습니다.

| ID | 관할권 코드·설명 | 통용명 | 공식 법률명 확인 후보 | 공식 원문 확인 대상 | 판본·시행일 | 기존 한국어 번역·출처 | 재배포 | 검수 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kr-pipa | KR — 대한민국 | PIPA | 개인정보 보호법 | [공식 원문 확인 대상](https://www.law.go.kr/법령/개인정보보호법) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 한국어 원문이 기준; 원문 접근 검토 필요; 별도 번역 URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |
| jp-appi | JP — 일본 | APPI | 個人情報の保護に関する法律 (Act on the Protection of Personal Information) | [공식 원문 확인 대상](https://elaws.e-gov.go.jp/document?lawid=415AC0000000057) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 유무·직접 출처 검토 필요; URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |
| cn-pipl | CN — 중국 | PIPL | 中华人民共和国个人信息保护法 (Personal Information Protection Law of the People’s Republic of China) | [공식 원문 확인 대상](https://www.gov.cn/xinwen/2021-08/21/content_5632486.htm) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 유무·직접 출처 검토 필요; URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |
| eu-gdpr | EU — 유럽연합 | GDPR | Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation) | [공식 원문 확인 대상](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 유무·직접 출처 검토 필요; URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |
| gb-uk-gdpr | GB — 영국 | UK GDPR | UK GDPR — Regulation (EU) 2016/679 as incorporated into and amended in UK law (영국 적용 법문 공식 표제 검토 필요) | [공식 원문 확인 대상](https://www.legislation.gov.uk/eur/2016/679/contents) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 유무·직접 출처 검토 필요; URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |
| us-ca-ccpa | US-CA — 미국 캘리포니아주 | CCPA | California Consumer Privacy Act of 2018 (California Civil Code, Division 3, Part 4, Title 1.81.5) | [공식 원문 확인 대상](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5.) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 유무·직접 출처 검토 필요; URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |
| sg-pdpa | SG — 싱가포르 | PDPA | Personal Data Protection Act 2012 | [공식 원문 확인 대상](https://sso.agc.gov.sg/Act/PDPA2012) | 검토 필요: 공식 원문 접근 차단으로 현행 판본·개정 반영일·시행일 미확인; `effective_date` 빈 값 | 유무·직접 출처 검토 필요; URL 빈 값 (`unreviewed`) | 검토 필요 (`unreviewed`) | 접근 차단 (`blocked`) |

## 확인 순서

1. 공식 원문 본문과 표제를 확인하고 법령 식별자·판본·조회일을 기록합니다.
2. 공포·발효·적용·단계별 시행을 구분합니다. 최초 시행일 하나로 현행 판본의 시행 상태를 대신하지 않습니다.
3. 한국어 번역은 문서별 직접 링크·작성 주체·번역 기준 판본·완성 범위를 확인합니다. 포털 홈페이지는 번역 존재의 증거가 아닙니다.
4. 원문과 번역의 이용조건을 별도로 확인하고, 불확실한 본문은 공개 저장소에 넣지 않습니다.
5. 영국 보완 법령 및 개정 관계를 [검토 메모](./review-notes.md)에 기록합니다. 별도 비교 기준이나 추가 CSV 행은 만들지 않았습니다.

판본별 확인 항목·번역 조사 경로·접근 실패 기록은 [review-notes.md](./review-notes.md)를 참고하세요. 이번 결과에는 법령 전문·기존 번역 본문을 복사하지 않았습니다.
