# 03:00 수집 실행 모니터링

- 실제 수집 예약은 `.github/workflows/scrapling-daily-collector.yml`의 03:00 KST 스케줄입니다.
- 이 모니터는 매일 08:10 KST에 GitHub Actions 실행 이력을 읽고, 예정 시각과 실제 시작 시각의 차이를 최근 7일 범위로 workflow summary에 남깁니다.
- 시작 지연이나 당일 미관측은 즉시 수집 실패로 처리하지 않습니다. collector는 최근 3일을 겹쳐 확인하므로 다음 실행에서 보완될 수 있습니다.
- 수집 이력은 Supabase의 `scrapling_collection_runs`와 함께 확인합니다. GitHub 일정 상태만으로 자료 저장 완료를 단정하지 않습니다.
- 베트남 정부 전자신문은 승인된 신규 수집 경로로 중앙 `sources` 풀에 등록하는 별도 migration을 둡니다. 기존 Edge/Crawlee 파이프라인 및 비활성 Cron/Queue 설정은 이 변경으로 활성화하지 않습니다.
- OECD의 2026-11-11 KST 실행은 새 WebCMS/RSS 대체경로에 도달하지 못했습니다. worker가 `collector_source_allowed` 응답 `false`를 받아 adapter 호출 전에 보류했습니다. 현재 SQL 확인은 허용 `true`를 반환하므로, 다음 실행의 RPC 결과와 DB 상태를 함께 비교해 일시적/환경 불일치 원인을 좁혀야 합니다.
