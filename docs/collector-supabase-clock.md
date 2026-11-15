# 수집 예약 시계

2026-11-12~14 GitHub `schedule` 이벤트는 오전 3시로 설정됐지만 실제 실행 기록이 오전 8~9시에 만들어졌다. 실행 기록 생성과 작업 시작 사이의 대기는 없었다. 따라서 GitHub 예약 이벤트를 더 이상 수집의 시계로 쓰지 않는다.

Supabase Cron은 한국시간 오전 3시에 Crawlee와 Scrapling, 오전 6시에 cloud Python GitHub workflow를 `workflow_dispatch`로 호출한다. Python 수집 작업은 기존 GitHub 실행기에 남는다. DB 서버의 시간대는 UTC이며 `18:00 UTC = 03:00 KST`, `21:00 UTC = 06:00 KST`다. 매 5분 재확인하는 작업은 GitHub HTTP 수락(200/204)을 확인하고 실패한 전달만 최대 3회 재시도한다. `private.collector_github_dispatches`의 한국 날짜·workflow 기본키가 같은 날 중복 전달을 막는다.

호출 자격증명은 Vault의 기존 저장소 전용 `globaltrend_podcast_github_dispatch`를 재사용한다. 값을 SQL·Git·로그에 출력하지 않는다. 계정에서 Actions 쓰기 권한을 잃으면 수집 호출도 실패하므로, 토큰 교체 시 두 용도를 함께 확인해야 한다.

## 운영 확인

1. `cron.job_run_details`에서 `collector-github-dispatch-03`, `collector-github-dispatch-06`의 시작시각과 성공 여부를 확인한다.
2. `private.collector_github_dispatches`의 `status`, `attempts`, `http_status`, `github_run_id`를 확인한다. `pending`은 아직 성공이 아니며 `accepted`는 GitHub가 실행을 수락했다는 뜻이다.
3. 각 `github_run_id`의 Actions 결과와 `collector_runs`·`scrapling_collection_runs`·cloud queue 결과를 확인한다. HTTP 수락만으로 수집 성공이나 한국어 초안 작성 완료라고 보고하지 않는다.
4. `failed`이면 토큰 권한, HTTP 상태, GitHub 실행을 확인하고 해당 날짜의 행을 검토한 다음 재시도한다. 행을 무작정 삭제해 중복 수집을 만들지 않는다.

한국어 초안은 별도 Codex 작성 단계다. 이 예약 전환은 원문 수집을 시작할 뿐 `draft_jobs`의 대기 원고를 자동으로 작성하지 않는다.
