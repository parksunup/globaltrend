# 공식 원문 1건의 수집·초안·검수 연결 시험

2026-10-13 17:40:48 한국시간 완료. **실제 EDPB 원문을 사용한 로컬 DB/로컬 검수 화면 시험입니다. 운영 Supabase·배포된 Preview의 전 과정 시험은 아닙니다.** 합성 기사나 별도 유료 AI API를 사용하지 않았습니다.

## 원문과 이용조건

- 원문: [EDPB calls for legal basis for cross-regulatory information sharing](https://www.edpb.europa.eu/news/edpb-calls-for-legal-basis-for-cross-regulatory-information-sharing_en), 게시일 2026-07-17. 최신 뉴스 전체를 조사한 것이 아니라 연결 시험을 위한 1건입니다.
- [EDPB Copyright](https://www.edpb.europa.eu/copyright_en)의 상업/비상업 재사용 허용, 출처 표기, 원래 의미·메시지 유지 조건을 직접 읽었습니다. EDPB 자체 발표를 선택했고 출처·공식 링크·날짜를 초안과 검수 화면에 남겼습니다. 이 확인을 9개 기관의 이용조건 승인으로 확대하지 않습니다.
- 원문 파서는 뉴스 본문만 읽었습니다. 연결된 유럽위원회 보고서와 헬싱키 성명 전문은 미열람이며 초안에 그 한계를 명시했습니다.

## 실제로 확인한 경로

1. 현재 robots 정책과 TLS 검증을 유지해 공식 본문을 가져오고 NFC 정규화·SHA-256 해시·표시 날짜를 확인했습니다.
2. 기존 로컬 Supabase에 누락된 기존 migration 8개를 `migration up --local`로 적용했습니다. reset이나 기존 데이터 삭제는 하지 않았습니다.
3. 기존 `ingest_source_item` RPC로 원문·판본·작업을 만들었습니다. 같은 URL/본문을 다시 제출해 자료·판본·작업이 각각 1건을 유지하는 것을 확인했습니다.
4. 현재 대화에서 정확한 입력 판본을 읽어 아래 한국어 초안을 작성했습니다. claim으로 임대를 획득하고 입력 판본·해시·지침을 대조한 다음 기존 `submit_trend_draft` RPC에 제출했습니다. 인용 4개가 실제 입력 판본에 존재하며 근거 행의 판본 ID도 일치합니다.
5. `draft / human_reviewed=false`로 저장됐습니다. 임시 로컬 reviewer 계정으로 앱에 실제 로그인해 `/work`에서 원문·한국어 초안·상세·인용·입력 판본을 브라우저로 확인했습니다. 같은 빌드를 새로고침해 같은 초안이 표시됐고 브라우저 오류는 0개였습니다.
6. 익명의 원문/초안 조회, 브라우저의 worker submit은 거부됐습니다. 공개 화면에 미발행 초안이 나타나지 않았습니다.
7. 시험용 reviewer 계정은 삭제했고, 로컬 출처의 이용조건 승인값은 원래 null로 복원했습니다. 원문·판본·작업·초안은 검토용 로컬 DB에 각각 1건 남겼습니다. 저장소 출처 enabled/collect/store/ai, main, 정기 실행, 요금제는 변경하지 않았습니다.

시험 후 로컬 DB는 13,724,819바이트(약 13.7 MB)이며 400 MB 중단 기준 아래입니다. 운영 계정의 현재 월 전송량·구독 잔량을 확인한 수치가 아닙니다.

DB ID: 자료 `2ab4476e-b632-4794-a403-576078c26a77`, 판본 `9c87d3d7-3ee9-42d1-b23d-8f2b14e4ff2a`, 작업 `b8939781-bf1c-4485-9301-5940c4d3216a`, 보고서 `6cac9563-7e4e-4f1c-8859-324a58573563`. 이 ID들은 로컬 DB의 기록입니다.

원문 해시: `af64416487885c0fdd0c440f63e1325db88e5499da54353b3e6f732e5d598fb4`.

## 운영 시험의 남은 연결

### 설정 등록 후 운영 연결 진단 — 2026-10-13 18:30 KST

PR #32 head `d73fd4f9e937a5460f4fa9ba3b5532cc7d76a498`에서 이어갔습니다. 아래 서버키 부재·초안 저장 실패는 이전 시험 당시의 기록입니다. 이번에는 기존 설정을 유지하면서 `SUPABASE_URL`과 `COLLECTOR_SUPABASE_SECRET_KEY → SUPABASE_SECRET_KEY`를 저장했습니다. 허용 목적지는 `emlgwhkgaihhrirhdpnp.supabase.co`입니다. 설정 재조회에서 `has_saved_binding=true`, 미입력 요구사항 없음으로 확인했습니다.

- 환경 revision 8에서는 변수와 시크릿이 `ready`였습니다. 프로세스에는 보안 프록시 대체값이 제공됩니다. 이를 실제 키의 부재나 잘못된 형식으로 판단하지 않았습니다. 마지막 revision 9에서는 변수·시크릿·네트워크 상태가 `unknown`으로 현재 반영 완료를 주장하지 않습니다.
- 기존 HTTP/HTTPS 프록시와 TLS 검증을 유지한 Python 및 curl로 진단했습니다. 무인증 REST 요청은 `No API key found in request`, 인증된 용량 RPC·출처/자료/일일 claim 조회·Auth settings 요청은 HTTP 401 `Invalid API key`였습니다. `apikey` 단독, Bearer 병행, 헤더 대소문자 비교에서도 같은 결과입니다. 키 값·인증 헤더를 출력하거나 파일에 저장하지 않았습니다.
- 이 응답만으로 입력한 키의 오류를 단정할 수 없습니다. 실제 저장 키나 프록시 치환 결과를 확인하는 지원 도구가 없어 자격 증명과 프록시 전달 중 실패 지점은 미확정입니다. 운영 함수·용량·무료 사용량·원문·초안은 확인하지 못했고 운영 쓰기는 수행하지 않았습니다.
- 기존 작업 공간에 Python 의존성을 설치한 뒤 수집기 검사 46개를 모두 통과했습니다. 실제 EDPB 본문을 robots-aware 파서로 다시 읽어 3,903자, 게시일 2026-07-17, 이전 시험과 동일한 SHA-256을 확인했습니다. 요청 2회·42,496바이트이며 원문/PDF 파일을 저장소에 추가하지 않았습니다.
- PR의 `collector/database/verify`와 Vercel 배포 검사는 모두 pass였습니다. 배포 Preview의 `/work`, `/public`은 HTTP 200이며, 비로그인 `/work`에는 로그인 폼이 있고 수집 검수 패널은 보이지 않았습니다. reviewer 로그인 후 원문·초안 표시나 운영 전 과정 통과는 미검증입니다.

인증 정상화 후 읽기 전용 용량·출처·중복 조회부터 재개합니다. 기존 무료 사용량·출처 승인 조건 충족 전 원문 쓰기/claim/submit을 하지 않습니다. 새 환경·유료 서비스·정기 실행·main 병합은 추가하지 않았습니다.

### 이전 로컬 시험 당시의 연결 상태

현재 관리 환경의 secrets/runtime_variables/outbound_identities는 비어 있고 실제 프로세스에도 운영 Supabase 서버키가 없습니다. `.env.local`은 로컬 API와 공개 클라이언트 키만 가지고 있습니다. GitHub Actions Secrets/Variables 목록은 연결 권한 부족으로 HTTP 403이었습니다. 기존 운영 연결을 시험할 수 있는 서버 권한이 제공되지 않은 상태입니다.

기존 프로젝트 `emlgwhkgaihhrirhdpnp`의 서버 자격 증명과 현재 무료 사용량 확인이 필요합니다. 환경 설정 초안에 `SUPABASE_URL` 및 `COLLECTOR_SUPABASE_SECRET_KEY → SUPABASE_SECRET_KEY`의 해당 HTTPS 호스트 한정 바인딩을 저장하려 했지만 `draft_not_editable`로 거부됐습니다. 다시 읽어도 바인딩은 없으며 **저장은 확인되지 않았습니다.** 게시된 환경 설정에서 새 설정 대화를 열어 필요한 바인딩을 연결해야 합니다. 비밀값을 공개 파일이나 채팅에 넣는 방식은 사용하지 않습니다. 제안한 설정은 현재 작업의 무비밀 `work/production-trial-environment-requirements.json`에 보존했습니다.

이 시험을 운영 DB→배포된 검수 화면 통과나 정기 운영 활성화로 표시하지 않습니다.

## 한국어 초안 전체 — 미검수·미발행

### EDPB, 규제기관 간 정보 공유를 위한 명확한 법적 근거 마련 요청

유럽데이터보호이사회(EDPB)는 유럽위원회에 규제기관 간 정보 공유를 위한 명확한 법적 근거를 제안해 달라고 요청했습니다. EDPB는 기밀정보를 포함한 집행 관련 정보 교환과 개인정보 감독기구 간 자원 협력을 통해 GDPR 집행의 일관성과 효율성을 높이는 방안도 논의했습니다.

EDPB는 2026년 7월 16~17일 더블린에서 열린 고위급 회의에서 서로 인접한 규제 분야를 담당하는 기관 간 협력의 필요성을 강조했습니다. 유럽위원회에 요청한 법적 근거는 각 기관의 권한 범위에서 집행에 필요한 정보를 교환할 수 있도록 하는 취지이며, 기밀정보도 논의 대상에 포함됩니다. 이는 법적 근거를 제안해 달라는 요청으로, 해당 뉴스만으로 새 법률이 채택됐거나 정보 공유 권한이 이미 확대됐다고 볼 수는 없습니다.

EDPB는 개인정보 감독기구가 AI 이용 증가 등을 배경으로 민원의 수와 복잡성이 늘어나는 상황에 직면해 있다고 설명했습니다. 이에 GDPR의 효율적인 집행을 위해 실무적 해법과 필요한 경우 입법적 해법을 찾을 필요가 있다고 밝혔습니다.

국경 간 집행을 강화하는 방안으로는 감독기구 간 자원 결합과 협력 심화가 논의됐습니다. 특히 도움이 되는 경우 민원을 접수한 감독기구가 선임 감독기구에 자원을 제공하는 가능성이 언급됐습니다. 감독기구들은 집행 절차와 국가별 실무를 공유하는 일련의 워크숍도 마련할 계획입니다.

EDPB는 GDPR 적용의 일관성이 이사회 밖의 여러 주체와 활동에도 영향을 받는다고 보고, 개인정보 보호 생태계의 다른 주체들과 대화를 확대하기로 했습니다. 이 요약은 EDPB 뉴스 본문에 한정하며, 연결된 유럽위원회 보고서와 헬싱키 성명 전문은 읽지 않았습니다.

출처: European Data Protection Board (EDPB), 2026년 7월 17일, EDPB calls for legal basis for cross-regulatory information sharing. 공식 링크는 자료의 원문 링크를 따릅니다.

### 핵심 내용

- EDPB는 유럽위원회에 규제기관 간 정보 공유의 법적 근거를 제안해 달라고 요청했습니다.
- 제안의 취지는 각 기관의 권한 범위에서 기밀정보를 포함한 집행 관련 정보를 교환할 수 있게 하는 것입니다.
- 민원을 접수한 감독기구가 선임 감독기구에 자원을 제공하는 가능성을 포함해 협력과 자원 결합 방안이 논의됐습니다.
- 감독기구들은 집행 절차와 국가별 실무에 관한 정보 교환 워크숍을 마련할 계획입니다.

### 개인정보 보호상 의미

작성자 해석: 서로 다른 디지털 규제기관 간 정보 교환과 감독기구의 자원 협력은 집행의 일관성을 높이는 데 도움이 될 수 있습니다. 다만 기밀정보 공유의 구체적인 권한·범위·보호조치는 실제 제안이나 채택된 법령을 추가로 확인해야 하며, 이번 요청 자체를 새로운 법적 권한의 부여로 해석해서는 안 됩니다.

### 근거

> The EDPB calls upon the European Commission to propose a legal basis for cross-regulatory information sharing

뉴스 본문: A clear legal basis for efficient cross-regulatory cooperation 절 — 유럽위원회에 규제기관 간 정보 공유의 법적 근거 제안을 요청했습니다.

> This should enable regulators to exchange information, including confidential information, relevant to enforcement within their respective areas of competence.

뉴스 본문: A clear legal basis for efficient cross-regulatory cooperation 절 — 각 기관의 권한 범위에서 기밀정보를 포함한 집행 관련 정보의 교환을 의도합니다.

> To further boost cross-border enforcement, the Board discussed practical solutions and how to pool resources to further deepen cooperation between DPAs, including the possibility for complaint-receiving authorities to make resources available to lead supervisory authorities, where useful.

뉴스 본문: Strengthening consistency and boosting efficient enforcement 절 — 감독기구 간 자원 결합과 민원 접수 기관의 자원 제공 가능성을 논의했습니다.

> In addition, the DPAs will organise a series of workshops on enforcement procedures and to exchange information on national practices, also in the context of implementing the upcoming Procedural Regulation.

뉴스 본문: Strengthening consistency and boosting efficient enforcement 절 — 집행 절차와 국가별 실무에 관한 정보 교환 워크숍 계획을 밝혔습니다.

### 한계

- EDPB의 뉴스 본문만 확인했으며 연결된 유럽위원회 제2차 GDPR 보고서와 헬싱키 성명 전문은 읽지 않았습니다.
- 법적 근거 마련 요청을 다루는 발표이며, 관련 법률 제안·채택 또는 새로운 정보 공유 권한의 발효 여부를 별도로 검증하지 않았습니다.
- 게시일은 2026년 7월 17일입니다. 최신 기사 전체나 이후 후속 조치의 확인 결과가 아닙니다.
- 원문 인용의 일치 검사는 사람의 내용·번역·법적 의미 검수를 대신하지 않습니다.
