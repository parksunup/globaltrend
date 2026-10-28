# 게시일 미확정 자료 감사 (2026-10-28)

기존 Supabase `emlgwhkgaihhrirhdpnp`의 `source_items.published_at IS NULL`을 고유 `source_items.id`로 다시 세었습니다. 9개 승인 출처의 저장 자료 218건 중 **13건**입니다(ICO 10, DPC 1, PDPC 2). 13건 모두 `pipeline_status=ignored`, 초안 선점 가능 작업 0건, 연결 보고서 0건입니다. 과거 Edge `state.unknown_dates`는 누적 관찰 횟수여서 이 건수와 같지 않습니다. 기존 `historical_resolution`은 원문과 날짜를 추측하지 않기 위해 유지합니다.

| 출처 | source_item_id | 원문 주소의 끝부분 | 현재 근거와 처리 |
| --- | --- | --- | --- |
| DPC | `f10d5e84-e167-4edb-8cea-197e5dd07982` | `podcasts/know-your-data-brexit-and-data-protection` | 삭제된 페이지 안내로 연결됩니다. 원래 방송일/기사 게시일 없음. |
| ICO | `2dbdb1f6-9b84-4465-b3ea-0e788d0fd583` | `2024/01/enterprise-data-strategy-consultation` | 새 상담 페이지의 시작일은 원래 기사 게시일 증거가 아닙니다. |
| ICO | `d6c8c066-065a-4f2d-aa6f-c74939bd41a2` | `2024/02/sharing-information-to-safeguard-children-marketing-materials` | 날짜 없는 최신 안내로 대체됐습니다. |
| ICO | `bc16c1c5-4ffe-4ea0-951a-cd9871b6642d` | `2024/02/tech-horizons-ii-report` | 보고서 내용은 남지만 원래 뉴스의 발표 날짜 증거가 없습니다. |
| ICO | `36cddc15-8974-4c9b-a1ca-d53bd90d0049` | `2024/07/annual-report-2023-24-published` | 매년 갱신되는 연례보고서 목록으로 대체됐습니다. |
| ICO | `4c7dda0e-59b0-455c-a5d4-7fa5b65cac2a` | `2024/11/make-a-complaint-about-how-an-organisation-has-used-your-personal-data` | 날짜 없는 일반 안내로 대체됐습니다. |
| ICO | `3f664d94-b700-40ad-8b25-bf22b6cdca97` | `2026/07/exploring-public-views-on-neurotechnology-and-data` | 다른 연구 소개 페이지로 대체됐습니다. |
| ICO | `d12f0621-592a-4cd1-bc71-8a29c593444b` | `2026/07/ico-consultation-on-the-corporate-strategy` | 상담 시작일은 기사 게시일과 다릅니다. |
| ICO | `a800d02d-000c-4631-8853-9c63286d458e` | `2026/07/information-commissioners-annual-report-202526` | 연례보고서 현재 목록으로 대체됐습니다. |
| ICO | `4ba32dba-7232-4ad6-9fe7-c8cb8bafd494` | `2026/09/switched-on-to-privacy` | 현재 체크리스트에 원래 뉴스의 날짜가 없습니다. |
| ICO | `1096e255-4ae5-4ff9-ad51-deaa6720edf3` | `2026/10/guidance-if-youre-worried-an-organisation-hasn-t-kept-your-information-safe` | 다른 안내로 대체됐습니다. ICO 홈페이지의 10월 6일 링크 날짜와 현재 안내의 8월 20일 갱신일을 원래 URL의 게시일로 혼합하지 않습니다. |
| PDPC | `a36b979c-9439-446e-9142-67d56737ab20` | `assets/25e68133-795e-4c3f-bbea-7456b01c8506` | PDF 본문은 있으나 목록의 `11 Apr 2025`는 후보 날짜이고 PDF 생성일도 게시일이 아닙니다. |
| PDPC | `4b91e925-e5b2-4df4-a6d3-104aca2b6b94` | `media-events/singapore-data-festival-2026` | 행사 페이지이며 기사 본문과 발표일이 없습니다. |

## 해결 기준

1. **현재 13건:** 원래 자료와 같은 제목·발표를 가리키는 공식 보도자료 목록, 원문 보존본 또는 문서 첫머리의 명시적 게시일을 확인한 건만 날짜와 근거를 새 revision에 기록합니다. URL의 연월, DB 발견 시각, 행사일·상담 시작일·PDF 생성일을 게시일로 대체하지 않습니다. 일치하는 증거가 없거나 원래 문서가 사라진 건은 보류를 유지하며 주간호에 넣지 않습니다.
2. **앞으로 수집:** 원문 URL이 다른 경로로 이동하면 새 안내문을 옛 기사로 저장하지 않습니다. ICO는 공식 게시일 필드, DPC는 명확한 기사/목록 날짜, PDPC PDF는 실제 발표일 증거를 따로 검사하고 서로 다른 의미의 날짜는 후보로만 기록합니다. 행사 카드와 빈 본문은 기사로 제출하지 않습니다.
3. **DB 이중 차단:** `claim_trend_draft_jobs`는 `published_at IS NOT NULL`을 요구합니다. 선점 전에 잘못된 `ai_ready=true`가 들어와도 날짜 없는 작업은 잡히지 않습니다. 이미 선점한 작업도 자동 보고서 INSERT 트리거가 같은 조건으로 차단합니다. 사람의 기존 보고서 편집이나 날짜가 확인된 초안에는 적용하지 않습니다.
4. **별도 재검토:** 역사 자료를 나중에 수집할 때 이 13건을 근거 URL·문서 종류·게시일 증거·확정/불명으로 한 건씩 재검토합니다. 재검토만으로 `ai_ready`를 변경하지 않고, 날짜가 확정되더라도 본문·중복·사람 검수 조건을 별도로 충족해야 합니다.
