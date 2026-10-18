# 네 PR 통합본 검토·반영 안내

최신 main `44d8cda`에서 PR #15(법제), #16(동향), #30(화면), #32(수집기)를 하나의 브랜치에 모았습니다. 기준 커밋과 원본 130개 파일의 해시는 `source-manifest.json`에 있습니다. 원래 PR을 임의로 닫거나 main에 병합하지 않습니다.

## 화면에서 확인할 곳

| 주소 | 볼 수 있는 내용 |
|---|---|
| `/` | 기존 작업자 홈. 기본 진입점 유지 |
| `/team` | 제출된 법제·동향 자료와 기존 검토 보드. 열람에 로그인 불필요 |
| `/legal-translation` | 외국법 6개 한국어 번역 전문 초안. 기존 의견 작성 가능 |
| `/legal-drafts` | 119셀 전체 비교표·근거·GDPR 기존 HTML 번역 |
| `/work` | 동향 작성·수정·승인·발행, 수집기 검수. 쓰기에 팀 계정 필요 |
| `/work/legal` | 법제 판본 DB 등록·승인·발행. 팀 계정과 새 마이그레이션 필요 |
| `/work/legal/[id]` | 저장소가 나중에 바뀌어도 등록 당시 DB 판본의 번역·17개 셀 확인 |
| `/public` | 새 공개 화면. Preview에는 미검수 표본임을 표시 |
| `/public/search` | 표본 21건 검색·필터·상세 이동 |
| `/public/laws` | 7법제·17기준·119셀 비교와 전문 읽기 |
| `/public/weekly` | Preview에서는 주간 예시 7건. 운영에서는 발행된 주간호 준비 안내 |
| `/feedback` | 원래 법제/동향 브랜치의 의견과 이 통합 브랜치 의견을 선택해 조회 |

한국법은 공식 한국어 원문 **조문 색인**입니다. 외국법 6개는 선택 판본의 한국어 **전문 초안**입니다. 사람 검수가 끝났거나 관련 하위법령까지 모두 번역했다는 뜻이 아닙니다.

GDPR은 #15의 `data/legal/translations/gdpr.json`에는 없지만 `public/review-drafts/gdpr.html`에 자체 한국어 번역 본문이 있습니다. 기존 HTML의 1,123개 항목과 구조 색인을 `scripts/normalize-gdpr-export.py`로 `data/derived/gdpr.json`에 변환하여 공통 읽기 화면에 연결했습니다. 번역을 새로 생성하거나 제3자 PDF를 복사하지 않았습니다. HTML·색인의 해시, 99조·173개 고려사항과 미검수 상태를 검사합니다. 원래 파일은 보존합니다.

## 제출 자료가 공개 화면에 반영되는 방식

- Preview: 저장소의 최신 제출 자료를 읽고 초안 표시. 특정 브랜치 이름에 묶이지 않습니다.
- 운영 `/public`: Supabase에서 발행된 동향/법제만 읽습니다. 자료를 못 읽었다고 저장소 초안으로 대체하지 않습니다.
- 작업자 화면: 운영에서도 저장소 제출 자료를 계속 볼 수 있습니다. 팀원 열람을 허용한 `/team`·번역 검수·정적 검토 문서와 일반 독자용 `/public`의 용도를 구분합니다.
- 동향: 기존 `/work`의 초안→검수 대기→관리자 승인→발행을 유지합니다. PR16의 주간 선정 7건을 초안 입력에 사용하며 저장 자체로 발행하지 않습니다.
- 법제: `/work/legal`에서 국가별 전문·17개 비교셀을 고정 판본으로 등록합니다. 같은 내용은 중복 생성하지 않고 바뀐 내용은 새 판본이 됩니다. 관리자가 해당 DB 판본의 원문·번역·비교·이용조건을 확인해 승인한 뒤 발행합니다. 새 판본 발행 시 이전 판본은 구판으로 전환됩니다. 공개 자료는 이 DB 판본에서 읽습니다.
- 검수 피드백 저장은 승인·발행이 아닙니다. 기존 브랜치의 피드백은 삭제하거나 통합 브랜치로 옮기지 않습니다.

## DB 반영 순서

새 migration: `supabase/migrations/20261018081500_legal_review_publication.sql`.

현재 운영에는 #32의 수집기 DB 구조가 이미 적용돼 있고, 저장소와 migration 시간 식별자가 다릅니다. 조회한 운영 이력은 다음과 같습니다. 이 목록은 2026-10-18 조회 결과이며 실행 전 다시 대조해야 합니다.

| 저장소 migration | 같은 기능의 운영 이력 |
|---|---|
| `20261010015611_editorial_publication_pipeline` | `20261013022723_editorial_publication_pipeline` |
| `20261013021000_trend_collector_cloud` | `20261013022732_trend_collector_cloud` |
| `20261013023000_private_collector_review` | `20261013023058_private_collector_review` |

**운영에서 전체 `db push`를 바로 실행하지 않습니다.** 초기 schema/seed도 운영 이력에 같은 이름으로 기록돼 있지 않아 중복 적용 위험이 있습니다. 운영의 실제 테이블·함수 정의와 저장소를 대조하고 이력을 정리하거나, 적용되지 않은 새 법제 migration만 검토해 적용합니다. 과거 migration을 재실행하거나 운영 reset을 하지 않습니다. 이 PR 작업 중 운영 migration·자료 등록·공개 발행은 수행하지 않습니다.

법제 migration을 먼저 적용한 뒤 이 PR을 main에 병합합니다. 이후 운영 `/work/legal`에서 국가별로 등록·검수합니다. GitHub에 있는 미검수 초안을 일괄 발행하지 않습니다. Preview의 저장·승인·발행 버튼은 운영 DB 보호를 위해 비활성입니다.

## 수집기와 Codex

#32의 수집기와 `/work` 검수 연결을 포함합니다. 9개 출처의 활성·승인 스위치는 모두 꺼 두었습니다. 정기 실행도 기존 `SCHEDULE_ENABLED` 등 게이트를 유지하며 원격 값을 변경하지 않습니다. CI는 의도적인 보류(exit 2)를 정상적인 차단 결과로 확인하며 실제 수집 실패를 성공으로 바꾸지 않습니다.

구독 내 Codex 편집기는 `docs/trend-draft-worker.md`의 작업 가져오기→정확한 원문 판본 확인→한국어 초안→RPC 제출 계약을 사용합니다. 이 PR은 별도 AI API나 새로운 예약 Codex 작업을 만들지 않습니다. 실제 정기 운영을 시작하려면 Actions 자격 증명, 출처별 승인/UUID, 무료 한도, Codex 실행 연결을 확인해야 합니다. 주간 예시와 실제 주간호의 자동 편집·발행은 구분합니다.

## 검증 명령

```text
pnpm install --frozen-lockfile
pnpm test
pnpm validate:data
pnpm typecheck
pnpm build
python -m pip install -r scripts/collector/requirements.txt
python -m unittest discover -s tests -p 'test_collector*.py'
python scripts/verify-collector-dry-run.py
supabase db reset --local
supabase test db --local
```

DB reset 명령은 Docker의 **로컬 시험 DB 전용**입니다. 운영에서 실행하지 않습니다. 브라우저 검사는 `PLAYWRIGHT_MODULE`에 설치된 Playwright 모듈 경로를 설정한 뒤 `node scripts/check-public-local.mjs`로 실행합니다. 설치된 Edge를 쓰려면 `BROWSER_CHANNEL=msedge`를 설정합니다. 공개·작업자 경로, 6개 전문, 조문 검색·미리보기, 모바일 폭, 테마 전환을 확인합니다.

기본 첫 화면을 나중에 공개용으로 바꾸려면 서버 환경변수 `SITE_ENTRY=public`으로 전환합니다. 작업자 홈과 공개 화면을 오가는 경로는 유지합니다.
