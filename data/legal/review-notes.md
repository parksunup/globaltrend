# 법제 검토 메모 — 공식 원문·번역·이용조건 확인 대기

조사 시도일: 2026-10-06 (Asia/Seoul) · 브랜치: `feat/legal-corpus-foundation`

## 조사 상태와 근거의 한계

README.md, architecture.md, docs/team-onboarding.md와 data/legal/의 제출 양식을 읽었습니다. 지정된 7개 법제만 목록에 넣었습니다. 본 메모는 접근 실패와 후속 확인 절차를 기록하며, 법적 해석·현행성·번역 유무·재배포 허가를 확정하지 않습니다.

공식 법령·기관·번역 조사·이용조건 페이지 18곳에 HTTPS 요청을 시도했으나 모두 `Tunnel connection failed: 403 Forbidden`이 발생했습니다. 대상 사이트 본문에서 받은 403이라는 증거가 아니라 **환경의 프록시 연결 단계에서 거부된 결과**입니다. 따라서 페이지가 없거나 기관이 접근을 금지했다고 단정하지 않습니다. TLS 검증을 끄거나 프록시를 우회하지 않았습니다.

`instruments.csv`의 `effective_date`와 `korean_translation_source_url`은 전부 빈 값입니다. 추정 날짜나 번역 검색 포털을 문서 직접 출처로 입력하지 않았습니다. `official_name`과 `official_url`은 확인 대상 후보이며, 원문으로 검수하기 전까지 모든 행의 `review_status`는 `blocked`입니다. `korean_translation_status`와 `reuse_status`는 `unreviewed`입니다. 자동 검사는 형식 검사이며 내용 확인을 대신하지 않습니다.

## 법제별 후속 확인

### kr-pipa — PIPA

- 관할권: 대한민국 (`KR`).
- 공식 법령명 확인 후보: 개인정보 보호법.
- [공식 원문 확인 대상](https://www.law.go.kr/법령/개인정보보호법) — 2026-10-06 프록시 단계 403; 본문 미열람.
- 국가법령정보센터의 개인정보 보호법에서 현행 표제·법률번호·공포일·시행일과 연혁을 확인합니다. 미래 시행 예정 개정과 현재 적용 조문을 구분해야 합니다.
- 한국어 원문 자체를 기준 문서로 사용하며 별도의 한국어 번역이 필요하다는 뜻이 아닙니다. 현재 공식 원문은 열람하지 못했습니다.
- 원문 이용조건: 법령 본문과 해설·편집·서식·웹페이지 자산의 권리를 분리해 확인합니다. 저작권법 제7조의 법령 관련 규정도 공식 본문으로 확인해야 합니다. 원문 열람 가능 여부만으로 전체 웹페이지 재배포가 허용된다고 판단하지 않습니다.
- [저작권법 제7조 확인 대상](https://www.law.go.kr/법령/저작권법/제7조)은 후속 확인 링크이며 이번 18개 요청에 포함하지 않았습니다.

### jp-appi — APPI

- 관할권: 일본 (`JP`).
- 공식 법령명 확인 후보: 個人情報の保護に関する法律 (Act on the Protection of Personal Information).
- [공식 원문 확인 대상](https://elaws.e-gov.go.jp/document?lawid=415AC0000000057) — 2026-10-06 프록시 단계 403; 본문 미열람.
- e-Gov의 법령 식별자 `415AC0000000057` 본문과 개정 연혁을 확인합니다. 일본 개인정보보호위원회(PPC)의 법령 안내·영문 자료는 대조 자료이며 한국어 번역의 존재를 입증하지 않습니다.
- 현행 통합본·각 개정의 시행일·경과조치를 확인합니다. 제정 연도나 특정 개정의 시행일을 현행 판본 전체의 단일 시행일로 입력하지 않습니다.
- 기존 한국어 번역: 세계법제정보센터와 개인정보 포털에서 법률명으로 검색한 뒤 실제 문서·첨부파일의 번역 주체·기준일·조문 완성 범위를 확인해야 합니다. 포털에도 접근하지 못했으므로 현재 존재 여부는 검토 필요입니다.
- 원문 이용조건: e-Gov와 PPC 각각의 이용규약·제3자 자료 예외를 확인합니다. 한국어 번역은 별도 저작자·제공기관·이용허락·출처표시·수정 표시 조건을 확인합니다.

### cn-pipl — PIPL

- 관할권: 중국 (`CN`).
- 공식 법령명 확인 후보: 中华人民共和国个人信息保护法 (Personal Information Protection Law of the People’s Republic of China).
- [공식 원문 확인 대상](https://www.gov.cn/xinwen/2021-08/21/content_5632486.htm) — 2026-10-06 프록시 단계 403; 본문 미열람.
- 국무원 사이트의 공포 당시 법문 후보와 전국인민대표대회(NPC)의 입법 기록을 대조해 공식 중국어 표제·공포일·시행일·이후 개정 여부를 확인합니다. 공포 당시 페이지를 현행 통합본으로 단정하지 않습니다.
- 기존 한국어 번역: 세계법제정보센터 등에서 개인정보보호법/个人信息保护法로 검색하고, 문서의 기준 판본·번역 주체·전체 조문 포함 여부를 확인합니다. 현재 유무·직접 출처는 검토 필요입니다.
- 원문 이용조건: 공식 법문과 사이트 편집·주석·부가자료를 구분하고, 사이트 정책 및 관련 권리 규정을 확인합니다. 한국어 번역의 재배포는 별도 확인해야 합니다.

### eu-gdpr — GDPR

- 관할권: 유럽연합 (`EU`).
- 공식 법령명 확인 후보: Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation).
- [공식 원문 확인 대상](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) — 2026-10-06 프록시 단계 403; 본문 미열람.
- EUR-Lex의 규정 식별자 `2016/679` 및 CELEX `32016R0679`를 확인합니다. 제공한 `/oj/eng` 링크는 관보 원문 확인 대상이며 최신 통합본을 확인했다는 뜻이 아닙니다.
- 관보 원문·정오표·통합본 기준일을 대조하고, 발효일과 적용 개시일을 구분합니다. 현행 판본과 날짜는 공식 본문 조회 후 기록합니다.
- 기존 한국어 번역: 세계법제정보센터·개인정보 포털에서 GDPR 문서별 번역을 찾아 출처·판본·정오표 반영·번역 범위를 확인합니다. 한국어 자료를 EU의 공식 한국어 법문이라고 표시하지 않습니다. 현재 존재 여부는 검토 필요입니다.
- 원문 이용조건: EUR-Lex legal notice에서 재사용·출처표시·제3자 권리·책임 관련 조건을 확인합니다. 한국어 번역의 이용조건은 해당 번역 제공자에게 별도로 확인합니다.

### gb-uk-gdpr — UK GDPR

- 관할권: 영국 (`GB`).
- 공식 법령명 확인 후보: UK GDPR — Regulation (EU) 2016/679 as incorporated into and amended in UK law (영국 적용 법문 공식 표제 검토 필요).
- [공식 원문 확인 대상](https://www.legislation.gov.uk/eur/2016/679/contents) — 2026-10-06 프록시 단계 403; 본문 미열람.
- legislation.gov.uk의 영국 적용 GDPR 본문과 개정·미반영 변경 안내를 확인합니다. EU GDPR과 영국 개정 법문을 구분하고, 남아 있는 EU 원문 표제만으로 현행 영국 법률의 공식 표제를 확정하지 않습니다.
- 현행 본문에서 적용된 개정, 아직 적용되지 않은 개정, 각 조항의 시행 시점을 확인합니다. 아래 보완 법령과의 관계도 조항별로 확인합니다.
- 기존 한국어 번역: UK GDPR이라는 명칭으로 제공된 자료가 실제 영국 개정 법문인지, EU GDPR 번역을 재사용한 것인지 확인합니다. DPA 2018 한국어 번역이 있더라도 UK GDPR 번역의 존재를 대신 입증하지 않습니다. 현재 존재 여부·직접 출처는 검토 필요입니다.
- 원문 이용조건: legislation.gov.uk copyright 안내와 Open Government Licence v3의 적용 범위·예외·출처표시·비보증 조건을 읽어야 합니다. OGL 링크가 있다는 이유만으로 한국어 번역 제공자의 권리까지 포함됐다고 판단하지 않습니다.

### us-ca-ccpa — CCPA

- 관할권: 미국 캘리포니아주 (`US-CA`).
- 공식 법령명 확인 후보: California Consumer Privacy Act of 2018 (California Civil Code, Division 3, Part 4, Title 1.81.5).
- [공식 원문 확인 대상](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5.) — 2026-10-06 프록시 단계 403; 본문 미열람.
- California Legislative Information의 Civil Code Title 1.81.5 현행 조문을 확인합니다. CCPA 제정 법률과 CPRA 등 후속 개정이 반영된 현행 조문을 구분합니다.
- 개정별 효력 발생·적용 개시·집행 개시를 구분하고, 조항별 경과규정과 변경 이력을 확인합니다. CPPA 시행규정은 법률 본문과 다른 자료이며 필요하면 검토 메모로 연결합니다.
- 기존 한국어 번역: 번역이 CCPA 최초 법문인지 CPRA 반영본인지, 시행규정까지 포함했는지 구분합니다. 세계법제정보센터·개인정보 포털의 실제 번역 문서와 조건을 확인해야 하며 현재 존재 여부는 검토 필요입니다.
- 원문 이용조건: 입법정보 사이트 및 제공기관의 정책을 확인합니다. 한국어 번역·주석·민간 해설의 권리는 법률 원문과 별개로 검토합니다.

### sg-pdpa — PDPA

- 관할권: 싱가포르 (`SG`).
- 공식 법령명 확인 후보: Personal Data Protection Act 2012.
- [공식 원문 확인 대상](https://sso.agc.gov.sg/Act/PDPA2012) — 2026-10-06 프록시 단계 403; 본문 미열람.
- Singapore Statutes Online의 PDPA 본문에서 현행판·과거판 선택, 개정 반영일, 시행 관련 기록을 확인합니다. SSO 문서 식별자 `PDPA2012`와 법령 표제도 대조합니다.
- 최초 법률과 이후 개정의 단계별 시행을 구분합니다. PDPC 안내·하위규정은 법률 본문과 구분해서 참고합니다.
- 기존 한국어 번역: 세계법제정보센터·개인정보 포털에서 실제 문서와 기준 판본·작성자·누락 여부를 확인합니다. 영문 원문이나 기관 설명서를 한국어 법률 전문 번역으로 표시하지 않습니다. 현재 존재 여부는 검토 필요입니다.
- 원문 이용조건: SSO와 PDPC 각각의 사용·복제·재배포 조건 및 제3자 자료 예외를 확인합니다. 한국어 번역은 제공자별 허락을 별도로 확인합니다.

## UK GDPR과 연결해 확인할 영국 보완 법령

추가 비교 기준·CSV 행을 만들지 않고, 다음은 영국 법제의 후속 확인 대상으로만 기록합니다. 아래 법문도 이번 요청에서 모두 프록시 403으로 차단되어 시행일·개정 관계는 미확인입니다.

| 법령 확인 후보 | 공식 법문 확인 대상 | 확인할 관계·시행 사항 |
| --- | --- | --- |
| Data Protection Act 2018 | https://www.legislation.gov.uk/ukpga/2018/12/contents | UK GDPR의 보완 규정과 별도 처리 체계·면제·집행 규정의 적용 범위 및 조항별 개정·시행 확인 필요 |
| Data (Use and Access) Act 2025 | https://www.legislation.gov.uk/ukpga/2025/18/contents | UK GDPR 및 DPA 2018 변경 관계·commencement 규정·단계별 시행·미시행 조항 확인 필요; 이미 전부 시행됐다고 가정하지 않음 |

관련 commencement regulations와 영국의 EU 탈퇴 관련 GDPR 개정 법령은 위 공식 법문의 개정·시행 링크에서 정확한 식별자를 확인한 뒤 추가합니다. 현재 식별자·적용일은 추정하여 작성하지 않았습니다. 보완 법령 전체를 UK GDPR이라는 단일 법률과 동일시하지 않습니다.

## 한국어 번역 조사 경로와 재배포 확인 항목

- [세계법제정보센터](https://world.moleg.go.kr/)와 [개인정보 포털](https://www.privacy.go.kr/)은 검색 출발점 후보이며, 특정 법률의 한국어 번역이 있다는 증거가 아닙니다. 두 사이트 모두 열람 실패했습니다.
- 문서를 찾으면 직접 URL·첨부파일명·발행기관/번역자·번역일·원문 판본·전체/부분 범위·공식/참고/민간 번역 구분을 기록합니다. 검색 결과 없음만으로 번역이 없다고 단정하지 않습니다.
- 원문과 번역 각각에 대해 열람, 수집, 저장, 번역/수정, 공개 발췌, 전문 재배포의 허용 여부를 구분하고 조건의 직접 URL·확인일·적용 문서를 기록합니다.
- 공공누리·OGL 등 표지가 발견되더라도 유형·적용 범위·출처표시·변경 표시·상업 이용·변경 허용·제3자 권리 예외를 실제 조건에서 확인합니다. 공개 홈페이지·다운로드 가능 여부만으로 허가를 확정하지 않습니다.
- 조건을 확인하지 못했으므로 이번 결과에는 원문·번역 전문을 복사하지 않았고 재배포를 허용한다고 표시하지 않았습니다.

## 실제 접근 시도 기록

아래 모든 URL의 결과는 `HTTPS 프록시 연결 단계 403; 본문 미확인`입니다. 법령명이 포함된 한글 URL은 요청 시 UTF-8 URL 인코딩했습니다.

| 조사 대상 | 요청 URL | 결과 |
| --- | --- | --- |
| kr-pipa | https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%EB%B2%95 | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| jp-appi | https://elaws.e-gov.go.jp/document?lawid=415AC0000000057 | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| jp-authority | https://www.ppc.go.jp/en/legal/ | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| cn-pipl | https://www.gov.cn/xinwen/2021-08/21/content_5632486.htm | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| cn-legislature | https://www.npc.gov.cn/ | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| eu-gdpr | https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| gb-uk-gdpr | https://www.legislation.gov.uk/eur/2016/679/contents | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| gb-dpa2018 | https://www.legislation.gov.uk/ukpga/2018/12/contents | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| gb-duaa2025 | https://www.legislation.gov.uk/ukpga/2025/18/contents | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| us-ca-ccpa | https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5. | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| us-ca-authority | https://oag.ca.gov/privacy/ccpa | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| sg-pdpa | https://sso.agc.gov.sg/Act/PDPA2012 | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| sg-authority | https://www.pdpc.gov.sg/ | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| korean-translation-portal | https://world.moleg.go.kr/ | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| privacy-portal | https://www.privacy.go.kr/ | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| uk-reuse | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| uk-copyright | https://www.legislation.gov.uk/copyright | HTTPS 프록시 연결 단계 403; 본문 미확인 |
| eu-reuse | https://eur-lex.europa.eu/content/legal-notice/legal-notice.html | HTTPS 프록시 연결 단계 403; 본문 미확인 |

## 남은 작업과 완료 조건

### 형식 검증 결과

- `node scripts/validate-team-data.mjs`: 통과.
- `pnpm --config.verify-deps-before-run=false run validate:data`: 통과. 현재 담당 브랜치와 기존 개발 환경의 의존성 목록이 달라 일반 `pnpm validate:data`는 자동 재설치를 시도하다 비대화형 환경에서 중단됐습니다. 이 작업은 외부 의존성 없이 실행되는 기존 Node 검사 스크립트만 사용하므로, 의존성 자동 재설치를 생략하고 같은 데이터 검사를 실행했습니다. 검사 항목을 끄거나 저장소 설정을 바꾸지 않았습니다.
- CSV 7개 행과 Markdown의 ID·법률명·공식 URL 대응을 확인했습니다. 미확인 시행일·번역 직접 URL은 비워 두었습니다.
- 앱 코드·Supabase·인증·환경변수 파일과 공용 양식·비교 기준은 변경하지 않았습니다. 브랜치 전환 후 보이는 기존 로컬 Supabase 생성 폴더는 수정하거나 조사 결과에 포함하지 않았습니다.

공식 법령·번역 조사에 필요한 15개 호스트의 허용 목록을 환경 설정 초안에 저장했습니다. 초안 저장만으로 현재 네트워크 권한이 적용되지는 않습니다. 기존 패키지 관리자 프리셋과 설치·시작 지침은 유지했습니다. 환경 설정에서 변경을 검토·저장하고 게시해야 하며, 적용 후 각 요청을 다시 확인해야 합니다.

허용 요청 호스트: `www.law.go.kr`, `elaws.e-gov.go.jp`, `www.ppc.go.jp`, `www.npc.gov.cn`, `www.gov.cn`, `eur-lex.europa.eu`, `www.legislation.gov.uk`, `www.nationalarchives.gov.uk`, `sso.agc.gov.sg`, `www.pdpc.gov.sg`, `leginfo.legislature.ca.gov`, `oag.ca.gov`, `cppa.ca.gov`, `world.moleg.go.kr`, `www.privacy.go.kr`。CPPA는 시행규정 후속 조사용이며 이번 18개 요청에는 포함하지 않았습니다.

접근이 가능해지면 공식 본문·개정 연혁·시행 근거·한국어 번역 직접 출처·원문과 번역의 이용조건을 확인하고, Markdown과 CSV를 함께 갱신합니다. 원문 확인과 사람 검수 없이 `verified`로 바꾸지 않습니다. 현재의 형식 검사 통과는 실질 조사 완료를 뜻하지 않습니다.
