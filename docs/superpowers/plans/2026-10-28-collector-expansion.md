# Collector Expansion Implementation Plan

> **For agentic workers:** Execute with superpowers:executing-plans in this session.

**Goal:** 11개 신규 출처의 Edge 적합성을 검증하고 가능한 경로를 기존 일일 3일 조회·한국어 작성 파이프라인에 연결한다.

**Architecture:** 기존 Edge 큐와 런타임을 유지하며 확장 파서 모듈과 출처 설정을 추가한다. 검증되지 않은 출처는 hold 상태로 보존한다. 기존 ChatGPT 작성·주간 선정 예약을 확장 출처 목록과 검증 판본에 맞춘다.

**Tech Stack:** Deno 2.9.6, TypeScript, linkedom 0.18.12, Supabase Postgres/Cron/Queues, 기존 Codex 예약.

**Spec:** docs/superpowers/specs/2026-10-28-collector-expansion-design.md

## Global Constraints
- 일일 조회는 한국시간 실행일과 직전 이틀(합계 3일).
- 수집 책임은 한국어 초안 검증 및 /work 저장까지.
- 법률안·법률·판결 전문 대신 보도자료를 수집한다.
- 신규 유료 API·추가 서비스·자동 공개·main 임의 병합 없음.

## Review Focus
- robots/호스트/리디렉션 거부를 정상 빈 결과로 오인하지 않기.
- 수정일·예정 행사일·본문 사건일을 게시일로 쓰지 않기.
- 목록 페이지 교체·고정 기사·중복 언어판의 누락/중복 방지.
- 3일 범위 밖 기사와 날짜 미확정 기사를 무조건 작성하지 않기.
- 새 출처의 작업 큐와 기존 전체 한국어 작성 소비자 연결 보장.

### Task 1: 실제 경로·Edge 접근 검증
- [ ] 공식 목록을 조회하고 본문·게시일·robots·이용 안내를 조사한다.
- [ ] 고정 허용 목록만 읽는 인증된 Edge 진단기를 작성·검사한다. DB/초안 변경 없음.
- [ ] 실제 Edge 환경의 응답과 로컬 조사 결과를 각각 저장한다.

### Task 2: 출처 어댑터 및 회귀 테스트
**Files:** supabase/functions/trend-collector/expansion.ts, expansion_test.ts, adapter.ts, runtime.ts, config/trend-collector.json, registry.json
**Interfaces:** discoverExpansion(source,html,url) → {rows,next}; extractExpansion(source,html,url,row) → Item-compatible result.
- [ ] 관찰 fixture로 목록·본문·게시일·범위·호스트 회귀 테스트를 먼저 작성하고 실패를 확인한다.
- [ ] 출처별 검증된 파서를 구현한다. 확장 출처만 라우팅하며 기존 9개 동작은 유지한다.
- [ ] Deno 전체 파서·런타임 검사와 Python 회귀 검사를 실행한다.

### Task 3: DB 등록·예약 연결 및 검증
**Files:** supabase/migrations/*_collector_source_expansion.sql, supabase/tests/collector_source_expansion.test.sql, docs/collector-source-expansion-20261028.md, docs/collector-daily-task.md
- [ ] 신규 등록과 3일 창 초기값·권한·기존 출처 보호 테스트를 먼저 작성한다.
- [ ] 검증 경로만 활성화하는 additive migration을 작성한다. 미검증 경로는 hold로 남긴다.
- [ ] 기존 일일/주간 예약의 고정 판본·대상 목록을 갱신한다. 새 예약 중복 생성 없음.
- [ ] DB와 Edge 실제 실행·중복·초안 연결을 검증한다. 검증 전 완료로 보고하지 않는다.
- [ ] 변경을 단일 PR로 제출하고 CI를 확인한다. 병합은 별도 사용자 지시 없이는 하지 않는다.
