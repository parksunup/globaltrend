# 컴퓨터를 꺼도 진행되는 국제요정 팟캐스트

## 현재 상태 (2026-10-28)

제작 화면의 요청을 DB에 저장하면 GitHub Actions가 NotebookLM에 자료와 지시문을 넣고 음성을 만듭니다. 음성이 한 번에 완성되지 않으면 같은 작업 번호를 이어서 확인합니다. 완성 파일은 Supabase의 비공개 저장소에 보관하며, 공개 여부는 제작 요청의 선택값에 따릅니다.

실제 운영 연결 시험에서는 가상의 원고 한 건을 `공개 안 함`으로 등록했습니다. [첫 실행](https://github.com/parksunup/globaltrend/actions/runs/40607933944)이 음성 생성 작업 번호를 저장했고, [두 번째 실행](https://github.com/parksunup/globaltrend/actions/runs/40608713194)이 같은 음성을 회수해 DB에 `ready`로 기록했습니다. 파일은 38,503,611바이트이며 주간호·공개 팟캐스트에는 등록되지 않았습니다. 시험 원고 번호는 `2099-W01`입니다. 실제 관리자 화면에서 재생 버튼을 누르는 검사는 아직 하지 않았습니다.

GitHub 변수 `PODCAST_CLOUD_ENABLED`와 DB의 `podcast_cloud_runtime.enabled`는 모두 **꺼져 있습니다**. 새 자동 제작은 시작되지 않습니다.

로그인 정보는 파일 기반으로 갱신하고 **갱신된 상태를 암호화해 다음 클라우드 실행에 넘깁니다**. 전용 세션을 로컬과 함께 사용하지 않습니다. GitHub 예약 실행이 수 시간 누락된 뒤 Google이 저장 세션을 거절한 것을 확인해, 전용 브라우저 연결을 복구하고 Supabase Cron으로 실행을 시작하는 경로를 추가했습니다. 주 실행 시계는 10분 간격으로 로그인 상태를 확인합니다. 이는 Codex나 유료 생성 API를 사용하는 원고 제작이 아닙니다. 강제 로그아웃까지 자동 복구하거나 영구 로그인을 보장하지 않습니다. [타이머 연결 안내](podcast-dispatch-clock.md)를 참고하세요.

## 관리자가 제작하는 방법

1. 국제요정 관리자 계정으로 `/team/podcast`에 로그인합니다.
2. **클라우드에서 만들기**를 고릅니다.
3. 기간과 깊이 다룰 주제 한 건을 고릅니다. 짧게 덧붙일 소식은 한 건까지, 관련 배경 자료는 최대 여덟 건입니다.
4. 바로 게시하려는 경우에만 **완성되면 이 회차를 바로 공개**를 켭니다. 꺼두면 음성만 비공개로 저장됩니다. Preview에서 요청한 회차는 자동 공개되지 않습니다.
5. 제작 버튼을 누르면 요청이 작업실에 나타납니다. 자동 실행이 켜져 있다면 화면이나 컴퓨터를 닫아도 클라우드가 이어서 처리합니다. GitHub 예약 실행은 지연될 수 있습니다.
6. 작업이 `ready`가 되면 **완성본 듣기**로 내용을 확인합니다. 공개하지 않은 회차는 확인 후 **공개하기**로 게시합니다.

주제 선택과 사실 검수는 사람이 합니다. 선정한 자료 입력, 음성 생성, 회수, 비공개 저장은 클라우드가 처리합니다.

## 계정과 비밀정보

- Google 공식 NotebookLM API가 아닌 `notebooklm-py[mcp]==0.8.5`의 **NotebookLM MCP 서버**를 사용합니다. GitHub Actions 실행기는 임시 인증 프로필로 stdio MCP 서버를 시작하고 `notebook_list` → `notebook_create` → `source_add` → `studio_generate` → `studio_status` → `studio_download` 도구를 호출합니다. Python SDK를 직접 호출하지 않습니다. 최초 전달용 `NOTEBOOKLM_AUTH_JSON`은 암호화 상태가 없는 첫 실행에서만 사용합니다. 최초 저장이 확인되면 이 Secret을 삭제합니다. 이후에는 DB의 최신 암호문만 읽습니다.
- AES-256-GCM 암호문은 `private.podcast_session_state`, 복호화 키는 GitHub Secret `PODCAST_SESSION_KEY`에 둡니다. 계정 확인값은 `PODCAST_ACCOUNT_EMAIL` Secret입니다. DB에는 평문 쿠키나 복호화 키를 보관하지 않습니다. 암호화할 때마다 새 nonce를 쓰고 세션 버전을 인증 데이터에 묶습니다.
- 해당 비공개 테이블과 RPC는 일반 로그인 계정과 익명 계정이 읽거나 실행할 수 없습니다. 기존 OIDC를 통과한 main의 worker만 세션을 선점합니다. 한 번에 한 실행만 접근하고, 이전 버전의 저장은 거절합니다. 연속 3회 실패하면 갱신을 자동 중단합니다.
- 세션은 저장소 코드, GitHub artifact/cache, PR, 사이트 화면, 실행 로그에 넣지 않습니다. GitHub 실행기는 표준 공개 저장소용 `ubuntu-latest`입니다.
- 연결 스크립트 `scripts/podcast-cloud/connect.ps1`은 별도 Chrome 프로필로 전용 계정에 로그인한 뒤 최초 전달용 Secret을 준비합니다. 기존 암호화 키는 덮어쓰지 않습니다. 넘긴 로컬 세션은 다시 사용하지 않습니다. 전용 계정을 다른 브라우저에서 별도로 로그인하는 것과 같은 쿠키 파일을 복제해 쓰는 것은 다릅니다.
- Google 쿠키 파일은 정기 실행의 영구 인증 수단이 아닙니다. [도구의 설치 안내](https://github.com/teng-lin/notebooklm-py/blob/main/docs/installation.md)는 GitHub처럼 매번 새 실행기를 쓰는 환경에 장기 토큰을 권장합니다. 장기 토큰은 계정 접근 권한이 큰 비밀정보이므로 팟캐스트 전용 계정인지 확인하고, 실제 발급과 검증에 성공하기 전에는 운영 Secret으로 전환하지 않습니다.
- 신원 검증은 GitHub의 짧은 OIDC 토큰을 사용합니다. Supabase Edge Function이 저장소 ID, 소유자 ID, 공개 여부, `main` 브랜치, 정확한 workflow, GitHub 실행기를 확인합니다. [PR #64](https://github.com/parksunup/globaltrend/pull/64)에서 운영 토큰의 저장소 ID 포함 형식으로 수정했고, 실제 클라우드 실행에서 연결을 확인했습니다.

## 비용과 저장 한도

- 유료 API나 유료 실행기를 사용하지 않습니다. 무료 한도가 다 차면 저장을 멈추며 유료 전환을 자동으로 하지 않습니다.
- 오디오 파일 하나는 최대 50MB, 팟캐스트 저장소 합계는 200MB로 제한합니다. 이번 시험 파일은 약 38.5MB를 차지합니다. 주간 운영을 오래 지속하려면 오래된 파일의 보관·삭제 또는 다른 무료 저장 경로를 먼저 결정해야 합니다.
- NotebookLM 계정 자체의 생성 한도와 GitHub 예약 실행의 지연·중단 가능성도 따릅니다. 이 제한을 “항상 무료로 무제한 자동 제작”이라고 안내하지 않습니다.

## 실패했을 때

- 작업실에 `needs_login`이 나오면 Google이 재로그인을 요구한 것입니다. 운영자는 먼저 GitHub의 `PODCAST_SESSION_ENABLED`, `PODCAST_CLOUD_ENABLED`와 DB의 두 실행 스위치를 끄고, 진행 중인 실행이 끝났는지 확인합니다. 새 전용 세션을 준비한 뒤 기존 암호문을 의도적으로 초기화하는 절차가 필요합니다. 연결 스크립트만 반복해 기존 상태를 덮어쓰지 않습니다.
- NotebookLM 요청의 완료 여부가 불명확하면 같은 음성을 중복 생성하지 않고 `blocked`로 멈춥니다. 먼저 NotebookLM에서 실제 작업 상태를 확인합니다.
- 음성이 만들어져도 공개 설정을 끈 원고는 게시되지 않습니다. 제작 중 자료가 바뀌면 공개 단계에서 최신 자료와 다시 대조합니다.
- Google 연결이 마지막으로 확인된 지 2시간이 넘으면 클라우드 제작 요청을 새로 받지 않습니다.

## 로그인 유지 시험 (운영자용)

- `PODCAST_SESSION_ENABLED=true`, `PODCAST_CLOUD_ENABLED=false`로 인증 검사만 실행합니다. GitHub 변수 `PODCAST_SESSION_TEST_UNTIL`과 DB의 `private.podcast_session_state.test_until`에 같은 종료 시각을 지정합니다. DB에서는 `enabled=true`로 시험을 시작합니다. `podcast_cloud_runtime.enabled`는 false로 둡니다.
- 주 실행 시계는 Supabase Cron의 10분 간격입니다. 8분 이내에 인증하거나 실행을 요청한 기록이 있으면 중복 요청하지 않습니다. GitHub 자체 예약은 매시 17분(UTC)의 보조 경로이며 지연·누락될 수 있습니다. worker가 최신 암호문을 임시 MCP 프로필에 복원하고 `notebook_list`로 실제 접속을 확인한 뒤 서버가 갱신한 프로필을 다시 암호화해 저장합니다. 복원 파일의 수정 시각을 과거로 두어 갱신이 잘못 생략되지 않도록 합니다. 실패 로그에는 고정된 단계·원인 코드만 남기며, MCP 오류 메시지·응답·URL은 출력하지 않습니다. `token_extraction`을 Google 로그인 만료로 단정하지 않습니다.
- 각 실행은 버전·검사 시각·성공 여부만 `private.podcast_session_checks`에 기록합니다. 인증값은 기록하지 않으며 기록은 10일간 보관합니다. Google 세션은 runner의 소유자 전용 임시 파일에만 풀고 실행 뒤 삭제합니다. artifact/cache에 저장하지 않습니다.
- DB 종료 시각이 지나면 다음 선점 또는 Supabase 타이머 호출 때 자동 중단됩니다. GitHub도 종료 시각 이후 패키지 설치와 Google 접속을 건너뜁니다. 72시간·180회 같은 반복 횟수는 통과 기준으로 사용하지 않습니다. 실제 타이머 실행 두 번 사이에 서로 다른 실행기에서 복원·실접속·암호화 저장과 버전 증가를 확인합니다. Supabase가 시작한 GitHub 실행의 이벤트명은 `workflow_dispatch`입니다. 따라서 이벤트 이름만으로 예약 성공을 판단하지 않고 `cron.job_run_details`, 요청 시각과 HTTP 상태, 대응하는 GitHub 실행을 함께 대조합니다. 수동 호출을 예약 성공으로 세지 않습니다. 이 검사는 연결 동작 확인이며 장기 로그인 보장은 아닙니다.
- 시험이 통과해도 주간 제작은 별도 활성화합니다. DB의 시험 종료 시각을 해제하고 세션·제작 스위치를 명시적으로 켜야 합니다.

## 시험 기록

- 2026-10-27: 전용 계정으로 로컬에서 가상 음성을 생성하고, [GitHub 클라우드 회수 시험](https://github.com/parksunup/globaltrend/actions/runs/40491079311)과 [클라우드 생성 시험](https://github.com/parksunup/globaltrend/actions/runs/40491881309)을 성공했습니다. 사용자 작업공간의 `output/podcast-pipeline/`에 시험본을 보관했습니다.
- 2026-10-28: 운영 DB와 GitHub workflow를 잠시 켜서 비공개 시험 원고를 끝까지 처리했습니다. Edge Function의 OIDC 연결, DB 선점·체크포인트, NotebookLM 음성 생성·회수, Supabase 비공개 파일 저장을 확인했습니다. 주간호·공개 팟캐스트 등록은 없었습니다.
- [PR #64의 CI](https://github.com/parksunup/globaltrend/pull/64)는 팟캐스트 단위 검사, 데이터베이스, 앱 검증, 수집기 검사를 모두 통과했습니다.

## 참고

- [NotebookLM 도구의 CI 인증 설명](https://github.com/teng-lin/notebooklm-py/blob/main/docs/installation.md)
- [NotebookLM 도구의 로그인 문제 해결](https://github.com/teng-lin/notebooklm-py/blob/main/docs/troubleshooting.md)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)
