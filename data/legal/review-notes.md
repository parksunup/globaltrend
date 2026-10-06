# 법제 검토 메모 — 원문 확보·번역·재배포 확인

조사일: 2026-10-06 · 브랜치: `feat/legal-corpus-foundation`. README.md、architecture.md、docs/team-onboarding.md를 읽고 지정된 7개 법제와 기존 17개 기준만 사용한다. 앱·Supabase·인증·환경변수는 수정하지 않는다.

## 조사 결과의 현재 범위

이전의 전면 프록시 차단 기록을 재시도 결과로 갱신했다. APPI 공식 판본을 확보했고 부분 번역을 작성했다. 다른 법률은 아직 한국어 전문 번역을 작성하지 않았다. 기존 외부 한국어 번역의 유무·작성 주체·판본·직접 URL·이용허락은 미확인이다. 조사하지 못한 것을 번역 없음으로 기록하지 않는다.

| 법제 | 이번 공식 자료 확인 | 판본·시행일과 남은 확인 | 원문·번역 이용·재배포 조건 |
| --- | --- | --- | --- |
| 한국 PIPA | [국가법령정보센터](https://www.law.go.kr/법령/개인정보보호법) HTTP 403, lsLinkProc 연결 경로 HTTP 503 | 현행 법률번호·통합 판본·시행일 검토 필요. 한국어 원문이 기준이며 번역할 필요 없음 | 법령 자체와 사이트 자산의 권리 구분 검토 필요. [저작권법 제7조](https://www.law.go.kr/법령/저작권법/제7조)는 확인 대상, 미열람 |
| 일본 APPI | [e-Gov 고정 판본 API](https://laws.e-gov.go.jp/api/2/law_data/415AC0000000057_20261001_507AC0000000070) HTTP 200 | CurrentEnforced; 선택 개정 판본 시행일 2026-10-01. 본칙 185조·부칙 22묶음·별표 2개. 제1~40조 초안 작성, 나머지 미번역 | 일본 저작권법 제13조 제1호의 법령 권리 대상 제외를 확인. 법령 자체의 자체 번역 초안을 검토용 PR에 포함; 제3자 번역·사이트 자산 이용허락을 가정하지 않음 |
| 중국 PIPL | [NPC 원문 후보](https://www.npc.gov.cn/npc/c30834/202108/t20210820_313088.html) HTTP 503. 이전 gov.cn 후보 HTTP 404 | 공식 법문·정확한 판본·시행일 검토 필요; 기존 잘못된 gov.cn 후보로 날짜 확정하지 않음 | 법령 자체와 사이트 편집물·기존 번역의 권리 구분 검토 필요 |
| EU GDPR | [EUR-Lex 관보 원문](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) 및 CELEX HTML 요청 HTTP 202·0바이트 | 법문 확보 실패. 영국 정부의 [2016-05-04 시점 제공 XML](https://www.legislation.gov.uk/eur/2016/679/2016-05-04/data.xml)은 확보했으나 EU 현행 통합본으로 확정하지 않음. 정오표·발효일·적용일 검토 필요 | EUR-Lex legal notice 및 원문·기존 번역 이용조건 검토 필요 |
| 영국 UK GDPR | [정부 XML](https://www.legislation.gov.uk/eur/2016/679/data.xml) HTTP 200 | revised XML, RestrictStartDate 2026-09-30. UnappliedEffects 5건 존재. 이 날짜는 메타데이터의 제한 시작일이며 모든 조항의 단일 시행일이 아님 | XML 확보가 번역·재배포 허락 확인을 뜻하지 않음. [OGL v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) 요청 HTTP 403; 해당 법문에 대한 라이선스·예외 확인 필요 |
| 캘리포니아 CCPA | [CPPA 법문 PDF](https://cppa.ca.gov/pdf/20260101_ccpa_statute.pdf) 및 [다른 PDF](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf) HTTP 200 | 첫 PDF 표제 effective 01/01/2026 – AB 137, AB 566 update, posted December 2025. 주 의회 법전과 후속 개정·단계별 시행 대조 필요 | CPPA의 법문·PDF 편집·해설·사이트 이용조건 구분 확인 전. 기존 한국어 번역 이용허락도 검토 필요 |
| 싱가포르 PDPA | [SSO 법률 페이지](https://sso.agc.gov.sg/Act/PDPA2012) 및 [이용규약](https://sso.agc.gov.sg/Terms-of-Use) HTTP 200 | Current version as at 06 Oct 2026, 2020 REVISED EDITION 표기. 전체 조문·부칙 범위와 후속 개정 시행일 대조 필요. SSO 스스로 unofficial version이라고 안내 | 아래 제5·7·8·13조 확인 사항 적용. 번역·공개 범위 불확실하여 번역 본문 공개 보류 |

확보 자료의 URL·조회일·바이트 수·SHA-256은 [source-receipts.json](./source-receipts.json)에 기록했다. HTTP 200이 법문 전체 확보·현행성·이용허락·사람 검수 완료를 뜻하지 않는다. 다운로드 원문은 조사용 임시 경로에 보관하며 Git에는 넣지 않았다. TLS 검증을 끄거나 접근 통제를 우회하지 않았다.

## APPI 이용조건과 번역 결정

[일본 저작권법 공식 API](https://laws.e-gov.go.jp/api/2/law_data/345AC0000000048)의 **본칙** 제13조 제1호는 헌법 및 그 밖의 법령을 해당 장의 권리 대상에서 제외한다. 부칙의 같은 조 번호와 구별하여 확인했다. 제4호는 공공기관 작성 번역·편집물도 열거하지만 이 프로젝트가 타인의 번역을 전재할 일반 허락으로 해석하지 않는다.

[PPC 이용규약](https://www.ppc.go.jp/notice/kiyaku)과 [PDL1.0](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)을 확인했다. 적용 대상 자료의 번역·변형·복제·공중송신·상업 이용을 허용하며 출처·가공 사실·가공 주체를 표시해야 한다. 제3자 권리·로고·개별 규칙 등의 예외가 있다. PPC 이용규약이 e-Gov 원문에 자동 적용되는 것으로 표시하지 않는다. e-Gov `/terms/`는 HTML 앱 셸만 반환하여 규약 본문은 미확인이다.

이번 APPI 자체 초안은 법령 자체의 권리 제외를 근거로 검토용 PR에 포함한다. 공식 번역·일본 정부 작성물로 표시하지 않으며 사람 검수 전 상태를 유지한다. 용어 결정, 조·항·호·목·부칙·별표의 수 및 누락·확인 방법은 [APPI 검토 메모](./translations/appi-review-notes.md)에 별도로 기록했다.

## 싱가포르 이용규약 확인 사항

- 제5조는 제13조의 예외를 제외한 이용·복제·재배포에 AGC의 사전 서면 허가를 요구한다. 제7조는 무단 목적의 수정·이용을 금지한다.
- 제8조는 SSO 통합 법문을 unofficial version이라고 명시하고 권위 있는 법문을 대신한다고 보지 않도록 한다.
- 제13조는 법률의 이용·복제에 조건부 허락을 제공한다. 싱가포르 정부 저작권 및 AGC 허락에 의한 이용 사실, 최신판은 SSO에서 확인할 수 있다는 안내, 제작자의 정확성 책임이 조건이다. AGC/SSO의 제휴·지지 인상을 주면 안 된다.
- 제13조(d)는 **자동취득을 싱가포르 시각 03:00~07:00로 제한**한다. 이후 추가 자동취득은 이 시간을 준수한다. 최초 페이지 취득 시점의 조건 준수 여부는 별도 확인 필요하며, 추가 법문 자동취득은 중단했다. 과도한 요청·보안 우회는 허용되지 않는다.
- 제13조의 use/reproduce 문구만으로 자체 번역·수정·공개 저장소 재배포까지 허용된다고 확정하지 않았다. 이 범위 및 위 표시조건을 확인하기 전 PDPA 번역 본문은 Git에 넣지 않는다. 제14조의 허락 철회·조건 변경 가능성도 확인했다.

## UK GDPR과 연결되는 보완 법률

| 보완 법률 | 공식 URL·열람 | 관계·사람 확인 사항 |
| --- | --- | --- |
| Data Protection Act 2018 | [정부 XML](https://www.legislation.gov.uk/ukpga/2018/12/data.xml) HTTP 200, 공식 제목 확인 | UK GDPR 보완, 예외·감독·국내 처리 규정 등 연결을 추가 조사해야 함. 전문 번역·개별 조항 관계 검토 미착수 |
| Data (Use and Access) Act 2025 | [정부 XML](https://www.legislation.gov.uk/ukpga/2025/18/data.xml) HTTP 200, 공식 제목 확인 | UK GDPR 등의 개정 관계·단계별 시행·경과조치 확인 필요. 공포 연도만으로 전부 시행됐다고 단정하지 않음 |
| 관련 시행·경과 규정 | UK GDPR XML UnappliedEffects에 2026년 개정·시행 관련 참조 존재 | 5건의 미반영 영향에 대해 발효·편집 반영 여부와 적용 조항 확인 필요. 참조된 규정 자체의 법문·시행 상태는 검토 필요 |

보완 법률은 영국 셀의 근거 연결 후보로 메모하며 **추가 비교 기준이나 관할권 열을 만들지 않는다.** EU 법문을 UK GDPR 현행본으로, UK GDPR 현행본을 EU 법문으로 대체하지 않는다.

## 제출 상태·다음 작업

[번역 진행표](./translation-progress.md)를 따른다. 현재 완성된 해외법 번역 전문은 0개이고, 비교표 119셀은 모두 미검토다. 이는 요청한 전체 작업의 완료가 아니라 APPI 첫 번역 구간과 조사 상태를 검토하기 위한 제출이다. 부분 번역은 같은 문서에 계속 이어 쓰며, 각 법률 전문과 누락 대조가 끝난 뒤 기존 17개 기준의 해당 관할권 셀에 근거·요약·예외·조항 링크·공식 URL·검수 상태를 넣는다. 사용자가 원문을 모두 찾아 첨부하는 것은 선행 조건이 아니다.
