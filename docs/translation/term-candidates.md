# 번역 용어 후보 검토표

## 이 문서의 범위

현재 사용 중인 번역에서 먼저 점검할 후보를 추렸습니다. **후보라는 이유로 오역이라고 판단한 것이 아닙니다. 1차 후보 44개에 대한 사용자 결정을 기록했으며, 기존 번역의 일괄 수정은 아직 수행하지 않았습니다.**

- 대상: 동향 21건의 편집본, 외국법 6개 한국어 전문 초안, 한국을 포함한 7법제 비교셀 119개. 한국법은 별도 번역본이 아닌 비교셀을 확인했습니다.
- EU GDPR은 실제 전문 읽기에 쓰는 `data/derived/gdpr.json`을 읽었습니다. 동일 내용을 다시 렌더링한 Markdown·HTML과 원 조사본은 중복 집계하지 않았습니다.
- 원어는 검토 대상 개념명입니다. 모든 예문에서 해당 원어가 사용됐는지 원문을 대조한 결과는 아닙니다.
- 예문과 위치는 저장소에서 추출했습니다. 수치는 해당 표현이 들어 있는 필드 수이며 단어 빈도·법률 중요도·오류 건수를 뜻하지 않습니다.
- 기초모델 → 파운데이션 모델은 사용자 선호가 명확한 항목입니다. 이번 단계에서는 후보표에 기록하고 원고는 변경하지 않았습니다.

## 사용자 지정 용어 · 2026-10-18

| 원어 | 지정 표기 | 적용 기준 |
|---|---|---|
| foundation model | 파운데이션 모델 | AI 문맥에 적용. 출처 원제·직접 인용·원 조사 기록은 보존 |
| agentic AI | 에이전트 AI | 현재 표현 유지. AI agent와의 개념 차이는 원어와 문맥에 따라 확인 |
| secure multiparty computation | 안전한 다자간 연산(MPC) | 독립적으로 읽는 자료의 첫 등장에 약자 병기. 출처 원문 표기는 보존 |
| neurodata | 신경 데이터 | 띄어쓰기 통일. 생체정보와 범위 동일시 금지 |
| special categories of personal data | 특별한 유형의 개인정보 | 첫 등장에 원어와 설명 병기. 한국법 민감정보와 범위 동일시 금지 |
| pseudonymisation / pseudonymised data | 가명처리 / 가명정보 | 행위와 결과물 구분. 법률별 정의·요건·범위와 별도 법률 용어 유지 |
| anonymisation / anonymous information | 익명처리 / 익명정보 | 행위와 결과물 구분. 법률별 정의·요건·범위와 별도 법률 용어 유지 |
| deidentified information | 비식별화 / 비식별정보 | 행위와 결과물 구분. CCPA 정의·요건은 별도 설명하고 익명정보와 일괄 통합하지 않음 |
| automated decision-making | 자동화된 의사결정 | 공통 해설의 기본 표기. 각 법률의 명칭과 적용 요건은 구분 |
| profiling | 프로파일링 | 원어 병기 없이 사용. 정의는 해당 법률에 맞춰 설명 |
| lead supervisory authority | 선임 감독기관(lead supervisory authority) | 첫 등장에 원어 병기 및 역할 설명 |
| reprimand | 견책(reprimand) | 첫 등장에 원어 병기. warning과 구분 |
| remedy / redress | 구제 / 구제수단 | 배상은 문맥에 따라 구분. judicial remedy는 사법적 구제 |
| binding decision | 구속력 있는 결정 | 원어 병기 없이 사용 |
| adequacy decision | 적정성 결정 | 원어 병기 없이 사용. 국가별 별도 제도 명칭과 법적 근거 구분 |
| legitimate interests | 정당한 이익 | 원어 병기 없이 사용. 법률별 적용 요건과 범위는 별도 설명 |
| accountability | 책임성 | 원어 병기 없이 사용 |
| data protection by design and by default | 설계 및 기본 설정에 의한 개인정보 보호 | privacy by design만을 가리키는 경우와 구분 |
| micro, small and medium-sized enterprises | 영세·중소기업 | 첫 등장에 원어 병기. 한국법의 기업 분류와 구분 |
| information notice | 정보제출 요구 통지(information notice) | 감독기관의 정보 제출 요구 문맥. 첫 등장 원어 병기 |
| confidential waste | 폐기 대상 기밀문서 | 문서·기록물을 가리키는 경우에 적용. 다른 매체는 원문에 따라 별도 표현 |
| compatibility of purposes | 목적 간 양립가능성 | 당초 수집 목적과 추가 이용 목적의 관계를 설명하는 문맥에 적용 |
| deemed consent | 동의 간주 / 동의한 것으로 본다 | 명칭과 문장 표현 구분. 성립 요건은 조항별 설명 |
| sale / sharing · CCPA | 판매 / 공유 | 원어 병기 없이 각각의 정의 설명 |
| business / service provider / contractor · CCPA | 사업자 / 서비스 제공자 / 계약자(contractor) | contractor는 첫 등장에 원어 병기. 세 역할의 정의 구분 |
| 个人信息处理者 · 중국 PIPL | 개인정보처리자 | 원어 병기 없이 중국법의 정의 설명. GDPR 용어와 구분 |
| 单独同意 · 중국 PIPL | 별도 동의 | 원어 병기 없이 사용. 조항별 적용 상황과 요건 설명 |
| 重要数据 · 중국법 | 중요 데이터 | 띄어쓰기 및 원어 병기 없이 사용. 해당 법령·제도의 용어임을 설명 |
| 要配慮個人情報 · 일본 APPI | 요배려 개인정보(배려가 필요한 정보) | 첫 등장에 괄호 설명, 이후 요배려 개인정보로 표기. 일본법 정의 유지 |
| 保有個人データ / 保有個人情報 · 일본 APPI | 보유 개인데이터 / 보유 개인정보 | 각 용어의 정의를 구분하여 유지 |
| 仮名加工情報 / 匿名加工情報 · 일본 APPI | 가명가공정보 / 익명가공정보 | 붙여쓰기, 원어 병기 없이 사용. 일본법의 정의 유지 |
| 個人関連情報 · 일본 APPI | 개인관련정보 | 붙여쓰기, 원어 병기 없이 사용. 일본법의 별도 용어임을 설명 |
| recipient | 수신자 | 개인정보를 제공받는 주체를 가리키는 법제 문맥. 해당 법률 정의 유지 |
| restriction of processing | 처리 제한 / 처리 제한권 | 띄어쓰기. 법률별 정의·요건 구분 |
| data portability | 개인정보 이동권(전송요구권) | 공통 안내·해설에 사용. 법률별 권리의 요건·범위와 조문 명칭은 보존 |
| confidentiality | 기밀성 | 원어 병기 없이 사용. 익명성과 구분 |
| call for evidence / consultation | 모집 대상·절차에 따라 구체적으로 표현 | 자료·사례 수집, 의견·자료 모집, 의견수렴 등을 문맥에 따라 구분 |
| disclose / disclosure | 제공 / 공개 / 고지·알림·정보 제공 | 전달 대상·방식과 법률 문맥에 따라 구분. 법률상 범위는 풀어 설명 |
| personal data breach / data breach 등 | 사실에 따른 유출·침해 등 구체적 표현 | 사건 사실과 국가별 법률 정의에 따라 풀어 씀. 단일 용어로 일괄 치환하지 않음 |
| controller | 컨트롤러 | EU·UK GDPR 개념을 유지. 다른 법률의 정의 용어에는 자동 적용하지 않음 |
| processor | 프로세서 | EU·UK GDPR 개념을 유지. PIPL 개인정보처리자와 구별 |
| data intermediary | 데이터 중개자 | 싱가포르 PDPA의 법률상 정의를 첫 등장에 설명 |
| privacy-enhancing technologies | 개인정보 보호 강화 기술(PET) | 한국어 명칭 뒤 영문 약자 병기. 한국어 대체 명칭의 채택 여부는 별도 검토 |
| trusted execution environment | 신뢰실행환경(TEE) | 한국어 명칭 뒤 영문 약자 병기. 한국어 표기 자체의 국내 용례는 별도 검토 |

근거는 사용자 직접 결정이며 외부 표준 확정을 뜻하지 않습니다. 상세 적용 기준은 [프로젝트 용어집](glossary.md)을 따릅니다. 아래 후보표의 기존 표현은 실제 원고에서 추출한 기록으로 보존합니다.

## 우선순위

먼저 국내 용례와 직역 표현을 확인하고, 그 다음 법률상 정의를 구별해야 하는 용어를 확인합니다. 법률 개념은 표현이 낯설다는 이유만으로 한국법 용어로 통합하지 않습니다.

| ID | 원어·개념 후보 | 실제 사용 표현 | 검토 유형 | 확인 방향 |
|---|---|---|---|---|
| TERM-001 | foundation model | 기초모델 | 국내 용례 | 파운데이션 모델을 사용자 선호안으로 기록. AI 문맥인지 확인 후 표기 결정. |
| TERM-002 | agentic AI | 에이전트 AI | 국내 용례 | 에이전트 AI / 에이전틱 AI / AI 에이전트를 원문 개념별로 구별. |
| TERM-003 | privacy-enhancing technologies (PETs) | 개인정보 보호 강화 기술 | 국내 용례 | 개인정보 보호 강화 기술 / 프라이버시 강화 기술의 국내 기관 용례 비교. |
| TERM-004 | trusted execution environment (TEE) | 신뢰실행환경 | 국내 용례 | 국내 기술 자료에서 채택하는 한국어 명칭·약어 병기 확인. |
| TERM-005 | secure multiparty computation (SMPC/MPC) | 안전한 다자간 연산 / 다자간 연산 | 국내 용례 | 국내 암호기술 자료의 안전한 다자간 계산 등과 대조. |
| TERM-006 | neurodata | 신경데이터 | 표기 일관성 | 신경데이터 / 신경 데이터 중 편집 표기 선택. 생체정보와 범위 동일시 금지. |
| TERM-007 | controller | 처리책임자 / 개인정보처리자 / 컨트롤러 | 법률별 개념 | EU·UK 정의에 대응하는 번역과 국내 해설 용례를 비교. 일괄 치환 금지. |
| TERM-008 | processor | 수탁처리자 / 프로세서 / 처리수탁자 | 법률별 개념 | GDPR processor의 번역을 법률별로 관리. PIPL 개인정보처리자와 별도. |
| TERM-009 | special categories of personal data | 특별 범주 | 법률별 개념 | GDPR 제9조 개념을 보존하면서 첫 등장 설명과 번역 명칭 검토. |
| TERM-010 | pseudonymisation / pseudonymised data | 가명처리 / 가명정보 | 법률별 개념 | 법률별 정의와 행위·결과물의 구별을 기록. 번역을 일률 통합하지 않음. |
| TERM-011 | anonymisation / anonymous information | 익명화 / 익명정보 / 익명처리 | 법률별 개념 | 가명처리와 구별하고 법률별 식별가능성 요건에 따라 사용. |
| TERM-012 | deidentified information | 비식별 / 비식별화 | 법률별 개념 | CCPA 정의·요건을 먼저 확인한 뒤 국문 명칭 결정. |
| TERM-013 | automated decision-making | 자동화된 의사결정 / 자동화 결정 | 법률별 개념 | 동향의 일반 표현과 법제 번역의 정의·요건을 함께 검토. |
| TERM-014 | profiling | 프로파일링 | 표기 일관성 | 국내 실무 표기와 원문 정의에 맞춰 통일 범위 결정. |
| TERM-015 | lead supervisory authority | 수석감독기구 | 국내 용례 | 국내 GDPR 자료의 선임·주도 등 용례와 정의를 대조. |
| TERM-016 | reprimand | 견책 | 법률별 개념 | 감독기구의 시정권한 중 reprimand와 warning을 따로 확인. |
| TERM-017 | remedy / redress | 배상 / 구제 | 법률별 개념 | 개별 원문을 확인해 구제수단·소송·배상을 구분. |
| TERM-018 | binding decision | 구속력 있는 결정 | 표기 일관성 | 동일 기관·동일 유형 결정의 명칭 일관성 확인. |
| TERM-019 | adequacy decision | 적정성 결정 | 법률별 개념 | 제도·국가별 원어와 법적 근거를 구분하여 관리. |
| TERM-020 | legitimate interests | 정당한 이익 | 법률별 개념 | 표현 변경보다 법률별 적용범위 주석과 정의 연결 우선. |
| TERM-021 | accountability | 책임성 | 국내 용례 | 개인정보위 자료의 문맥과 EU 원칙 설명을 비교. |
| TERM-022 | data protection by design and by default | 기본설정 / 설계에 의한 / 설계 및 기본 | 국내 용례 | privacy by design과 GDPR 조문 제목을 구별하여 표기안 검토. |
| TERM-023 | micro, small and medium-sized enterprises | 초소형기업 / 영세·중소기업 | 법률별 개념 | 기존 terminology-change-manifest와 원문·국내 용례를 함께 검토. 한국 기업규모 정의와 동일시 금지. |
| TERM-024 | information notice | 정보요구 통지 | 법률별 개념 | 원문 법정 명칭을 병기하고 설명형 번역과 조문 명칭을 검토. |
| TERM-025 | confidential waste | 기밀 폐기물 | 국내 용례 | 원문에서 폐기 대상 문서·기록물인지 확인한 뒤 설명형 표현 검토. |
| TERM-026 | compatibility of purposes | 양립성 | 국내 용례 | 목적 간 양립가능성 등 기존 GDPR 해설과 비교. |
| TERM-027 | data intermediary | 처리수탁자 / 데이터 중개자 | 법률별 개념 | PDPA 정의 용어임을 유지하고 수탁처리자와의 대응 관계는 별도 설명. |
| TERM-028 | deemed consent | 동의한 것으로 / 동의 간주 | 법률별 개념 | 조문별 유형·성립 조건을 원문과 대조하여 명칭 결정. |
| TERM-029 | sale / sharing (CCPA) | 판매 / 공유 | 법률별 개념 | CCPA의 두 정의를 별도 항목으로 나눠 원어와 정의 범위를 연결. |
| TERM-030 | business / service provider / contractor | 사업자 / 서비스 제공자 / 계약수행자 / 계약자 | 법률별 개념 | 역할별 원어 및 국문 번역을 따로 정리. |
| TERM-031 | 个人信息处理者 | 개인정보처리자 | 법률별 개념 | 현행 번역 유지 가능성을 포함해 controller와 대응 차이 명시. |
| TERM-032 | 单独同意 | 별도 동의 | 법률별 개념 | 단독·별도·개별 중 국내 PIPL 자료와 원문 용례 비교. |
| TERM-033 | 重要数据 | 중요데이터 | 법률별 개념 | 근거 법률과 원어 확인 후 띄어쓰기·설명 기준 결정. |
| TERM-034 | 要配慮個人情報 | 배려가 필요한 개인정보 | 법률별 개념 | 국내 일본법 해설의 명칭을 비교하고 정의 차이를 유지. |
| TERM-035 | 保有個人データ / 保有個人情報 | 보유개인데이터 / 보유개인정보 | 법률별 개념 | 붙여쓰기와 개념 대응을 함께 점검. 표현을 하나로 합치지 않음. |
| TERM-036 | 仮名加工情報 / 匿名加工情報 | 가명가공정보 / 익명가공정보 | 법률별 개념 | 가공을 포함한 번역과 첫 등장 정의 설명을 검토. |
| TERM-037 | 個人関連情報 | 개인관련정보 | 법률별 개념 | 정의 용어임을 알 수 있는 설명과 국내 용례 확인. |
| TERM-038 | recipient | 수신자 / 수령자 | 표기 일관성 | 원문 역할이 같은 경우의 국문 통일 여부를 판단. |
| TERM-039 | restriction of processing | 처리 제한 / 처리제한 | 법률별 개념 | 권리 명칭과 감독기관 권한 문맥을 구별한 표기 검토. |
| TERM-040 | personal data breach | 개인정보 침해 / 개인정보 유출 | 법률별 개념 | 원문의 breach 정의와 사건 유형에 따라 번역 범위를 구분. |
| TERM-041 | data portability | 이동권 | 법률별 개념 | 국가별 권리 명칭과 범위를 분리 관리. |
| TERM-042 | confidentiality | 기밀성 | 표기 일관성 | 원어 confidentiality 확인 후 기술·법률 문맥별 명칭 검토. 익명성으로 바꾸지 않음. |
| TERM-043 | call for evidence / consultation | 의견수렴 / 의견 모집 / 근거를 요청 | 국내 용례 | 절차별 원제와 국내 기관 보고서 용례 비교. 동의어로 단순 합치지 않음. |

## 먼저 확인할 후보 10개

아래 순서는 검토 우선 제안이며 번역 확정안이 아닙니다.

| 후보 | 저장소에서 확인한 표현 | 먼저 확인할 이유 |
|---|---|---|
| foundation model | 기초모델 | 사용자 선호 표현인 파운데이션 모델과 차이 |
| controller | 처리책임자 / 개인정보처리자 / 컨트롤러 | 동향과 EU·UK 법제 사이 명칭 차이 |
| processor | 수탁처리자 / 프로세서 / 처리수탁자 | UK 법문·고려사항·비교셀 사이 표기 차이 |
| data intermediary | 처리수탁자 / 데이터 중개자 | 싱가포르 전문 정의와 비교표의 명칭 차이 |
| contractor 등 CCPA 역할 명칭 | 계약자 / 계약수행자 | 원어 역할과 국문 명칭의 대응 확인 필요 |
| lead supervisory authority | 수석감독기구 | 국내 GDPR 전문 자료의 명칭 대조 필요 |
| secure multiparty computation | 안전한 다자간 연산 | 암호기술 분야의 국내 표준 용례 대조 필요 |
| confidential waste | 기밀 폐기물 | 종이 기록물 폐기 문맥에서 적절한 표현인지 확인 필요 |
| special categories of personal data | 특별 범주 | 정의가 불분명하게 읽히는지와 한국 민감정보와의 구별 확인 |
| recipient | 수신자 / 수령자 | 같은 역할의 번역 차이인지, 통신 수신자 등 별도 문맥인지 구별 |

## 실제 사용 예문과 위치

### TERM-001 · foundation model

- 검토 이유: 사용자님이 지적하신 직역 표현.
- 관찰된 표기: 기초모델
- 확인 방향: 파운데이션 모델을 사용자 선호안으로 기록. AI 문맥인지 확인 후 표기 결정.
- 위치 수: 3개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **파운데이션 모델**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ico-foundation-agentic-ai-2026/title_ko`

> 영국 ICO, 기초모델 개발사 보호조치 개선 현황 공개 및 에이전트 AI 의견 모집

### TERM-002 · agentic AI

- 검토 이유: agent와 agentic의 관계 및 국내 용례 확인 필요.
- 관찰된 표기: 에이전트 AI
- 확인 방향: 에이전트 AI / 에이전틱 AI / AI 에이전트를 원문 개념별로 구별.
- 위치 수: 3개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **에이전트 AI**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ico-foundation-agentic-ai-2026/title_ko`

> 영국 ICO, 기초모델 개발사 보호조치 개선 현황 공개 및 에이전트 AI 의견 모집

### TERM-003 · privacy-enhancing technologies (PETs)

- 검토 이유: 긴 직역과 기술 분야 관용어의 정합성 검토.
- 관찰된 표기: 개인정보 보호 강화 기술
- 확인 방향: 개인정보 보호 강화 기술 / 프라이버시 강화 기술의 국내 기관 용례 비교.
- 위치 수: 3개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **개인정보 보호 강화 기술(PET)**. 독립적으로 읽는 자료의 첫 등장에 한국어 명칭 뒤 (PET)를 병기. 영어 정식 명칭의 복수형 PETs와의 관계를 유지하되 사용자 표시 선호는 PET. 다른 한국어 명칭 후보 전체가 승인된 것은 아님.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `oecd-pet-ai-sharing/title_ko`

> OECD, 개인정보 보호 강화 기술을 활용한 AI 모델 공동 개발·공유 방안 소개

### TERM-004 · trusted execution environment (TEE)

- 검토 이유: 띄어쓰기 및 표준 용어 확인 필요.
- 관찰된 표기: 신뢰실행환경
- 확인 방향: 국내 기술 자료에서 채택하는 한국어 명칭·약어 병기 확인.
- 위치 수: 1개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **신뢰실행환경(TEE)**. 독립적으로 읽는 자료의 첫 등장에 한국어 명칭 뒤 (TEE)를 병기. 한국어 명칭과 띄어쓰기의 외부 용례 대조는 별도 진행.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `oecd-pet-ai-sharing/details_ko`

> …입력 데이터의 기밀성을 유지하고 이용을 최소화하면서 AI 모델의 성능을 높이는 유형으로, 신뢰실행환경·연합학습·안전한 다자간 연산을 예시로 제시  - 둘째는 모델 자체의 기밀성을 유지하면서 공동 개발·공유하는 유형으로, 차등 프라이버시·신뢰실행환경·동형암호 등을 예시로 제시  - 이러한 기술은 추가 데이터 수집의 필요를 줄이고 데이터 공유 협력을 지원할 수 있으며, 여러 기…

### TERM-005 · secure multiparty computation (SMPC/MPC)

- 검토 이유: 연산·계산·보안 수식어 번역 선택 필요.
- 관찰된 표기: 안전한 다자간 연산 / 다자간 연산
- 확인 방향: 국내 암호기술 자료의 안전한 다자간 계산 등과 대조.
- 위치 수: 1개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **안전한 다자간 연산(MPC)**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `oecd-pet-ai-sharing/details_ko`

> … 유지하고 이용을 최소화하면서 AI 모델의 성능을 높이는 유형으로, 신뢰실행환경·연합학습·안전한 다자간 연산을 예시로 제시  - 둘째는 모델 자체의 기밀성을 유지하면서 공동 개발·공유하는 유형으로, 차등 프라이버시·신뢰실행환경·동형암호 등을 예시로 제시  - 이러한 기술은 추가 데이터 수집의 필요를 줄이고 데이터 공유 협력을 지원할 수 있으며, 여러 기술을 조합하면 개별 기…

### TERM-006 · neurodata

- 검토 이유: 기술 명칭 및 띄어쓰기 확인 필요.
- 관찰된 표기: 신경데이터
- 확인 방향: 신경데이터 / 신경 데이터 중 편집 표기 선택. 생체정보와 범위 동일시 금지.
- 위치 수: 3개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **신경 데이터**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `oecd-neurodata-governance/title_ko`

> OECD, 신경데이터 생애주기별 거버넌스 과제 분석 보고서 소개

### TERM-007 · controller

- 검토 이유: EU·UK의 목적·수단 결정자를 국내 수탁자 등과 혼동할 위험.
- 관찰된 표기: 처리책임자 / 개인정보처리자 / 컨트롤러
- 확인 방향: EU·UK 정의에 대응하는 번역과 국내 해설 용례를 비교. 일괄 치환 금지.
- 위치 수: 596개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **컨트롤러**. EU·UK GDPR의 controller 개념은 컨트롤러로 유지. 중국 PIPL의 개인정보처리자 등 다른 법률의 정의 용어에는 이 결정을 확장하지 않음.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `cnil-electronic-invoicing-2026/details_ko`

> …업상 비밀 보호를 고려해 처리하도록 안내  - 처리 목적을 정하는 발행 기업은 원칙적으로 처리책임자, 기업의 지시에 따라 처리하는 플랫폼은 수탁처리자에 해당한다고 설명하고, 이에 따른 계약·보안·비밀유지·활동 기록 관리를 요구. 다만 플랫폼이 정보를 자체 목적으로 재이용하면 역할 판단이 달라질 수 있다고 설명  - 회계 문서의 법정 10년 보유기간이 전자 송장에도 적용되며,…

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `curia-c526-24/details_ko`

> …만으로 과도하거나 남용적인 요구에 해당할 가능성이 배제되는 것은 아니라고 설명  - 다만 개인정보처리자가 GDPR 위반에 따른 손해배상 청구 조건을 인위적으로 만들려는 요청자의 의도를 입증하는 경우를 전제로 제시  - 실제 분쟁은 독일 국내법원이 구체적 사정을 살펴 해결하며, 열람 요구를 거부할 수 있는지 역시 해당 조건과 입증을 토대로 개별 판단

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `article-3-1-text-1/korean_text`

> (1) 이 규정은 영국 내 컨트롤러 또는 프로세서의 사업장 활동과 관련하여 이루어지는 개인정보 처리에 적용되며, 그 처리가 영국 내에서 이루어지는지는 관계없다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-10/korean_text`

> …적용되도록 보장하여야 한다. 법적 의무의 준수, 공익을 위하여 수행되는 업무의 수행 또는 개인정보처리자에게 부여된 공적 권한의 행사를 위한 개인정보 처리와 관련하여, 회원국이 이 규정의 규칙의 적용을 더욱 구체화하기 위한 국내 규정을 유지하거나 도입할 수 있도록 하여야 한다. 회원국에는 지침 95/46/EC를 이행하는 일반적이고 분야 전반에 적용되는 개인정보 보호법과 함께,…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--EU/major_exceptions`

> … 처리와 파일시스템에 속하거나 속하도록 의도된 비자동화 처리에 적용된다. 고려사항 26은 개인정보처리자 또는 다른 사람이 직접·간접 식별에 합리적으로 사용할 가능성이 있는 모든 수단(특정 개인 구별 포함)과 비용·시간·당시 기술 및 기술 발전을 고려하며, 추가정보로 귀속 가능한 가명정보와 익명정보를 구별한다. 고려사항 14는 법인 자체의 명칭·형태·연락처 정보, 고려사항 2…

### TERM-008 · processor

- 검토 이유: 각 법률의 처리 주체 명칭과 수탁 관계를 구별해야 함.
- 관찰된 표기: 수탁처리자 / 프로세서 / 처리수탁자
- 확인 방향: GDPR processor의 번역을 법률별로 관리. PIPL 개인정보처리자와 별도.
- 위치 수: 299개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **프로세서**. EU·UK GDPR의 processor 개념은 프로세서로 유지. 다른 법률의 위탁 주체 명칭에 자동 적용하지 않음.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `cnil-electronic-invoicing-2026/details_ko`

> … 목적을 정하는 발행 기업은 원칙적으로 처리책임자, 기업의 지시에 따라 처리하는 플랫폼은 수탁처리자에 해당한다고 설명하고, 이에 따른 계약·보안·비밀유지·활동 기록 관리를 요구. 다만 플랫폼이 정보를 자체 목적으로 재이용하면 역할 판단이 달라질 수 있다고 설명  - 회계 문서의 법정 10년 보유기간이 전자 송장에도 적용되며, 수탁자의 자체 재이용에는 최초 처리 목적과의 양립…

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `article-3-1-text-1/korean_text`

> (1) 이 규정은 영국 내 컨트롤러 또는 프로세서의 사업장 활동과 관련하여 이루어지는 개인정보 처리에 적용되며, 그 처리가 영국 내에서 이루어지는지는 관계없다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `cross_border_transfer--GB/korean_summary`

> …른 승인, 적절한 보호조치 또는 특정 상황 예외를 필요로 한다. 제46조는 개인정보처리자·처리수탁자가 합리적·비례적으로 보호 테스트 충족 여부를 판단하는 경로와, 공공기관이 법적 문서를 근거로 판단하는 별도 경로를 구별한다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-13/korean_text`

> …, 모든 회원국의 자연인에게 법적으로 집행 가능한 동일한 수준의 권리를, 개인정보처리자와 수탁처리자에게 동일한 수준의 의무와 책임을 제공하며, 개인정보 처리에 대한 일관된 감시, 모든 회원국에서의 동등한 제재 및 서로 다른 회원국 감독기관 간의 효과적인 협력을 보장하는 규정이 필요하다. 역내시장이 제대로 기능하려면 개인정보 처리와 관련한 자연인 보호를 이유로 연합 내 개인정…

### TERM-009 · special categories of personal data

- 검토 이유: 한국법 민감정보와 범위가 정확히 같다고 오해할 수 있음.
- 관찰된 표기: 특별 범주
- 확인 방향: GDPR 제9조 개념을 보존하면서 첫 등장 설명과 번역 명칭 검토.
- 위치 수: 16개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **특별한 유형의 개인정보**. 첫 등장에 원어와 설명 병기.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `cnil-electronic-invoicing-2026/details_ko`

> … 이름 대신 사건·업무 번호를 사용하는 등 개인정보를 최소화하도록 권고하고, 건강정보 등 특별 범주 정보는 엄격한 예외 요건과 직업상 비밀 보호를 고려해 처리하도록 안내  - 처리 목적을 정하는 발행 기업은 원칙적으로 처리책임자, 기업의 지시에 따라 처리하는 플랫폼은 수탁처리자에 해당한다고 설명하고, 이에 따른 계약·보안·비밀유지·활동 기록 관리를 요구. 다만 플랫폼이 정보…

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `article-8A-2-c-text-1/korean_text`

> (2) (c) 제9조 제1항(특별 범주의 개인정보 처리) 또는 제10조 제1항(유죄판결 등에 관한 개인정보 처리)에 규정된 처리인지 여부를 포함한 처리의 성격,

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `data_subject_rights--GB/major_exceptions`

> …을 식별하지 않을 조건도 있다. 기본 처리근거나 모든 권리를 포괄적으로 면제하지 않는다. 특별 범주를 전부·일부 이용한 중대한 자동화 결정에는 제22B조의 전체 정보처리에 대한 명시적 동의 또는 계약상 필요·법률상 허용/요구와 제9(2)(g)조 조건을 구별한다. 제6(1)(ea)조에 전부·일부 의존하는 처리는 제22B(4)조의 별도 금지 대상이다. 새 자동화 결정 체계는 2…

### TERM-010 · pseudonymisation / pseudonymised data

- 검토 이유: 한국·EU·중국의 관련 정의를 동일시하면 안 됨.
- 관찰된 표기: 가명처리 / 가명정보
- 확인 방향: 법률별 정의와 행위·결과물의 구별을 기록. 번역을 일률 통합하지 않음.
- 위치 수: 55개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **가명처리 / 가명정보**. 법률별 정의와 별도 법률 용어는 구분하여 유지.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-140/korean_text`

> …을 분석·예측하기 위하여 개인정보를 자동화하여 처리하는 모든 형태를 말한다.  (aa) ‘가명처리하다’ 또는 ‘가명처리’란 추가 정보를 사용하지 않고서는 더 이상 특정 소비자에게 귀속시킬 수 없도록 개인정보를 처리하는 것을 말한다. 다만, 그 추가 정보는 별도로 보관하고, 개인정보가 식별되었거나 식별 가능한 소비자에게 귀속되지 않도록 보장하는 기술적·조직적 조치의 적용을 받…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--KR/korean_summary`

> …개인정보에 속한다. 결합 가능성은 추가 정보의 입수 가능성과 시간·비용·기술을 고려한다. 가명정보도 개인정보이며, 처리에는 수집·저장·이용·제공·파기 등 다양한 행위가 포함된다.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-26-text-1/korean_text`

> …인정보 보호 원칙은 식별된 또는 식별 가능한 자연인에 관한 모든 정보에 적용되어야 한다. 가명처리를 거쳤으며 추가 정보를 사용하여 자연인에게 귀속시킬 수 있는 개인정보는 식별 가능한 자연인에 관한 정보로 보아야 한다. 자연인이 식별 가능한지를 판단하기 위해서는 개인정보처리자 또는 다른 사람이 그 자연인을 직접적 또는 간접적으로 식별하기 위하여 사용할 합리적인 가능성이 있는 …

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-26/korean_text`

> …인정보 보호 원칙은 식별된 또는 식별 가능한 자연인에 관한 모든 정보에 적용되어야 한다. 가명처리를 거쳤으며 추가 정보를 사용하여 자연인에게 귀속시킬 수 있는 개인정보는 식별 가능한 자연인에 관한 정보로 보아야 한다. 자연인이 식별 가능한지를 판단하기 위해서는 개인정보처리자 또는 다른 사람이 그 자연인을 직접적 또는 간접적으로 식별하기 위하여 사용할 합리적인 가능성이 있는 …

### TERM-011 · anonymisation / anonymous information

- 검토 이유: 처리 행위와 법 적용 제외 요건을 구별할 필요.
- 관찰된 표기: 익명화 / 익명정보 / 익명처리
- 확인 방향: 가명처리와 구별하고 법률별 식별가능성 요건에 따라 사용.
- 위치 수: 30개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **익명처리 / 익명정보**. 법률별 정의와 별도 법률 용어는 구분하여 유지.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `edpb-2026-07-08-4/title_ko`

> EU EDPB, 익명화·AI 웹 스크래핑 지침 의견수렴 및 블록체인 최종 지침 채택

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-26-text-1/korean_text`

> … 비용 및 시간과 같은 모든 객관적 요소를 고려하여야 한다. 따라서 개인정보 보호 원칙은 익명정보, 즉 식별된 또는 식별 가능한 자연인과 관련되지 않는 정보나 정보주체가 식별되지 않거나 더 이상 식별되지 않도록 익명화된 개인정보에는 적용되어서는 안 된다. 따라서 이 규정은 통계 또는 연구 목적의 처리를 포함하여 그러한 익명정보의 처리를 그 적용 대상으로 하지 않는다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `privacy_principles--KR/korean_summary`

> … 공개와 권리 보장, 사생활 침해 최소화 및 책임 이행이 원칙이다. 목적 달성이 가능하면 익명처리를 우선하고 그렇지 않으면 가명처리를 고려한다. 불필요한 정보는 파기하고 대표자는 보호에 필요한 관리·지원 책임을 진다.

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `sg-heading-after-48B/korean_text`

> # 제9B부 개인정보와 익명화 정보에 영향을 미치는 범죄

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a4/korean_text`

> … 그 밖의 방식으로 기록된, 식별되었거나 식별 가능한 자연인에 관한 각종 정보를 말하며, 익명화 처리된 정보는 포함하지 않는다.  개인정보의 처리에는 개인정보의 수집, 저장, 이용, 가공, 전송, 제공, 공개, 삭제 등이 포함된다.

### TERM-012 · deidentified information

- 검토 이유: CCPA 정의 용어와 일반적인 비식별화 표현 구별 필요.
- 관찰된 표기: 비식별 / 비식별화
- 확인 방향: CCPA 정의·요건을 먼저 확인한 뒤 국문 명칭 결정.
- 위치 수: 18개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **비식별화 / 비식별정보**.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-140/korean_text`

> …도 연결되지 않으며 합리적으로 연결할 수도 없는 정보를 말한다. ‘집계된 소비자 정보’는 비식별화된 하나 이상의 개별 소비자 기록을 뜻하지 않는다.  (c) ‘생체정보’란 개인의 신원을 확립하기 위하여 단독으로 또는 상호 결합하거나 다른 식별정보와 결합하여 사용되거나 사용하도록 예정된 개인의 생리적·생물학적·행동적 특성을 말하며, 개인의 디옥시리보핵산(DNA)에 관한 정보를…

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a51/korean_text`

> … 내부 관리제도 및 운영 절차의 제정 (2) 개인정보의 분류 관리 (3) 적절한 암호화, 비식별화 등 안전 기술조치의 채택 (4) 개인정보 처리에 관한 작업 권한의 합리적 설정 및 종사자에 대한 정기적인 안전 교육·훈련 (5) 개인정보 안전 사고 비상대응계획의 수립 및 시행 조직 (6) 법률 또는 행정법규가 정하는 그 밖의 조치

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--CN/major_exceptions`

> 익명화된 정보는 제4조 정의에서 제외된다. 제73조의 비식별화는 추가정보 없이 식별할 수 없게 하는 처리이고, 익명화는 식별 불가능하고 복원 불가능한 처리이므로 서로 구별한다. 네트워크 데이터 안전관리 조례 제62조의 네트워크 데이터는 네트워크를 통해 처리·생성되는 각종 전자 데이터이며 개인정보보다 넓은 범주이다. 이 정의로 PIPL의 비…

### TERM-013 · automated decision-making

- 검토 이유: 각 법률이 규율하는 대상 및 인적 개입 요건이 다름.
- 관찰된 표기: 자동화된 의사결정 / 자동화 결정
- 확인 방향: 동향의 일반 표현과 법제 번역의 정의·요건을 함께 검토.
- 위치 수: 23개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **자동화된 의사결정**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ico-foundation-agentic-ai-2026/details_ko`

> …인 확인 절차를 소개  - 이에 개발·배포 사업자와 전문가를 대상으로 보안·투명성·책임성·자동화된 의사결정·공정성·적법한 데이터 이용에 관한 근거를 요청하고, 제출 기한을 2026년 11월 20일로 안내  - 수집한 의견은 향후 지침과 AI·자동화된 의사결정 관련 법정 실무규범 개발에 활용할 계획이며, 소비자용 AI 서비스의 개인화에 대해서도 연구와 기업 협의를 진행할 방침

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `data_subject_rights--CN/korean_summary`

> …, 열람·복사, 정정·보충, 삭제, 처리규칙 설명과 조건부 이전 경로를 규정한다. 중대한 자동화 결정에는 설명 및 전적으로 자동화된 결정 거부권을 둔다.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-185/korean_text`

> …사업자에게 영업비밀을 밝히도록 요구하지 않는다.  (15) 프로파일링을 포함하는 사업자의 자동화된 의사결정 기술 이용에 관한 접근권 및 옵트아웃 권리를 규율하고, 접근 요청에 대한 사업자의 응답에 의사결정 과정의 논리에 관한 의미 있는 정보와 소비자에 관하여 그 과정이 초래할 가능성이 있는 결과에 대한 설명을 포함하도록 요구하는 규칙을 발행하는 것.  (16) 제1798.1…

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a24/korean_text`

> 개인정보처리자가 개인정보를 이용하여 자동화된 의사결정을 하는 경우에는 의사결정의 투명성과 결과의 공평성·공정성을 보장해야 하며, 거래가격 등 거래조건에서 개인에게 불합리한 차별적 대우를 해서는 안 된다.  자동화된 의사결정 방식으로 개인에게 정보를 전송하거나 상업적 마케팅을 하는 경우에는 개인의 특성을 대상으로 하지 않는…

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-71-title-1/korean_text`

> …한 효과를 가진 조치로 이어지는 처리를 방지하여야 한다. 특별한 범주의 개인정보에 근거한 자동화된 의사결정과 프로파일링은 특정 조건하에서만 허용되어야 한다.

### TERM-014 · profiling

- 검토 이유: 일반 분석 표현과 법률상 정의 용어를 구별할 필요.
- 관찰된 표기: 프로파일링
- 확인 방향: 국내 실무 표기와 원문 정의에 맞춰 통일 범위 결정.
- 위치 수: 42개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **프로파일링**. 사용자 후속 수정에 따라 원어 병기 없이 사용.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-140/korean_text`

> …또는 개인정보 집합에 대하여 수행하는 일체의 작업 또는 일련의 작업을 말한다.  (z) ‘프로파일링’이란 제1798.185조 (a)항 제15호에 따른 규칙에서 추가로 정의하는 바에 따라, 자연인과 관련된 일정한 개인적 측면을 평가하고 특히 그 자연인의 업무 성과, 경제적 상황, 건강, 개인적 선호, 관심, 신뢰성, 행동, 위치 또는 이동에 관한 측면을 분석·예측하기 위하여 …

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-24-text-1/korean_text`

> …한 결정을 내리거나 그 개인적 선호, 행동 및 태도를 분석하거나 예측하기 위하여 자연인을 프로파일링하는 개인정보 처리 기술이 이후에 사용될 가능성도 포함된다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-24/korean_text`

> …한 결정을 내리거나 그 개인적 선호, 행동 및 태도를 분석하거나 예측하기 위하여 자연인을 프로파일링하는 개인정보 처리 기술이 이후에 사용될 가능성도 포함된다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `privacy_principles--EU/korean_summary`

> …유 보호와 연합 내 개인정보의 자유로운 이동을 함께 목적으로 둔다. 정정된 고려사항71은 프로파일링의 적절한 수학·통계 절차, 부정확 요소 정정·오류위험 최소화, 위험을 고려한 개인정보 보호에 더하여, 인종·민족·정치·종교·노조·유전/건강·성적지향에 따른 차별효과 또는 그러한 효과를 가진 조치로 이어지는 처리를 방지하도록 설명한다.

### TERM-015 · lead supervisory authority

- 검토 이유: 수석이라는 직역 표현이 국내 GDPR 해설과 맞는지 검토 필요.
- 관찰된 표기: 수석감독기구
- 확인 방향: 국내 GDPR 자료의 선임·주도 등 용례와 정의를 대조.
- 위치 수: 1개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **선임 감독기관(lead supervisory authority)**. 첫 등장에 원어 병기 및 역할 설명.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `edpb-2026-07-17-2/details_ko`

> …응과 필요한 입법 조치를 논의  - 국경 간 집행 협력을 강화하기 위해 민원 접수 기관이 수석감독기구에 자원을 제공하는 방안, 공동 작업 확대 및 집행 절차·국가별 관행에 관한 워크숍을 논의

### TERM-016 · reprimand

- 검토 이유: 국내 인사상 징계와 혼동되며 warning과도 구별 필요.
- 관찰된 표기: 견책
- 확인 방향: 감독기구의 시정권한 중 reprimand와 warning을 따로 확인.
- 위치 수: 8개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **견책(reprimand)**. 첫 등장에 원어 병기.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `dpc-chi-tallaght-2026/summary_ko`

> …의 특정 시설에서 종이 아동 건강기록과 기밀 폐기물 관리에 관한 GDPR 위반을 확인하고 견책 및 시정명령 부과

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-148-text-1/korean_text`

> …부과될 가능성이 있는 금전제재가 자연인에게 불균형한 부담을 구성할 경우에는 금전제재 대신 견책을 할 수 있다. 그러나 위반의 성격, 중대성 및 지속기간, 위반의 고의성, 입은 손해를 완화하기 위하여 취한 조치, 책임의 정도나 모든 관련 선행 위반, 감독기관이 위반을 알게 된 방식, 개인정보처리자 또는 수탁처리자에게 명령된 조치의 준수, 행동규약의 준수 및 그 밖의 모든 가중…

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-148/korean_text`

> …부과될 가능성이 있는 금전제재가 자연인에게 불균형한 부담을 구성할 경우에는 금전제재 대신 견책을 할 수 있다. 그러나 위반의 성격, 중대성 및 지속기간, 위반의 고의성, 입은 손해를 완화하기 위하여 취한 조치, 책임의 정도나 모든 관련 선행 위반, 감독기관이 위반을 알게 된 방식, 개인정보처리자 또는 수탁처리자에게 명령된 조치의 준수, 행동규약의 준수 및 그 밖의 모든 가중…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `administrative_fines--EU/major_exceptions`

> …일이며 후속 개정은 지체 없이 통지한다. 고려사항 148의 경미위반/자연인 불균형부담 시 견책, 149의 ne bis in idem, 151의 덴마크·에스토니아 방식은 조문과 함께 검토할 설명이다. 고려사항150은 금전제재 대상 undertaking을 TFEU 제101·102조의 기업으로 이해하도록 설명한다. 구체적 대상과 매출 산정단위는 회원국 실무·판례의 추가 확인이 필…

### TERM-017 · remedy / redress

- 검토 이유: 권리구제 일반과 손해배상의 범위 차이를 보존할 필요.
- 관찰된 표기: 배상 / 구제
- 확인 방향: 개별 원문을 확인해 구제수단·소송·배상을 구분.
- 위치 수: 89개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **구제 / 구제수단**. 배상은 문맥에 따라 구분하고 judicial remedy는 사법적 구제로 표현.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `curia-c526-24/title_ko`

> EU 사법재판소, 손해배상 청구만을 목적으로 한 열람 요구의 남용 판단 기준 제시

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-150/korean_text`

> …A) 소비자 1인·사건 1건당 100달러($100)* 이상 750달러($750)* 이하의 배상액 또는 실제 손해액 중 더 큰 금액의 배상을 받는 것. 이 항의 금액은 제1798.199.95조 (d)항에 따라 조정한다.  (B) 금지명령 또는 확인적 구제.  (C) 법원이 적절하다고 판단하는 그 밖의 구제.  (2) 법원은 법정손해배상액을 산정할 때 사건 당사자가 제시하는 관…

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `law-table1-t1-r9-col1/korean_text`

> 원자력손해배상·폐로등지원기구

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `main-a2/korean_text`

> …기관이 성문법상 권한을 행사하여 부과한 그 밖의 요건의 위반. 또는  (c) 법률에 따라 구제받을 수 있게 하는 상황 또는 행위.  ‘국익’에는 국방, 국가안전, 공공안전, 필수서비스 유지 및 국제관계 업무의 수행이 포함된다.  ‘조직’에는 개인, 회사, 협회 또는 법인격 유무와 관계없는 사람들의 단체가 포함되며, 다음 여부와 관계없다.  (a) 싱가포르법에 따라 설립되거나…

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a69/korean_text`

> …해하여 손해를 발생시킨 경우, 개인정보처리자가 자신에게 과실이 없음을 증명하지 못하면 손해배상 등 불법행위책임을 져야 한다.  앞 항의 손해배상책임은 개인이 그로 인해 입은 손실 또는 개인정보처리자가 그로 인해 얻은 이익에 따라 정한다. 개인이 입은 손실과 개인정보처리자가 얻은 이익을 확정하기 어려운 경우에는 실제 상황에 따라 배상액을 정한다.

### TERM-018 · binding decision

- 검토 이유: 법적 효력 표현이 자료마다 흔들릴 수 있음.
- 관찰된 표기: 구속력 있는 결정
- 확인 방향: 동일 기관·동일 유형 결정의 명칭 일관성 확인.
- 위치 수: 17개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **구속력 있는 결정**. 원어 병기 없이 사용.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `curia-c97-23p/summary_ko`

> … 사법재판소(CJEU), WhatsApp Ireland가 유럽데이터보호이사회(EDPB)의 구속력 있는 결정을 다투는 취소소송의 적법성을 인정하고 일반재판소에 사건 환송

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-125-text-1/korean_text`

> 선도 기관은 이 규정에 따라 자신에게 부여된 권한을 적용하는 조치에 관하여 구속력 있는 결정을 채택할 관할을 가져야 한다. 선도 기관으로서 감독기관은 의사결정 과정에 관련 감독기관들을 긴밀하게 참여시키고 조정하여야 한다. 결정이 정보주체의 민원을 전부 또는 일부 거부하는 것인 경우, 그 결정은 민원이 제기된 감독기관이 채택하여야 한다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-125/korean_text`

> 선도 기관은 이 규정에 따라 자신에게 부여된 권한을 적용하는 조치에 관하여 구속력 있는 결정을 채택할 관할을 가져야 한다. 선도 기관으로서 감독기관은 의사결정 과정에 관련 감독기관들을 긴밀하게 참여시키고 조정하여야 한다. 결정이 정보주체의 민원을 전부 또는 일부 거부하는 것인 경우, 그 결정은 민원이 제기된 감독기관이 채택하여야 한다.

### TERM-019 · adequacy decision

- 검토 이유: EU·영국과 한국의 별도 제도 명칭을 혼동할 위험.
- 관찰된 표기: 적정성 결정
- 확인 방향: 제도·국가별 원어와 법적 근거를 구분하여 관리.
- 위치 수: 18개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **적정성 결정**. 원어 병기 없이 사용.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-104-text-1/korean_text`

> …함한 그 일반법과 분야별 법을 고려하여야 한다. 제3국 내의 영역 또는 특정 분야에 관한 적정성 결정을 채택할 때에는 특정 처리 활동, 적용되는 법적 기준 및 해당 제3국에서 시행 중인 법령의 범위와 같은 명확하고 객관적인 기준을 고려하여야 한다. 제3국은 특히 하나 또는 여러 특정 분야에서 개인정보가 처리되는 경우, 연합 내에서 보장되는 보호와 본질적으로 동등한 적정한 보…

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-104/korean_text`

> …함한 그 일반법과 분야별 법을 고려하여야 한다. 제3국 내의 영역 또는 특정 분야에 관한 적정성 결정을 채택할 때에는 특정 처리 활동, 적용되는 법적 기준 및 해당 제3국에서 시행 중인 법령의 범위와 같은 명확하고 객관적인 기준을 고려하여야 한다. 제3국은 특히 하나 또는 여러 특정 분야에서 개인정보가 처리되는 경우, 연합 내에서 보장되는 보호와 본질적으로 동등한 적정한 보…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `cross_border_transfer--EU/korean_summary`

> … GDPR 전체 및 이 장의 조건 준수·보호 수준 유지를 요구한다. 제45조 집행위원회의 적정성 결정 경로는 별도 이전 허가가 필요 없고 적어도 4년마다 검토한다. 결정이 없으면 제46조의 적절한 보호조치와 집행 가능한 권리·효과적인 구제수단이 필요하다. 별도 허가 없는 경로는 공공기관 간 구속적 수단, 승인된 기업규칙, 집행위 채택 또는 집행위 승인 표준 조항, 구속적 약…

### TERM-020 · legitimate interests

- 검토 이유: 친숙한 한국어라도 법률별 적용·형량 요건이 다름.
- 관찰된 표기: 정당한 이익
- 확인 방향: 표현 변경보다 법률별 적용범위 주석과 정의 연결 우선.
- 위치 수: 63개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **정당한 이익**. 원어 병기 없이 사용.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a21-p4-i2/korean_text`

> 이용목적을 본인에게 통지하거나 공표함으로써 해당 개인정보취급사업자의 권리 또는 정당한 이익을 해칠 우려가 있는 경우.

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `appendix-1/korean_text`

> … (m) 국제 유료 라디오 서비스.  (n) 특정 관심사 라디오 서비스.  ### 제3부 정당한 이익  1.—(1) (2), (3) 및 (4)를 전제로 다음 모두에 해당하는 경우.  (a) 개인에 관한 개인정보의 수집·이용·공개가 조직이나 다른 사람의 정당한 이익에 부합할 것. 그리고  (b) 그 정당한 이익이 개인에 대한 불리한 영향보다 우월할 것.  (2) (1)의 목적…

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a49/korean_text`

> 자연인이 사망한 경우, 그 가까운 친족은 자신의 적법하고 정당한 이익을 위하여 사망자의 관련 개인정보에 대해 이 장에서 정한 열람, 복사, 정정, 삭제 등의 권리를 행사할 수 있다. 다만, 사망자가 생전에 달리 정한 경우는 제외한다.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-47-text-1/korean_text`

> 개인정보가 제공될 수 있는 개인정보처리자의 이익을 포함한 개인정보처리자의 정당한 이익 또는 제3자의 정당한 이익은, 정보주체와 개인정보처리자의 관계에 근거한 정보주체의 합리적인 기대를 고려하여 정보주체의 이익이나 기본권과 자유가 우선하지 않는다는 조건으로, 처리의 법적 근거가 될 수 있다. 예를 들어 정보주체가 개인정보처리자의 고객이거나 그를 위하여 근무하는…

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-47/korean_text`

> 개인정보가 제공될 수 있는 개인정보처리자의 이익을 포함한 개인정보처리자의 정당한 이익 또는 제3자의 정당한 이익은, 정보주체와 개인정보처리자의 관계에 근거한 정보주체의 합리적인 기대를 고려하여 정보주체의 이익이나 기본권과 자유가 우선하지 않는다는 조건으로, 처리의 법적 근거가 될 수 있다. 예를 들어 정보주체가 개인정보처리자의 고객이거나 그를 위하여 근무하는…

### TERM-021 · accountability

- 검토 이유: 국내 개인정보 정책 용례와 프로젝트의 사용 기준 검토.
- 관찰된 표기: 책임성
- 확인 방향: 개인정보위 자료의 문맥과 EU 원칙 설명을 비교.
- 위치 수: 10개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **책임성**. 원어 병기 없이 사용.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `dpc-google-location-2026/details_ko`

> …e의 세 위치정보 기능에서 이뤄지는 개인정보 처리를 조사한 결과, 처리의 적법성·공정성, 책임성, 투명성 및 보유기간에 관한 GDPR 위반을 확인했다고 설명  - 위반 사항에 대해 총 4억300만 유로의 과징금을 부과하는 한편, 6개월 내 개인정보 처리 방식을 개선하도록 명령

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-85-text-1/korean_text`

> …도 72시간 이내에 감독기관에 그 개인정보 침해를 통지하여야 한다. 다만 개인정보처리자가 책임성 원칙에 따라 그 개인정보 침해가 자연인의 권리와 자유에 위험을 초래할 가능성이 낮다는 것을 입증할 수 있는 경우는 예외로 한다. 72시간 이내에 그러한 통지를 할 수 없는 경우에는 통지에 지연 사유를 함께 제시하여야 하며, 부당한 추가 지체 없이 단계적으로 정보를 제공할 수 있다…

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-85/korean_text`

> …도 72시간 이내에 감독기관에 그 개인정보 침해를 통지하여야 한다. 다만 개인정보처리자가 책임성 원칙에 따라 그 개인정보 침해가 자연인의 권리와 자유에 위험을 초래할 가능성이 낮다는 것을 입증할 수 있는 경우는 예외로 한다. 72시간 이내에 그러한 통지를 할 수 없는 경우에는 통지에 지연 사유를 함께 제시하여야 하며, 부당한 추가 지체 없이 단계적으로 정보를 제공할 수 있다…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `privacy_principles--SG/korean_summary`

> 책임성과 보호책임자 지정·연락처 공개, 내부 정책·불만 처리·직원 안내, 합리적인 목적 제한·고지, 정확성·안전조치·보유 제한을 규정한다. 일반 규칙 제1A조는 PDPC 웹사이트의 조직 관련 기록이나 조직 공식 웹사이트의 쉽게 접근할 수 있는 부분에 지정 보호책임자의 업무용 연락처를 공…

### TERM-022 · data protection by design and by default

- 검토 이유: 기술·법률 복합 개념으로 직역 표현과 관용 표현 확인 필요.
- 관찰된 표기: 기본설정 / 설계에 의한 / 설계 및 기본
- 확인 방향: privacy by design과 GDPR 조문 제목을 구별하여 표기안 검토.
- 위치 수: 16개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **설계 및 기본 설정에 의한 개인정보 보호**.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-185/korean_text`

> … 것.  (iii) 소비자의 의도를 명확하게 나타내며 그 의도를 제한하거나 미리 가정하는 기본설정을 두지 않을 것.  (iv) 신호가 소비자가 사용할 수 있는 다른 일반적인 개인정보 설정 또는 도구와 충돌하지 않도록 보장할 것.  (v) 다른 사업자에 관한 소비자의 선호에 영향을 주거나 옵트아웃 선호 신호를 전역적으로 비활성화하지 않고도, 어느 사업자의 개인정보 판매 또는 …

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-78-text-1/korean_text`

> …가 있다. 이 규정의 준수를 입증할 수 있도록 개인정보처리자는 내부 정책을 채택하고 특히 설계에 의한 정보보호와 기본설정에 의한 정보보호 원칙을 충족하는 조치를 이행하여야 한다. 그러한 조치는 특히 개인정보 처리의 최소화, 가능한 한 조속한 개인정보의 가명처리, 기능 및 개인정보 처리에 관한 투명성, 정보주체가 정보 처리를 모니터링할 수 있도록 하는 것, 개인정보처리자가 보…

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-78/korean_text`

> …가 있다. 이 규정의 준수를 입증할 수 있도록 개인정보처리자는 내부 정책을 채택하고 특히 설계에 의한 정보보호와 기본설정에 의한 정보보호 원칙을 충족하는 조치를 이행하여야 한다. 그러한 조치는 특히 개인정보 처리의 최소화, 가능한 한 조속한 개인정보의 가명처리, 기능 및 개인정보 처리에 관한 투명성, 정보주체가 정보 처리를 모니터링할 수 있도록 하는 것, 개인정보처리자가 보…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `privacy_principles--EU/korean_summary`

> …하는 경우 제7조의 동의요건, 제12~14조의 투명 정보제공, 제24·25조의 책임·설계/기본설정 보호, 제32조의 위험에 적합한 보안과 제35조의 높은 위험 사전 영향평가는 원칙을 구체화한다. 제1조는 자연인의 기본권·자유 보호와 연합 내 개인정보의 자유로운 이동을 함께 목적으로 둔다. 정정된 고려사항71은 프로파일링의 적절한 수학·통계 절차, 부정확 요소 정정·오류위험 …

### TERM-023 · micro, small and medium-sized enterprises

- 검토 이유: 저장소에 이미 별도 용어 변경 이력이 있으므로 재확정 주의.
- 관찰된 표기: 초소형기업 / 영세·중소기업
- 확인 방향: 기존 terminology-change-manifest와 원문·국내 용례를 함께 검토. 한국 기업규모 정의와 동일시 금지.
- 위치 수: 14개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **영세·중소기업**. 첫 등장에 원어 병기.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-13-text-1/korean_text`

> …수준을 보장하고 역내시장에서 개인정보의 자유로운 이동을 저해하는 차이를 방지하기 위하여, 초소형기업·소기업·중기업을 포함한 경제활동 주체에게 법적 확실성과 투명성을 제공하고, 모든 회원국의 자연인에게 법적으로 집행 가능한 동일한 수준의 권리를, 개인정보처리자와 수탁처리자에게 동일한 수준의 의무와 책임을 제공하며, 개인정보 처리에 대한 일관된 감시, 모든 회원국에서의 동등한 …

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `article-40-1-text-1/korean_text`

> (1) 위원회는 다양한 처리 부문의 특성과 영세·중소기업의 구체적인 필요를 고려하여 이 규정의 올바른 적용에 기여하기 위한 행동규약의 작성을 장려해야 한다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-13/korean_text`

> …수준을 보장하고 역내시장에서 개인정보의 자유로운 이동을 저해하는 차이를 방지하기 위하여, 초소형기업·소기업·중기업을 포함한 경제활동 주체에게 법적 확실성과 투명성을 제공하고, 모든 회원국의 자연인에게 법적으로 집행 가능한 동일한 수준의 권리를, 개인정보처리자와 수탁처리자에게 동일한 수준의 의무와 책임을 제공하며, 개인정보 처리에 대한 일관된 감시, 모든 회원국에서의 동등한 …

### TERM-024 · information notice

- 검토 이유: 일반적인 알림과 영국 감독기관의 법정 권한을 구별할 필요.
- 관찰된 표기: 정보요구 통지
- 확인 방향: 원문 법정 명칭을 병기하고 설명형 번역과 조문 명칭을 검토.
- 위치 수: 3개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **정보제출 요구 통지(information notice)**. 첫 등장에 원어 병기.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ico-tiktok-appeals-2026/title_ko`

> 영국 ICO, TikTok의 아동 개인정보 과징금·정보요구 통지 불복 철회 발표

### TERM-025 · confidential waste

- 검토 이유: 국내 기록물 폐기 실무에서 자연스럽게 이해되는 표현인지 검토.
- 관찰된 표기: 기밀 폐기물
- 확인 방향: 원문에서 폐기 대상 문서·기록물인지 확인한 뒤 설명형 표현 검토.
- 위치 수: 2개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **폐기 대상 기밀문서**. 문서·기록물 문맥에 적용.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `dpc-chi-tallaght-2026/summary_ko`

> 아일랜드 개인정보 감독기관(DPC), CHI의 특정 시설에서 종이 아동 건강기록과 기밀 폐기물 관리에 관한 GDPR 위반을 확인하고 견책 및 시정명령 부과

### TERM-026 · compatibility of purposes

- 검토 이유: 법적 의미를 보존하면서 국내 개인정보 문헌 용례 확인 필요.
- 관찰된 표기: 양립성
- 확인 방향: 목적 간 양립가능성 등 기존 GDPR 해설과 비교.
- 위치 수: 4개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **목적 간 양립가능성**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `cnil-electronic-invoicing-2026/details_ko`

> … 10년 보유기간이 전자 송장에도 적용되며, 수탁자의 자체 재이용에는 최초 처리 목적과의 양립성 및 처리책임자의 서면 허가가 필요하다고 안내  - 이용자 신원 확인과 개인별 계정·권한 통제를 강조하고, ISO 27001 등 인증을 취득했더라도 실제 처리 상황에 필요한 추가 보안조치를 평가하도록 안내

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `pseudonymous_anonymous_information--EU/korean_summary`

> …험에 적합한 보안의 예시에 가명처리를 포함한다. 제6조 제4항은 다른 목적의 추가 처리의 양립성 평가에서 암호화·가명처리 등 보호조치를 고려한다. 제11조는 처리 목적상 식별이 불필요한 경우 규정 준수만을 위한 추가 정보 유지·취득·처리 의무를 부과하지 않는다. 제89조는 공익 기록보존·연구·통계의 보호조치와 식별 최소화를 정한다. 고려사항 26은 추가 정보로 귀속 가능한 …

### TERM-027 · data intermediary

- 검토 이유: 싱가포르 PDPA의 법정 역할이 일반 플랫폼 중개와 혼동될 수 있음.
- 관찰된 표기: 처리수탁자 / 데이터 중개자
- 확인 방향: PDPA 정의 용어임을 유지하고 수탁처리자와의 대응 관계는 별도 설명.
- 위치 수: 7개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **데이터 중개자**. 싱가포르 PDPA의 data intermediary는 데이터 중개자로 표기. 일반적인 데이터 거래 중개업자와 혼동되지 않도록 첫 등장에 법률상 정의를 설명.

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `main-a2/korean_text`

> … 평가하도록 그 조직에 제공하는 서면, 구두 또는 그 밖의 형태의 의사전달을 말한다.  ‘처리수탁자’란 다른 조직을 대신하여 개인정보를 처리하는 조직을 말하되, 그 다른 조직의 직원은 포함하지 않는다.  ‘파생 개인정보’는 다음과 같다.  (a) 조직이 보유하거나 통제하는 해당 개인 또는 다른 개인에 관한 다른 개인정보로부터 사업 과정에서 도출한 개인에 관한 개인정보를 말한…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `law_application_scope--SG/korean_summary`

> …는 개인·가사 목적 개인, 직무 수행 직원, 공공기관 등 일반 보호 의무의 예외를 정하고 데이터 중개자와 위탁 조직의 책임을 구별한다.

### TERM-028 · deemed consent

- 검토 이유: 싱가포르 법정 동의 유형과 추정·묵시 동의의 차이 보존 필요.
- 관찰된 표기: 동의한 것으로 / 동의 간주
- 확인 방향: 조문별 유형·성립 조건을 원문과 대조하여 명칭 결정.
- 위치 수: 7개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **동의 간주 / 동의한 것으로 본다**.

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `main-a13/korean_text`

> …해서는 안 된다.  (a) 개인이 해당 수집·이용·공개에 관하여 이 법에 따라 동의하거나 동의한 것으로 간주되는 경우. 또는  (b) 동의 없는 해당 수집·이용·공개가 이 법이나 다른 성문법에 따라 요구되거나 허용되는 경우.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `third_party_provision--JP/korean_summary`

> …때 동의 등의 확인을 요구한다. 공공 제공과 국외제공은 각각의 제한·예외로 구분하며 기존 동의 간주 부칙도 확인한다.

### TERM-029 · sale / sharing (CCPA)

- 검토 이유: 일반 판매·공유와 다른 법정 정의가 있어 문맥 없는 치환 위험.
- 관찰된 표기: 판매 / 공유
- 확인 방향: CCPA의 두 정의를 별도 항목으로 나눠 원어와 정의 범위를 연결.
- 위치 수: 21개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **판매 / 공유**. 원어 병기 없이 각각의 정의 설명.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-100/korean_text`

> … 수집할 개인정보의 범주, 그 범주의 개인정보를 수집하거나 이용하는 목적 및 해당 정보를 판매하거나 공유하는지 여부. 사업자는 이 조에 부합하는 통지를 소비자에게 제공하지 않고서는 추가 범주의 개인정보를 수집하거나, 수집한 개인정보를 그 수집 시 공개한 목적과 양립하지 않는 추가 목적에 이용해서는 안 된다.  (2) 사업자가 민감 개인정보를 수집하는 경우, 수집할 민감 개인…

### TERM-030 · business / service provider / contractor

- 검토 이유: CCPA에서 서로 다른 역할·정의에 해당.
- 관찰된 표기: 사업자 / 서비스 제공자 / 계약수행자 / 계약자
- 확인 방향: 역할별 원어 및 국문 번역을 따로 정리.
- 위치 수: 29개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **사업자 / 서비스 제공자 / 계약자(contractor)**. contractor는 첫 등장에 원어 병기.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-100/korean_text`

> (a) 소비자의 개인정보 수집을 통제하는 사업자는 수집 시점 또는 그 전에 소비자에게 다음을 알려야 한다.  (1) 수집할 개인정보의 범주, 그 범주의 개인정보를 수집하거나 이용하는 목적 및 해당 정보를 판매하거나 공유하는지 여부. 사업자는 이 조에 부합하는 통지를 소비자에게 제공하지 않고서는 추가 범주의 개인정보를 수집하거나…

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-125/korean_text`

> (a)(1) 사업자는 소비자가 이 편에 따른 권리를 행사하였다는 이유로 소비자를 차별해서는 안 되며, 다음과 같은 행위를 포함하되 이에 한정되지 않는다.  (A) 소비자에 대한 상품 또는 서비스의 제공을 거부하는 것.  (B) 할인이나 그 밖의 혜택의 이용 또는 불이익의 부과 등을 통하여 상품 또는…

### TERM-031 · 个人信息处理者

- 검토 이유: PIPL의 목적·방식 결정자를 GDPR processor로 오독할 위험.
- 관찰된 표기: 개인정보처리자
- 확인 방향: 현행 번역 유지 가능성을 포함해 controller와 대응 차이 명시.
- 위치 수: 39개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **개인정보처리자**. 원어 병기 없이 중국법의 정의 설명.

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a9/korean_text`

> 개인정보처리자는 자신의 개인정보 처리 활동에 책임을 지며, 처리하는 개인정보의 안전을 보장하기 위해 필요한 조치를 취해야 한다.

### TERM-032 · 单独同意

- 검토 이유: 동의 방식과 법정 요건에 관련된 중국법 용어.
- 관찰된 표기: 별도 동의
- 확인 방향: 단독·별도·개별 중 국내 PIPL 자료와 원문 용례 비교.
- 위치 수: 6개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **별도 동의**. 원어 병기 없이 사용.

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a14/korean_text`

> … 자발적이고 명확하게 표시한 것이어야 한다. 법률 또는 행정법규가 개인정보 처리에 개인의 별도 동의 또는 서면 동의를 받도록 정하는 경우에는 그 규정에 따른다.  개인정보 처리의 목적, 처리 방식 또는 처리하는 개인정보의 종류가 변경되는 경우에는 개인의 동의를 다시 받아야 한다.

### TERM-033 · 重要数据

- 검토 이유: 중국의 별도 법체계 개념을 민감 개인정보와 동일시할 위험.
- 관찰된 표기: 중요데이터
- 확인 방향: 근거 법률과 원어 확인 후 띄어쓰기·설명 기준 결정.
- 위치 수: 3개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **중요 데이터**. 띄어 쓰고 원어 병기 없이 사용.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `third_party_provision--CN/korean_summary`

> …이다. 네트워크 데이터 안전관리 조례 제12조는 다른 네트워크 데이터 처리자에게 개인정보·중요데이터를 제공하는 경우에도 계약 등의 목적·방식·범위·보호 의무 약정과 이행 감독을 요구한다.

### TERM-034 · 要配慮個人情報

- 검토 이유: 일본법의 정의 범주를 한국 민감정보로 곧바로 바꾸면 안 됨.
- 관찰된 표기: 배려가 필요한 개인정보
- 확인 방향: 국내 일본법 해설의 명칭을 비교하고 정의 차이를 유지.
- 위치 수: 11개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **요배려 개인정보(배려가 필요한 정보)**. 첫 등장에 괄호 설명 병기.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a2-p3/korean_text`

> 이 법률에서 “배려가 필요한 개인정보”란 본인의 인종, 신조, 사회적 신분, 병력, 범죄 경력, 범죄로 피해를 입은 사실, 그 밖에 본인에 대한 부당한 차별, 편견 또는 그 밖의 불이익이 발생하지 않도록 그 취급에 특별한 배려가 필요한 것으로 정령으로 정하는 기술 등이 포함된 개인정보를 말한다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--JP/korean_summary`

> …및 공공부문의 보유개인정보·개인정보파일을 구별한다. 가명가공정보·익명가공정보·개인관련정보·배려가 필요한 개인정보는 별도 정의된다.

### TERM-035 · 保有個人データ / 保有個人情報

- 검토 이유: 일본 민간·공공 부문에서 별도 정의가 있어 구별 유지 필요.
- 관찰된 표기: 보유개인데이터 / 보유개인정보
- 확인 방향: 붙여쓰기와 개념 대응을 함께 점검. 표현을 하나로 합치지 않음.
- 위치 수: 121개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **보유 개인데이터 / 보유 개인정보**.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a16-p4/korean_text`

> 이 장에서 “보유개인데이터”란 개인정보취급사업자가 공개, 내용의 정정, 추가 또는 삭제, 이용의 정지, 소거 및 제3자에 대한 제공의 정지를 할 수 있는 권한을 가진 개인데이터로서, 그 존재 여부가 밝혀짐으로써 공익 또는 그 밖의 이익이 침해되는 것으로 정령으로 정하는 것 외의 것을 말한다.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a60-p1/korean_text`

> 이 장 및 제8장에서 “보유개인정보”란 행정기관 등의 직원(독립행정법인 등 및 지방독립행정법인의 경우에는 그 임원을 포함한다. 이하 이 장 및 제8장에서 같다)이 직무상 작성하거나 취득한 개인정보로서 해당 행정기관 등의 직원이 조직적으로 이용하는 것으로 해당 행정기관 등이 보유하고 있는 것을 말한다. 다만, …

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--JP/korean_summary`

> …게 대조하여 식별되는 경우 포함) 또는 개인식별부호가 포함된 것이다. 개인정보·개인데이터·보유개인데이터 및 공공부문의 보유개인정보·개인정보파일을 구별한다. 가명가공정보·익명가공정보·개인관련정보·배려가 필요한 개인정보는 별도 정의된다.

### TERM-036 · 仮名加工情報 / 匿名加工情報

- 검토 이유: 일본법 정의를 한국의 가명정보·익명정보와 구별할 필요.
- 관찰된 표기: 가명가공정보 / 익명가공정보
- 확인 방향: 가공을 포함한 번역과 첫 등장 정의 설명을 검토.
- 위치 수: 114개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **가명가공정보 / 익명가공정보**. 원어 병기 없이 사용.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a2-p5/korean_text`

> 이 법률에서 “가명가공정보”란 다음 각 호에 열거된 개인정보의 구분에 따라 해당 각 호에서 정하는 조치를 취하여, 다른 정보와 대조하지 않는 한 특정 개인을 식별할 수 없도록 개인정보를 가공하여 얻는 개인에 관한 정보를 말한다.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a2-p6/korean_text`

> 이 법률에서 “익명가공정보”란 다음 각 호에 열거된 개인정보의 구분에 따라 해당 각 호에서 정하는 조치를 취하여 특정 개인을 식별할 수 없도록 개인정보를 가공하여 얻는 개인에 관한 정보로서 해당 개인정보를 복원할 수 없도록 한 것을 말한다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--JP/korean_summary`

> …. 개인정보·개인데이터·보유개인데이터 및 공공부문의 보유개인정보·개인정보파일을 구별한다. 가명가공정보·익명가공정보·개인관련정보·배려가 필요한 개인정보는 별도 정의된다.

### TERM-037 · 個人関連情報

- 검토 이유: 일본법상 특정 정의 범주이며 일반적인 개인정보 관련 정보와 다름.
- 관찰된 표기: 개인관련정보
- 확인 방향: 정의 용어임을 알 수 있는 설명과 국내 용례 확인.
- 위치 수: 31개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **개인관련정보**. 원어 병기 없이 사용.

출처: [data/legal/translations/appi.json](../../data/legal/translations/appi.json) · `main-a2-p7/korean_text`

> 이 법률에서 “개인관련정보”란 살아 있는 개인에 관한 정보로서 개인정보, 가명가공정보 및 익명가공정보 중 어느 것에도 해당하지 않는 것을 말한다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--JP/korean_summary`

> …유개인데이터 및 공공부문의 보유개인정보·개인정보파일을 구별한다. 가명가공정보·익명가공정보·개인관련정보·배려가 필요한 개인정보는 별도 정의된다.

### TERM-038 · recipient

- 검토 이유: 동일 원어의 번역이 다를 수 있고 통신 수신 의미와 혼동 가능.
- 관찰된 표기: 수신자 / 수령자
- 확인 방향: 원문 역할이 같은 경우의 국문 통일 여부를 판단.
- 위치 수: 75개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **수신자**.

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-140/korean_text`

> … 제공된 정보라고 사업자가 믿을 합리적인 근거가 있는 정보.  (III) 소비자가 특정한 수신자에게만 정보를 제한하지 않은 경우, 그 소비자가 정보를 제공한 상대방이 제공하는 정보.  (ii) ‘공개적으로 이용 가능한’에는 소비자가 알지 못하는 가운데 사업자가 해당 소비자에 관하여 수집한 생체정보는 포함되지 않는다.  (3) ‘개인정보’에는 비식별화된 소비자 정보 또는 집계…

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-145/korean_text`

> …행자가 위반할 의도가 있음을 실제로 알지 못하고 그렇게 믿을 이유도 없는 것을 조건으로, 수령자가 이 편의 제한에 위반하여 개인정보를 이용하더라도 이 편에 따른 책임을 지지 않는다. 마찬가지로 서비스 제공자 또는 계약수행자는 자신이 서비스를 제공하는 사업자가 이 편에 따라 부담하는 의무에 대하여 이 편에 따른 책임을 지지 않는다. 다만, 서비스 제공자 또는 계약수행자 자신의…

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `main-a36/korean_text`

> … (a) 녹음되거나 합성된 음성을 이용하는 통화. 또는  (b) 청각장애 등 장애가 있는 수신자의 경우 음성통화와 동등한 통화.  (2) 이 부의 목적상 특정 메시지의 발송을 가능하게 하는 서비스만 제공하는 전기통신서비스 제공자는 반대가 입증되지 않으면 그 메시지를 발송하지 않았고 발송을 허가하지 않은 것으로 추정한다.  (3) 이 부의 목적상 특정 메시지가 발송되었을 때 …

출처: [data/legal/translations/pipl.json](../../data/legal/translations/pipl.json) · `main-a22/korean_text`

> …정보처리자가 합병, 분할, 해산, 파산선고 등의 이유로 개인정보를 이전해야 하는 경우에는 수령자의 명칭 또는 성명과 연락처를 개인에게 알려야 한다. 수령자는 개인정보처리자의 의무를 계속 이행해야 한다. 수령자가 당초의 처리 목적이나 처리 방식을 변경하는 경우에는 이 법의 규정에 따라 개인의 동의를 다시 받아야 한다.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-31-text-1/korean_text`

> …국법에 따라 일반 이익을 위한 특정한 조사를 수행하는 데 필요한 개인정보를 받는 경우에는 수령자로 간주되어서는 안 된다. 공공기관이 발송하는 정보 제공 요청은 항상 서면으로 이루어지고 이유가 제시되며 비정기적이어야 하고, 파일링 시스템 전체를 대상으로 하거나 파일링 시스템의 상호 연결로 이어져서는 안 된다. 그러한 공공기관의 개인정보 처리는 처리 목적에 따라 적용되는 개인정…

### TERM-039 · restriction of processing

- 검토 이유: 정지·금지·삭제와 다른 법률상 조치를 구별할 필요.
- 관찰된 표기: 처리 제한 / 처리제한
- 확인 방향: 권리 명칭과 감독기관 권한 문맥을 구별한 표기 검토.
- 위치 수: 38개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **처리 제한 / 처리 제한권**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `edpb-2026-09-21-1/details_ko`

> … 개별 사건의 사정에 따라 일반적인 접근을 조정할 수 있는지도 검토  - 경고·견책·명령·처리 제한 또는 금지·인증 철회 등 시정권한과의 관계를 설명하고, 어떤 수단을 선택할지 판단하는 실무 예시 14개를 제시  - 별도로 채택한 DSA–GDPR 최종 지침은 공개 의견수렴을 마친 자료로, 중개서비스 제공자의 개인정보 처리 등 두 법률이 함께 적용되는 영역에서 일관된 해석과 …

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-67-text-1/korean_text`

> …정보가 추가 처리 작업의 대상이 되지 않고 변경될 수 없도록 하는 방식의 기술적 수단으로 처리제한을 보장하여야 한다. 개인정보 처리가 제한된다는 사실은 시스템에 명확하게 표시되어야 한다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-67/korean_text`

> …정보가 추가 처리 작업의 대상이 되지 않고 변경될 수 없도록 하는 방식의 기술적 수단으로 처리제한을 보장하여야 한다. 개인정보 처리가 제한된다는 사실은 시스템에 명확하게 표시되어야 한다.

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `personal_information_scope--EU/korean_summary`

> … (1)호). 처리는 수집·기록·구조화·저장·검색·열람·이용·전송에 의한 공개·배포·결합·처리제한·삭제·파기 등을 포괄한다((2)호). 파일시스템은 특정 기준으로 접근 가능한 구조화된 개인정보 집합이다((6)호). 가명처리는 추가 정보 없이 특정 정보주체에게 귀속할 수 없게 하는 처리이며 추가정보 분리보관 및 기술적·조직적 조치를 조건으로 한다((5)호). 유전정보·생체정보…

### TERM-040 · personal data breach

- 사용자 후속 결정: [추가 조사](breach-terminology-research.md) 후 단일 명칭 대신 실제 사건의 유출·침해 등 내용을 구체적으로 쓰고 법제 문맥에서는 각 국가의 정의와 포함 범위를 풀어 쓰기로 결정했습니다.

- 검토 이유: breach를 모두 유출로 좁히거나 모든 침해와 동일시할 위험.
- 관찰된 표기: 개인정보 침해 / 개인정보 유출
- 확인 방향: 원문의 breach 정의와 사건 유형에 따라 번역 범위를 구분.
- 위치 수: 47개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 기준: **사건 사실과 국가별 법률 정의에 따른 문맥별 표현**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `cnil-hopital-loire-2026/summary_ko`

> 프랑스 개인정보 감독기관(CNIL), 환자정보의 접근 통제와 보안조치 및 개인정보 침해 통지 의무 위반으로 루아르 민간병원에 50만 유로 과징금 부과

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ppc-large-data-leaks-2026/title_ko`

> 일본 PPC, 대규모 개인정보 유출 사례에 따른 안전관리 대응 촉구

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-73-text-1/korean_text`

> …제의 권리, 정보 이동권, 이의제기권, 프로파일링에 근거한 결정, 그리고 정보주체에 대한 개인정보 침해의 통지 및 이와 관련된 개인정보처리자의 특정한 의무에 관한 제한은, 민주사회에서 다음 사항을 보호하기 위하여 필요하고 비례적인 범위에서 연합법 또는 회원국법에 의하여 부과될 수 있다. 공공의 안전으로서 특히 자연재해나 인재에 대응하는 인명 보호를 포함하는 것, 범죄의 예방…

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-73/korean_text`

> …제의 권리, 정보 이동권, 이의제기권, 프로파일링에 근거한 결정, 그리고 정보주체에 대한 개인정보 침해의 통지 및 이와 관련된 개인정보처리자의 특정한 의무에 관한 제한은, 민주사회에서 다음 사항을 보호하기 위하여 필요하고 비례적인 범위에서 연합법 또는 회원국법에 의하여 부과될 수 있다. 공공의 안전으로서 특히 자연재해나 인재에 대응하는 인명 보호를 포함하는 것, 범죄의 예방…

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `breach_notification--CN/major_exceptions`

> …국가안전·공익 위해 관련 제품·서비스 보안 결함/취약점 위험 보고는 24시간 내이며 모든 개인정보 침해의 통일 기한이 아니다. 제11조는 사고 대응계획 즉시 가동·당국 보고와 권익 피해 시 이해관계인 적시 통지를 정한다. 2025-11-01 시행 국가 네트워크 안전사고 보고 관리방법 제2·4·12조는 중국 내 네트워크 소유자·관리자·서비스 제공자가 발견하거나 알게 된 본인 …

### TERM-041 · data portability

- 검토 이유: 외국 제도와 한국 전송요구권을 같은 권리로 오해할 수 있음.
- 관찰된 표기: 이동권
- 확인 방향: 국가별 권리 명칭과 범위를 분리 관리.
- 위치 수: 18개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **개인정보 이동권(전송요구권)**. 공통 안내·해설에 적용하며 법률별 요건과 범위는 구분.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-68-text-1/korean_text`

> …한 형식으로 받아 다른 개인정보처리자에게 전달할 수도 있어야 한다. 개인정보처리자는 정보 이동권을 가능하게 하는 상호운용 가능한 형식을 개발하도록 권장되어야 한다. 그 권리는 정보주체가 자신의 동의에 근거하여 개인정보를 제공하였거나 계약 이행을 위하여 처리가 필요한 경우에 적용되어야 한다. 처리가 동의나 계약 이외의 법적 근거에 기초하는 경우에는 적용되어서는 안 된다. 그 …

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-68/korean_text`

> …한 형식으로 받아 다른 개인정보처리자에게 전달할 수도 있어야 한다. 개인정보처리자는 정보 이동권을 가능하게 하는 상호운용 가능한 형식을 개발하도록 권장되어야 한다. 그 권리는 정보주체가 자신의 동의에 근거하여 개인정보를 제공하였거나 계약 이행을 위하여 처리가 필요한 경우에 적용되어야 한다. 처리가 동의나 계약 이외의 법적 근거에 기초하는 경우에는 적용되어서는 안 된다. 그 …

출처: [data/legal/criteria-mapping.csv](../../data/legal/criteria-mapping.csv) · `data_subject_rights--SG/major_exceptions`

> …고 2020 개정법 공포본의 시행 목록에도 해당 제14조가 포함되지 않아 시행 중인 일반 이동권으로 표시하지 않는다.

### TERM-042 · confidentiality

- 검토 이유: 기밀성과 익명성은 다르며 보안 원칙 명칭도 통일 필요.
- 관찰된 표기: 기밀성
- 확인 방향: 원어 confidentiality 확인 후 기술·법률 문맥별 명칭 검토. 익명성으로 바꾸지 않음.
- 위치 수: 26개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 표기: **기밀성**. 원어 병기 없이 사용.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `oecd-pet-ai-sharing/details_ko`

> … 초록은 개인정보 보호 강화 기술의 활용을 두 유형으로 나눠 설명. 첫째는 입력 데이터의 기밀성을 유지하고 이용을 최소화하면서 AI 모델의 성능을 높이는 유형으로, 신뢰실행환경·연합학습·안전한 다자간 연산을 예시로 제시  - 둘째는 모델 자체의 기밀성을 유지하면서 공동 개발·공유하는 유형으로, 차등 프라이버시·신뢰실행환경·동형암호 등을 예시로 제시  - 이러한 기술은 추가 …

출처: [data/legal/translations/ccpa.json](../../data/legal/translations/ccpa.json) · `main-a1798-140/korean_text`

> …) 네트워크 또는 정보시스템이 저장되거나 전송되는 개인정보의 가용성, 진정성, 무결성 및 기밀성을 손상하는 보안 사고를 탐지하는 능력.  (2) 사업자가 보안 사고를 탐지하고 악의적·기만적·사기적·불법적 행위에 저항하며 그 행위의 책임자에 대한 기소를 돕는 능력.  (3) 사업자가 자연인의 신체적 안전을 보장하는 능력.  (ad)(1) ‘판매하다’, ‘판매하는’, ‘판매’ …

출처: [data/legal/translations/pdpa.json](../../data/legal/translations/pdpa.json) · `appendix-11/korean_text`

> …과를 시험하는 것.  2. 조직이나 공공기관이 보유하거나 통제하는 익명화 정보의 무결성과 기밀성을 시험하는 것.  3. 다음 익명화 정보의 무결성과 기밀성을 보장하거나 보호하는 조직이나 공공기관의 시스템·절차를 평가·시험·검토하는 것.  (a) 그 조직이나 공공기관이 보유하거나 통제하는 정보. 또는  (b) 그 조직이나 공공기관이 전송하거나 수령한 정보.

출처: [data/legal/translations/uk-gdpr.json](../../data/legal/translations/uk-gdpr.json) · `division-39-text-1/korean_text`

> …용되는 장비에 대한 권한 없는 접근이나 사용의 방지를 포함하여, 개인정보의 적절한 보안과 기밀성을 보장하는 방식으로 처리되어야 한다.

출처: [data/derived/gdpr.json](../../data/derived/gdpr.json) · `recital-39/korean_text`

> …용되는 장비에 대한 권한 없는 접근이나 사용의 방지를 포함하여, 개인정보의 적절한 보안과 기밀성을 보장하는 방식으로 처리되어야 한다.

### TERM-043 · call for evidence / consultation

- 검토 이유: 증거 요청·의견수렴 등 절차의 성격이 다른 원어를 구별할 필요.
- 관찰된 표기: 의견수렴 / 의견 모집 / 근거를 요청
- 확인 방향: 절차별 원제와 국내 기관 보고서 용례 비교. 동의어로 단순 합치지 않음.
- 위치 수: 9개 본문·제목·요약 필드. 확정 상태: 사용자 결정 기록. 지정 기준: **모집 대상과 절차에 따라 구체적으로 표현**.

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `edpb-2026-09-21-1/summary_ko`

> 유럽데이터보호이사회(EDPB), GDPR 과징금 부과 여부에 관한 지침을 채택해 공개 의견수렴을 진행하고, 디지털서비스법(DSA)과 GDPR의 상호작용에 관한 최종 지침을 별도 채택

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ico-foundation-agentic-ai-2026/title_ko`

> 영국 ICO, 기초모델 개발사 보호조치 개선 현황 공개 및 에이전트 AI 의견 모집

출처: [data/trends/editorial/report-drafts.json](../../data/trends/editorial/report-drafts.json) · `ico-foundation-agentic-ai-2026/details_ko`

> …전문가를 대상으로 보안·투명성·책임성·자동화된 의사결정·공정성·적법한 데이터 이용에 관한 근거를 요청하고, 제출 기한을 2026년 11월 20일로 안내  - 수집한 의견은 향후 지침과 AI·자동화된 의사결정 관련 법정 실무규범 개발에 활용할 계획이며, 소비자용 AI 서비스의 개인화에 대해서도 연구와 기업 협의를 진행할 방침

## 다음 검토에서 사용할 참고 자료

### TERM-044 · disclose / disclosure

- 확정 상태: 사용자 결정 기록. 지정 기준: **전달 대상·방식과 법률 문맥에 따른 제공·공개·고지 등 구체적 표현**.
- 특정 수신자에게 개인정보를 전달하거나 접근 가능하게 하면 제공, 불특정 다수가 볼 수 있게 하면 공개, 정보주체에게 처리 내용을 설명하면 고지·알림·정보 제공으로 문장에 맞춰 씁니다.
- 외국법의 disclosure를 한국법의 제3자 제공과 자동 동일시하지 않고 조문이 여러 행위를 포괄하면 범위를 풀어 설명합니다. 저장소 전수 예문 추출은 아직 수행하지 않았습니다.

### 추가 검토 요청 · 2026-10-18 · 조사 당시 이력

아래는 조사 당시 검토 내용입니다. 후속 사용자 결정에 따라 TERM-040과 TERM-044 모두 단일 번역을 강제하지 않는 문맥별 적용 기준으로 기록했습니다. 현행 기준은 [용어집](glossary.md)을 따릅니다.

- **TERM-044 · disclose / disclosure**: 신규 후보입니다. 특정 수령자에게 개인정보를 전달하거나 접근 가능하게 하는 경우의 ‘제공’, 불특정 다수에게 드러내는 ‘공개’, 정보주체에게 설명하는 ‘고지·알림’ 등을 문맥별로 검토합니다. 외국법의 disclosure를 한국법의 제3자 제공과 자동 동일시하지 않습니다. 저장소 예문 추출은 아직 수행하지 않았습니다.
- **TERM-040 · personal data breach**: 기존 후보의 검토 범위를 확장합니다. 위법한 수집·처리, 보안사고, 유출·노출·분실·훼손·무단 접근을 구분하고 법률별 정의를 확인합니다. 동의가 없다는 사실만으로 위법 수집으로 판단하지 않고 다른 적법 근거도 확인합니다.
- 확인 근거: [GDPR 제4조 제2호·제12호 및 제6조](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), [ICO 보안사고 안내](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/), [캘리포니아 법무부 CCPA 안내](https://oag.ca.gov/privacy/ccpa), [CCPA 집행 사례](https://oag.ca.gov/privacy/ccpa/enforcement).
- GDPR의 personal data breach는 보안 침해로 인한 파기·분실·변경·무단 공개나 제공·접근 등을 포함하므로 일률적으로 ‘유출’로 축소하지 않습니다. ‘개인정보 침해사고’, ‘개인정보 유출 등 사고’ 등의 국문 명칭과 첫 등장 설명 여부는 사용자 검토 전입니다. 다른 국가의 data breach 정의는 해당 법률을 별도로 대조합니다.


아래는 분야별로 찾아볼 자료 목록입니다. 각 후보의 번역을 이 자료가 지지한다고 확인한 것은 아닙니다. 용어별로 정확한 문서명·발행일·페이지·원문과 실제 한국어 예문을 확보한 뒤 확정합니다.

- AI 용례: [과기정통부 파운데이션 모델 사업 공고](https://www.msit.go.kr/bbs/view.do?bbsSeqNo=100&mId=311&mPid=121&nttSeqNo=3179595). 파운데이션 모델의 국내 기관 사용례가 확인된 항목입니다.
- 개인정보·AI: [개인정보위 생성형 AI 개인정보 처리 안내서 공개 자료](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&nttId=11410).
- GDPR 등 해외 법제: [KISA 가이드북·안내서 자료실](https://cbpr.kisa.or.kr/gdpr/bbs/selectArticleList.do?bbsId=BBSMSTR_000000000061).
- 기술 표기: [TTA 정보통신용어사전](https://terms.tta.or.kr/main.do).
- 법령 번역 원칙: [법제처 13개 언어권별 법령번역지침 및 용어](https://www.data.go.kr/data/15157255/fileData.do).
- 저장소 기존 결정 이력: [GDPR 기업 규모 용어 변경 이력](../../data/legal/sources/gdpr-terminology-change-manifest.json). 기존 이력도 사람 검수 전 상태이므로 확정 용어로 간주하지 않습니다.

## 후보표를 읽고 결정하는 방법

1. 실제 문장에서 무엇이 어색하거나 혼동되는지 확인합니다.
2. 원문에서 실제 쓰인 표현과 정의를 확인합니다.
3. 국내 관련 기관의 전문 자료에서 같은 개념의 한국어 용례를 찾습니다.
4. 채택할 표현·첫 등장 표기·적용 법률·예외·근거를 기록합니다.
5. 확정된 항목부터 용어집으로 옮긴 뒤 기존 문장의 수정안을 검토합니다.

목록은 1차 후보입니다. 단어 사전이나 전체 번역의 품질 보증이 아니며, 한 문장에 여러 개념이 포함된 경우 같은 예문이 여러 후보에 제시될 수 있습니다.
