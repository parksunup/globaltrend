# 주간 동향 초안의 클라우드 예약

## 동작

- Supabase Cron이 매주 월요일 09:00 한국시간에 `weekly-digest` Edge Function을 호출합니다. Supabase Cron 기준 UTC 실행 시각은 월요일 00:00입니다.
- Edge Function은 직전 월요일부터 일요일까지 발표된 한국어 원고 후보를 모두 읽습니다. 같은 원문 자료의 보고서가 여러 개면 가장 최근 수정본 하나를 사용합니다.
- 작업실의 주간 선정 화면과 같은 중요도 규칙으로 최대 8건을 골라 선정 이유와 함께 `written_weekly_issues`에 `draft`로 저장합니다. 적격 원고가 8건보다 적으면 있는 만큼만 저장하고, 하나도 없으면 빈 주간호를 만들지 않습니다.
- 그 주의 주간호가 이미 있으면 자동 작업은 덮어쓰지 않습니다. 자동으로 승인하거나 공개하지 않습니다.
- `/work/weekly`에서 선택 결과와 원고 내용을 확인하고 수정할 수 있습니다. 공개 발행은 총괄 관리자가 작업실에서 별도로 실행합니다.

## 실행 기록과 보안

- 각 실행은 `collector_edge_events`에 `trigger_kind='weekly-digest'`로 실행 ID, 대상 기간, 후보·선정 수, 결과 또는 오류를 남깁니다. 원고 본문이나 비밀값은 기록하지 않습니다.
- 예약 호출에는 기존 Vault의 `trend_collector_invocation_key`를 사용합니다. 브라우저나 저장소에는 키를 노출하지 않습니다.
- Function은 작업실과 팟캐스트가 함께 사용하는 `podcast-scoring` 100점 계산을 통해 후보를 정렬합니다. 팟캐스트의 메인 주제 추천 문턱은 주간 8건 선정에는 적용하지 않습니다.
- `weekly_digest_candidates`는 지정된 주의 보고서 전체를 반환하며 200건 제한 카탈로그 RPC를 거치지 않습니다. `source_item_id`별 최신 보고서 한 건을 선택해 한 원문을 중복 편입하지 않습니다.
- `create_weekly_digest_draft_if_missing`은 주간 시작일 기준 트랜잭션 잠금을 사용하고, 같은 주간호가 이미 있으면 그대로 보존합니다.

## 배포 순서

1. GitHub PR을 검토하고 `main`에 병합합니다.
2. 점수 기준 코드 변경은 DB 구조 변경이 아니므로 migration은 필요하지 않습니다. `weekly-digest` Edge Function과 사이트를 배포하면 월요일 예약은 새 공통 점수 계산을 사용합니다. 함수는 기존 `TREND_COLLECTOR_INVOCATION_KEY` 프로젝트 비밀을 읽습니다.
3. 예약이 아직 없는 새 환경을 최초 구성할 때만 `20261116042042_weekly_digest_edge_schedule_refresh.sql`로 월요일 Cron을 등록합니다. 이미 활성인 예약은 점수 변경을 위해 다시 만들지 않습니다.
4. Supabase Cron 화면 또는 `cron.job`에서 `weekly-digest-monday-0900`이 활성이고 UTC `0 0 * * 1`인지 확인합니다.
5. 실제 실행 뒤 `collector_edge_events`와 `/work/weekly`에서 같은 기간, 선정 건수, `draft` 상태를 확인합니다. 공개 상태로 바꾸지 않습니다.

## 범위

이 기능은 작성된 한국어 동향 중 주간 주요 자료를 자동으로 골라 작업실용 주간호 초안을 준비합니다. Codex가 새 동향을 작성하거나 해설 문장을 새로 생성하는 기능은 아닙니다. 주간호는 선택된 동향의 기존 한국어 원고와 선정 이유로 구성되며, 수정·검수·공개 발행은 팀 작업 흐름에 남습니다.
