# GitHub 예약 누락 시 팟캐스트 실행

GitHub 예약은 지연되거나 누락될 수 있습니다. 이 보완 경로는 기존 Supabase Cron이 마지막 인증 시각을 확인하고, 확인이 오래됐을 때 기존 GitHub workflow를 시작합니다. Python 작업과 Google 세션은 기존 GitHub 실행기에 남습니다. 새 유료 서비스나 생성 API를 사용하지 않습니다.

마이그레이션은 비활성 설정과 고정된 호출 함수만 추가합니다. DB 소유자와 Cron만 함수를 실행할 수 있고, 웹 로그인 계정과 worker는 실행할 수 없습니다. 호출 대상은 `parksunup/globaltrend`의 `podcast-cloud.yml`, 브랜치는 `main`으로 고정됩니다. 8분 이내에 인증하거나 호출한 기록이 있으면 중복 요청하지 않습니다. 인증 실패 3회 또는 시험 종료 시각 이후에는 호출하지 않습니다. 제작·공개 스위치는 이 함수가 바꾸지 않습니다.

실제 로그인 갱신은 10분 간격입니다. 이는 72시간 동안 수백 번 성공해야 한다는 시험 기준이 아니라, SDK가 사용하는 600초 쿠키 갱신에 맞춘 유지 동작입니다. 이 요청에는 Codex나 유료 생성 API를 사용하지 않습니다. 연결 확인은 실제 Cron 실행 두 번과 서로 다른 GitHub 실행기 사이의 암호화 세션 저장·복원으로 합니다. Google의 강제 로그아웃까지 복구하거나 영구 로그인을 보장하지는 않습니다.

## 최초 연결

1. GitHub에서 `globaltrend` 저장소만 선택한 fine-grained token을 만듭니다. 저장소 권한은 `Actions: Read and write`만 필요합니다. Google 로그인 값이나 Supabase 관리자 키를 넣지 않습니다.
2. 해당 값은 채팅·SQL 본문에 붙이지 않고 Supabase Dashboard의 Vault 입력란에 직접 저장합니다. 이름은 `globaltrend_podcast_github_dispatch`입니다. 토큰 값은 운영자에게 다시 출력하지 않습니다.
3. 운영자는 마이그레이션과 검사를 확인하고 다음 SQL로 타이머를 연결합니다. 시간은 UTC이며, 예약 생성 전에 같은 이름의 작업이 없는지 확인합니다.

```sql
update private.podcast_dispatch_state set enabled=true where id;
select cron.schedule('podcast-cloud-dispatch','*/10 * * * *','select private.podcast_dispatch_tick();');
```

실제 시험에서는 첫 Cron 실행의 `cron.job_run_details`와 `last_request_id`를 확인하고, 대응하는 `net._http_response.status_code`(200 또는 204), 실제 GitHub 실행, DB 세션 버전 증가를 함께 확인합니다. HTTP 요청을 큐에 넣은 것만으로 성공으로 세지 않습니다. 응답 본문·요청 헤더·Vault 값을 조회하지 않습니다.

일시 중단할 때는 해당 cron 작업만 unschedule하고 `private.podcast_dispatch_state.enabled=false`로 둡니다. 토큰이 만료되면 새 전용 토큰을 Vault에서 교체해야 합니다. GitHub 연결 권한이 준비되기 전에는 타이머를 활성화하지 않습니다.
