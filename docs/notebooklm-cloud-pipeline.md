# 컴퓨터를 꺼도 진행되는 국제요정 팟캐스트

## 무엇을 구현했나요?

`국제요정 제작 화면 → DB 제작 요청 → GitHub Actions → NotebookLM → 오디오 저장 → 선택한 경우 공개`

NotebookLM MCP 프로젝트 `notebooklm-py` 0.8.5의 실행 엔진을 사용합니다. 채팅용 MCP 서버를 항상 켜 두는 대신 같은 Python SDK를 GitHub 실행기에서 호출합니다. Codex에 MCP를 등록한 상태라는 뜻은 아닙니다. Chrome 확장 프로그램은 기본 경로가 아니며, 이전 브라우저 제작을 위한 선택지로만 남깁니다.

## 이용 순서

1. 사이트 관리자 계정으로 `/team/podcast`에 로그인합니다.
2. 제작 방식은 **클라우드에서 만들기**로 둡니다.
3. 기간과 메인 주제 한 가지를 고릅니다. 짧게 덧붙일 소식은 한 가지까지 선택합니다. 관련 배경 자료는 최대 8개입니다.
4. 바로 공개하려면 **완성되면 이 회차를 바로 공개**를 켭니다. 끄면 오디오만 저장합니다. Preview에서 요청한 회차는 자동 공개하지 않습니다.
5. 제작 버튼을 누르고 제작 현황에 요청이 나타났는지 확인합니다. 이후 화면을 닫거나 컴퓨터를 꺼도 됩니다.
6. 클라우드가 약 15분 간격으로 확인합니다. GitHub 예약은 지연·누락될 수 있어 즉시 실행이나 정확한 분 단위 시작을 보장하지 않습니다.
7. 완성되면 **완성본 듣기**를 누릅니다. 자동 공개를 끈 회차는 운영 화면의 **공개하기**로 게시합니다.

매주 주제 선택까지 임의로 대신하는 기능은 아닙니다. 주제 선택·제작 요청 이후 자료 입력, 음성 생성, 회수, 저장, 선택적 게시가 자동입니다. 한 번의 클라우드 실행에서 생성이 끝나지 않아도 다음 실행에서 기존 음성 번호를 이어 확인합니다.

## 처음 한 번 필요한 계정 연결

전용 Google 계정만 사용합니다. 개인 메일·Drive·조직 관리자 권한이 있는 계정을 쓰지 마세요. 일반 웹 로그인 쿠키는 NotebookLM 전용 권한 토큰이 아니므로 더 넓은 계정 접근 위험을 가집니다.

1. GitHub CLI를 공식 `https://cli.github.com`에서 설치하고 `gh auth login`으로 저장소 관리자 계정에 로그인합니다.
2. 저장소 루트에서 `scripts/podcast-cloud/connect.ps1`을 실행합니다. Python이 다른 위치에 있으면 `-PythonExecutable`에 실제 실행 파일을 지정합니다.
3. 별도 브라우저에서 **본인이 직접** 전용 Google 계정으로 로그인합니다. 도구는 기존 브라우저 쿠키를 뒤지지 않습니다.
4. 검증 후 `확인`을 입력하면 세션을 `parksunup/globaltrend`의 GitHub Actions Secret `NOTEBOOKLM_AUTH_JSON`에 stdin으로 전송합니다. 비밀번호·세션을 채팅, Git, 댓글, 공개 화면에 붙이지 않습니다.
5. Google 세션은 `.podcast-private/` 안에만 저장되며 `.gitignore`와 현재 Windows 사용자 전용 폴더 ACL로 보호합니다. 이 디렉터리는 외부에 전달하지 않습니다.
6. PR 병합 후 GitHub 변수 `PODCAST_CLOUD_ENABLED=true`와 DB `podcast_cloud_runtime.enabled=true`를 켜고 수동 실행으로 실제 생성·회수를 시험합니다. 인증 없는 API가 401로 차단되고 OIDC 저장이 성공해도 실제 Google 생성 시험을 대신하지 않습니다.

사용자는 2026-10-27에 전용 계정 세션의 GitHub 암호화 저장 및 이 패키지의 클라우드 사용을 승인했습니다. 같은 날 전용 계정으로 직접 로그인한 세션을 `NOTEBOOKLM_AUTH_JSON` Secret에 연결했고, Secret 이름과 인증 시험을 확인했습니다. 비밀번호·세션 본문은 저장소에 넣지 않았습니다. 연결 스크립트는 설치된 Chrome의 별도 프로필을 사용하며, 이 컴퓨터에서는 Windows 신뢰 인증서를 Python에도 적용해 인증서 검증을 유지합니다.

## 비용·실행 환경

- 저장소가 공개인지 GitHub API로 확인했습니다. 표준 `ubuntu-latest` GitHub-hosted 실행기만 사용합니다. 비공개 저장소·유료 대형 실행기·self-hosted 실행에서는 차단합니다.
- GitHub에 음성·쿠키·제작 자료를 artifact/cache로 저장하지 않습니다. 생성된 음성만 기존 Supabase의 비공개 `weekly-podcasts` 버킷에 보관합니다.
- 한 파일 50MB, 팟캐스트 버킷 합계 200MB에서 새 저장을 멈춥니다. Supabase 전체 용량·트래픽, NotebookLM 계정 한도도 따릅니다. 무제한 무료 서비스를 약속하지 않으며 유료 전환이나 결제를 자동으로 하지 않습니다.
- GitHub 예약은 기본 브랜치에 workflow가 있어야 합니다. 공개 저장소의 비활동 기간 등으로 예약이 꺼질 수 있습니다. 실행기 지연이나 세션 만료는 제작 화면의 마지막 상태로 확인합니다.
- 계정 세션이 만료되면 본인이 다시 로그인해 Secret을 교체해야 합니다. 영구 로그인이나 무기한 자동 갱신은 보장하지 않습니다.

## 안전장치

- Google 공식 API가 아닌 비공식 구현입니다. 내부 서비스 변경·계정 제한으로 실패할 수 있습니다.
- Supabase 관리자 키를 GitHub에 복사하지 않습니다. GitHub의 서명된 짧은 OIDC 토큰을 확인하며 저장소 ID·소유자 ID·공개 여부·main·workflow 경로·이벤트·GitHub-hosted 실행기를 모두 검사합니다. 임의 브랜치와 PR은 접근하지 못합니다.
- DB worker RPC는 service_role만 호출합니다. 기존 관리자·원고 스냅샷 검사를 지키고, 요청한 관리자 기록에서만 자동 공개 권한을 확인합니다. 일반 로그인 사용자는 클라우드 lease나 완료 상태를 조작하지 못합니다.
- 선점 기한과 실행 ID로 동시 제작을 막습니다. 외부 생성 직전 상태를 먼저 저장합니다. 요청이 접수됐는지 불명확하면 중복 생성 대신 중단합니다.
- 제작 중 원고 내용·공개 상태가 바뀌면 공개를 막습니다. 취소한 작업은 완료·게시하지 않습니다. 이미 게시된 작업을 과거 단계로 되돌리지 않습니다.
- 마지막 Google 세션 확인이 2시간보다 오래됐으면 새 요청을 받지 않습니다. 연결 해제는 GitHub 변수 false, DB enabled false, Secret 삭제 및 Google 계정 세션 철회로 처리합니다.

## 검증 기록 — 2026-10-27

- 설치 버전의 SDK 메서드 인자를 실제로 확인했습니다. Python 모의시험 4개, Node 테스트 9개, 타입 검사·Next.js 운영 빌드·연결 스크립트 PowerShell 구문 검사 통과.
- 운영 DB 마이그레이션 `20261027065954_podcast_cloud_worker` 적용. runtime은 비활성으로 유지.
- `podcast-cloud` Edge Function 배포. 함수 자체가 GitHub OIDC 서명을 검증하므로 플랫폼의 Supabase JWT 검사만 끕니다. 무인증 요청 401 확인.
- `docs/podcast-cloud-rollback-check.sql`: 단일 선점, 이중 선점 차단, 기존 게시 함수 연결, 게시 후 상태 역행 차단을 트랜잭션 안에서 검사한 뒤 모두 롤백했습니다.
- 전용 Google 계정에서 게시하지 않는 가상 자료를 넣어 짧은 한국어 음성 1건을 실제 생성했습니다. 작업 번호 `31e7419b-3190-42b1-809e-497a2d629065`의 완료를 확인하고 MP4 오디오 10,836,773바이트를 내려받았습니다. 사용자 작업공간의 `output/podcast-pipeline/notebooklm-smoke-2026-10-27.m4a`에 시험본을 두었습니다.
- [GitHub 클라우드 시험 실행 #40491079311](https://github.com/parksunup/globaltrend/actions/runs/40491079311)에서 표준 Ubuntu 실행기가 Secret으로 인증하고 **같은 작업 번호의 음성 10,836,773바이트를 회수**했습니다. 추가 음성을 만들거나 GitHub artifact에 음성·쿠키를 보관하지 않았습니다. 일회성 시험 workflow는 결과 확인 후 PR 브랜치에서 제거합니다.
- [GitHub 클라우드 생성 시험 #40491881309](https://github.com/parksunup/globaltrend/actions/runs/40491881309)에서 **새 한국어 시험 음성을 실제 생성하고 회수**했습니다. 작업 번호 `c6d8ab12-7ed6-40f2-83b1-6d78bf98f251`, 오디오 10,247,128바이트를 확인했습니다. 사용자가 들을 수 있는 시험본은 `output/podcast-pipeline/notebooklm-cloud-smoke-2026-10-27.m4a`입니다. 공개된 기사가 아닌 가상 자료로 만들었으며, 사이트에 게시하지 않았습니다. 일회성 생성 workflow는 결과 확인 후 PR 브랜치에서 제거합니다.
- 아직 검증하지 못한 구간은 **운영 workflow → GitHub OIDC → DB 작업 선점 → 오디오 Storage 저장 → 사이트 재생·게시**입니다. 운영 workflow는 main에 없고 `PODCAST_CLOUD_ENABLED`와 DB runtime도 켜지 않았습니다. 이 전 과정을 확인하기 전에는 사이트의 제작 버튼이 실제로 작동한다고 안내하지 않습니다.

## 참고 문서

- https://github.com/teng-lin/notebooklm-py
- https://github.com/teng-lin/notebooklm-py/blob/main/docs/configuration.md
- https://docs.github.com/en/actions/concepts/security/openid-connect
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
