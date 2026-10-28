# 컴퓨터를 꺼도 진행되는 국제요정 팟캐스트

## 현재 상태 (2026-10-28)

제작 화면의 요청을 DB에 저장하면 GitHub Actions가 NotebookLM에 자료와 지시문을 넣고 음성을 만듭니다. 음성이 한 번에 완성되지 않으면 같은 작업 번호를 이어서 확인합니다. 완성 파일은 Supabase의 비공개 저장소에 보관하며, 공개 여부는 제작 요청의 선택값에 따릅니다.

실제 운영 연결 시험에서는 가상의 원고 한 건을 `공개 안 함`으로 등록했습니다. [첫 실행](https://github.com/parksunup/globaltrend/actions/runs/40607933944)이 음성 생성 작업 번호를 저장했고, [두 번째 실행](https://github.com/parksunup/globaltrend/actions/runs/40608713194)이 같은 음성을 회수해 DB에 `ready`로 기록했습니다. 파일은 38,503,611바이트이며 주간호·공개 팟캐스트에는 등록되지 않았습니다. 시험 원고 번호는 `2099-W01`입니다. 실제 관리자 화면에서 재생 버튼을 누르는 검사는 아직 하지 않았습니다.

GitHub 변수 `PODCAST_CLOUD_ENABLED`와 DB의 `podcast_cloud_runtime.enabled`는 모두 **꺼져 있습니다**. 새 자동 제작은 시작되지 않습니다.

**남은 문제:** 현재 GitHub Secret의 Google 로그인 쿠키는 짧은 기간에 만료될 수 있습니다. 2026-10-28에 실제로 만료를 확인하고 다시 연결했습니다. 전용 계정 장기 토큰 발급도 시도했지만 Google이 일회용 인증값을 거절하여 성공하지 못했습니다. 따라서 “컴퓨터를 끈 채 매주 계속 자동 제작”은 아직 안정적으로 보장할 수 없습니다. 장기 토큰이 실제로 발급되고 클라우드 재발급 시험을 통과한 뒤에만 예약 실행을 켭니다.

## 관리자가 제작하는 방법

1. 국제요정 관리자 계정으로 `/team/podcast`에 로그인합니다.
2. **클라우드에서 만들기**를 고릅니다.
3. 기간과 깊이 다룰 주제 한 건을 고릅니다. 짧게 덧붙일 소식은 한 건까지, 관련 배경 자료는 최대 여덟 건입니다.
4. 바로 게시하려는 경우에만 **완성되면 이 회차를 바로 공개**를 켭니다. 꺼두면 음성만 비공개로 저장됩니다. Preview에서 요청한 회차는 자동 공개되지 않습니다.
5. 제작 버튼을 누르면 요청이 작업실에 나타납니다. 자동 실행이 켜져 있다면 화면이나 컴퓨터를 닫아도 클라우드가 이어서 처리합니다. GitHub 예약 실행은 지연될 수 있습니다.
6. 작업이 `ready`가 되면 **완성본 듣기**로 내용을 확인합니다. 공개하지 않은 회차는 확인 후 **공개하기**로 게시합니다.

주제 선택과 사실 검수는 사람이 합니다. 선정한 자료 입력, 음성 생성, 회수, 비공개 저장은 클라우드가 처리합니다.

## 계정과 비밀정보

- Google 공식 NotebookLM API가 아닌 `notebooklm-py==0.8.5`를 사용합니다. 현재 GitHub Secret `NOTEBOOKLM_AUTH_JSON`에는 Google 로그인 세션이 암호화되어 보관됩니다. 비밀번호는 저장하지 않습니다.
- 세션은 저장소 코드, GitHub artifact/cache, PR, 사이트 화면, 실행 로그에 넣지 않습니다. GitHub 실행기는 표준 공개 저장소용 `ubuntu-latest`입니다.
- 연결 스크립트 `scripts/podcast-cloud/connect.ps1`은 별도 Chrome 프로필로 전용 계정에 로그인한 뒤 세션을 Secret에 보냅니다. 이 컴퓨터의 로컬 인증 파일은 Git에서 제외된 `.podcast-private/`에 둡니다.
- Google 쿠키 파일은 정기 실행의 영구 인증 수단이 아닙니다. [도구의 설치 안내](https://github.com/teng-lin/notebooklm-py/blob/main/docs/installation.md)는 GitHub처럼 매번 새 실행기를 쓰는 환경에 장기 토큰을 권장합니다. 장기 토큰은 계정 접근 권한이 큰 비밀정보이므로 팟캐스트 전용 계정인지 확인하고, 실제 발급과 검증에 성공하기 전에는 운영 Secret으로 전환하지 않습니다.
- 신원 검증은 GitHub의 짧은 OIDC 토큰을 사용합니다. Supabase Edge Function이 저장소 ID, 소유자 ID, 공개 여부, `main` 브랜치, 정확한 workflow, GitHub 실행기를 확인합니다. [PR #64](https://github.com/parksunup/globaltrend/pull/64)에서 운영 토큰의 저장소 ID 포함 형식으로 수정했고, 실제 클라우드 실행에서 연결을 확인했습니다.

## 비용과 저장 한도

- 유료 API나 유료 실행기를 사용하지 않습니다. 무료 한도가 다 차면 저장을 멈추며 유료 전환을 자동으로 하지 않습니다.
- 오디오 파일 하나는 최대 50MB, 팟캐스트 저장소 합계는 200MB로 제한합니다. 이번 시험 파일은 약 38.5MB를 차지합니다. 주간 운영을 오래 지속하려면 오래된 파일의 보관·삭제 또는 다른 무료 저장 경로를 먼저 결정해야 합니다.
- NotebookLM 계정 자체의 생성 한도와 GitHub 예약 실행의 지연·중단 가능성도 따릅니다. 이 제한을 “항상 무료로 무제한 자동 제작”이라고 안내하지 않습니다.

## 실패했을 때

- 작업실에 `needs_login`이 나오면 Google 로그인이 만료된 것입니다. 전용 계정 세션을 다시 연결한 뒤 관리자가 제작을 재개합니다.
- NotebookLM 요청의 완료 여부가 불명확하면 같은 음성을 중복 생성하지 않고 `blocked`로 멈춥니다. 먼저 NotebookLM에서 실제 작업 상태를 확인합니다.
- 음성이 만들어져도 공개 설정을 끈 원고는 게시되지 않습니다. 제작 중 자료가 바뀌면 공개 단계에서 최신 자료와 다시 대조합니다.
- Google 연결이 마지막으로 확인된 지 2시간이 넘으면 클라우드 제작 요청을 새로 받지 않습니다.

## 시험 기록

- 2026-10-27: 전용 계정으로 로컬에서 가상 음성을 생성하고, [GitHub 클라우드 회수 시험](https://github.com/parksunup/globaltrend/actions/runs/40491079311)과 [클라우드 생성 시험](https://github.com/parksunup/globaltrend/actions/runs/40491881309)을 성공했습니다. 사용자 작업공간의 `output/podcast-pipeline/`에 시험본을 보관했습니다.
- 2026-10-28: 운영 DB와 GitHub workflow를 잠시 켜서 비공개 시험 원고를 끝까지 처리했습니다. Edge Function의 OIDC 연결, DB 선점·체크포인트, NotebookLM 음성 생성·회수, Supabase 비공개 파일 저장을 확인했습니다. 주간호·공개 팟캐스트 등록은 없었습니다.
- [PR #64의 CI](https://github.com/parksunup/globaltrend/pull/64)는 팟캐스트 단위 검사, 데이터베이스, 앱 검증, 수집기 검사를 모두 통과했습니다.

## 참고

- [NotebookLM 도구의 CI 인증 설명](https://github.com/teng-lin/notebooklm-py/blob/main/docs/installation.md)
- [NotebookLM 도구의 로그인 문제 해결](https://github.com/teng-lin/notebooklm-py/blob/main/docs/troubleshooting.md)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)
