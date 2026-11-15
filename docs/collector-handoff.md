# 출처 수집기 작업 인수인계

작성일: 2026-11-09  
저장소: [parksunup/globaltrend](https://github.com/parksunup/globaltrend)  
작업 브랜치: `codex/source-collector-36`  
진행 중 PR: [#114 — Source collector: all requested sources](https://github.com/parksunup/globaltrend/pull/114)

## 지금 상태 한눈에 보기

이 브랜치에는 요청된 출처 36곳을 대상으로 하는 수집기 변경과 읽기 전용 점검 결과가 있습니다. 2026-11-09 전체 점검에서 **28곳은 목록 후보와 본문 표본을 얻었고, 8곳은 실패하거나 개인정보 관련 후보가 없는 상태**였습니다. 이 숫자는 한 항목씩 시험한 결과이지, 28곳 모두가 매일 완전하게 수집된다는 뜻은 아닙니다.

이번 점검은 Supabase에 쓰지 않았고, 공개 자료를 발행하거나 배포하지 않았습니다. 모든 출처의 페이지 넘김, 날짜 정확도, 개인정보 주제 적합성, 반복 실행 및 작업실 초안 전달은 아직 별도로 확인해야 합니다. PR #114는 열려 있으며 이 문서는 그 PR에 이어서 올립니다. **병합하지 마세요.**

대상 목록은 원래 확인한 19곳 + 추가 후보 12곳 + 후속 요청 5곳을 합친 36곳입니다. EUR-Lex는 사용자가 보류해 점검하지 않았고, RD Privacy Watch는 제외 요청에 따라 넣지 않았습니다. 두 항목을 36곳에 섞지 않았습니다.

## 다른 컴퓨터에서 이어서 작업하기

### 처음 저장소를 받는 경우

Git이 설치되어 있고 GitHub 저장소에 접근할 수 있는 계정으로 로그인되어 있어야 합니다. PowerShell에서 다음을 실행합니다.

```powershell
git clone https://github.com/parksunup/globaltrend.git
cd globaltrend
git fetch origin
git switch --track origin/codex/source-collector-36
```

이미 저장소를 받은 경우에는 저장소 폴더에서 아래처럼 같은 작업 브랜치로 전환합니다.

```powershell
git status --short --branch
git fetch origin
git switch codex/source-collector-36
git pull --ff-only
```

`git status`에 다른 사람의 수정사항이 보이면 지우거나 덮어쓰지 말고 먼저 내용을 보존합니다. 작업을 이어간 뒤에는 이 브랜치에 커밋하고 `git push`하면 PR #114에 변경이 추가됩니다. `main`에 직접 커밋하지 말고 PR을 병합하지 마세요.

### 전체 출처 읽기 전용 점검

Python 3.12 환경에서 실행합니다. 점검 도구는 저장소에 고정된 Crawlee와 Trafilatura를 사용합니다.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r scripts/collector-crawlee/requirements.txt
python -m scripts.catalog_probe --output work/source-catalog-probe.json
```

`work/source-catalog-probe.json`은 로컬 결과 파일입니다. GitHub Actions에서는 **Actions → Source catalog probe (read only) → Run workflow → source `all`**을 선택하면 동일한 전체 점검을 실행하고 JSON 결과를 artifact로 받을 수 있습니다. 한 출처를 지정할 때는 `--source <출처 ID>`를 사용합니다. 사용자 보류 출처는 도구가 요청 전에 제외합니다.

이 점검은 목록에서 표본 하나를 찾아 상세 본문을 추출하는 무쓰기 진단입니다. 데이터베이스에 자료를 넣지 않고, 출처를 운영 허용 상태로 바꾸지도 않습니다. 403/robots 차단을 우회하지 않습니다.

## 36개 출처의 최신 점검 결과

아래는 2026-11-09 전체 Crawlee + Trafilatura 우선 실행에서 관찰한 결과입니다. “추출”은 해당 실행에서 한 목록 경로와 한 표본 본문을 얻었다는 뜻입니다. 글자 수가 적거나 요약/RSS/PDF에 의존하는 경우도 표에 따로 표시했습니다. 전체 요청 URL, 응답, 후보, 추출 흔적, 시각 및 오류는 [원본 JSON 증거](evidence/source-catalog-probe-36-current-2026-11-09.json)에 보존되어 있습니다.

| ID / 출처 | 결과 | 실행에서 확인한 내용 | 판단 및 남은 확인 |
|---|---|---|---|
| `edpb` — 유럽 개인정보보호이사회 | 추출 | 목록 HTTP 200, 후보 16개; 본문 1,324자, Trafilatura; “EDPB helps kids stay safe online”, 날짜 후보 2026-11-04 | 표본 본문 추출. 전체 페이지 순회와 주간 범위 누락 여부는 미검증. |
| `oecd` — OECD 개인정보·데이터보호 | 실패 | 목록 요청에서 HTTP 403 | 이 주소·실행에서 확인된 응답입니다. 과거 공식 RSS 응답과 이번 페이지 실패는 별도 증거로 보존하며, 모든 OECD 경로가 불가하다는 뜻은 아닙니다. |
| `curia` — EU 사법재판소 | 추출 | 목록 HTTP 200, 후보 160개; 판결 보도자료 PDF 표본 6,594자, 어댑터 대체 추출; “Judgment of the Court in Case C-395/25 Orkla Care”, 2026-11-05 | 이번 표본은 판결 원문 자체가 아니라 판결 관련 보도자료 PDF입니다. 판결문 연결·전문과 목록 이어보기 확인 필요. |
| `cnil` — 프랑스 CNIL | 추출 | 목록 HTTP 200, 후보 25개; 본문 4,881자, Trafilatura; “Recherches internes : quelles sont les obligations pour les professionnels de santé ?”, 2026-11-06 | 표본 추출. 제목의 개인정보 주제 적합도와 목록 전체성은 별도 검토 필요. |
| `ico` — 영국 ICO (WiredGov 재게시) | 추출 | 목록 HTTP 200, 후보 1개; 본문 5,143자, Trafilatura; WiredGov 표본, 2026-11-05 | 재게시 경로 본문은 추출됐지만 WiredGov 경로의 재사용 조건 검토 및 과거·다음 페이지 범위는 미완료. 운영은 hold. |
| `dpc` — 아일랜드 DPC | 추출 | 목록 HTTP 200, 후보 5개; 본문 3,694자, Trafilatura; CHI 최종 결정 관련 글, 날짜 후보 2026-10-01 | 본문 표본은 있음. 게시 목록의 최신성·페이지 순회 확인 필요. |
| `pdpc` — 싱가포르 PDPC | 불충분한 본문 | 목록 HTTP 200, 후보 10개; 선택된 AI 도구 위험 안내의 본문은 20자만 추출, Trafilatura | 목록 접근은 확인됐으나 실질 본문 추출 성공으로 세면 안 됩니다. 본문 API/페이지 구조를 확인해야 합니다. |
| `ppc` — 일본 PPC | 불충분한 본문 | 목록 HTTP 200, 후보 12개; 2026년 연구회 공지 표본은 56자, Trafilatura | 짧은 티저 수준입니다. 별도 확인한 공식 PDF 경로가 있으나 이번 전체 표본 결과와 섞지 말고 연결·검증해야 합니다. |
| `ftc` — 미국 FTC | 실패 | 요청 전에 robots 정책 확인 단계에서 `robots_disallowed`; 목록 HTTP 요청 0회 | 이 실행은 네트워크 요청 전 중단됐습니다. 우회하지 않았습니다. 요청 가능한 공식 피드/API 등 적법한 대체 경로가 있는지 별도 확인해야 합니다. |
| `ec` — 유럽연합 집행위원회 | 추출 | 목록 HTTP 200, 후보 10개; 본문 6,847자, Trafilatura; 아테네 세금 포럼 연설 표본, 2026-11-06 | 표본 자체는 추출됐지만 개인정보와 무관한 항목입니다. 주제 필터가 실제 개인정보 동향을 선별하는지 확인해야 합니다. |
| `calprivacy` — 캘리포니아 CPPA | 실패 | 목록 요청 HTTP 403 | 현재 요청 경로의 결과입니다. 별도로 확인된 공식 카테고리·상세 경로의 응답과 구분해 재검증해야 합니다. |
| `oaic` — 호주 OAIC | 추출 | 목록 HTTP 200, 후보 10개; 본문 2,586자, Trafilatura; VIQ Solutions 조사 관련 글, 2026-11-04 | 표본 본문 추출. 기간 전체와 주제 필터는 미검증. |
| `ca-opc` — 캐나다 OPC | 추출 | RSS HTTP 200, 후보 10개; 본문 1,386자, Trafilatura; 스마트기기 개인정보 수집 프로젝트 관련 뉴스, 2026-11-06 | RSS 표본 추출. RSS는 반복 제목이 있어 항목 수와 고유 기사 수를 구분해야 하며, 과거 전체 범위는 미검증. |
| `hk-pcpd` — 홍콩 PCPD (정부 재게시) | 관련 후보 없음 | 날짜별 목록 HTTP 200, 후보 0개; 3일 시험 구간 | 접근 실패가 아니라 시험 기간 안에 개인정보 관련 후보를 찾지 못한 결과입니다. 기간 확장·대체 공식 아카이브 경로 확인 필요. |
| `eu-parliament` — 유럽의회 | 실패 | RSS/목록 요청 HTTP 403 | 현재 RSS 경로에서 응답을 받지 못했습니다. 다른 공식 경로는 별도 증거로 재검증해야 하며 접근 제한 우회는 하지 않습니다. |
| `eu-council` — EU 이사회 | 요약만 추출 | RSS HTTP 200, 후보 1개; 본문은 공식 RSS 설명 106자; 정상 RSS 항목이나 시험 표본은 개인정보 동향이 아닌 초청장, 2026-11-04 | 상세 링크는 별도 시도에서 403이 관찰됐습니다. 현 경로는 RSS 요약만 제공하며 전문 기사 수집으로 볼 수 없습니다. |
| `cn-cac` — 중국 CAC | 실패 | 목록 요청 HTTP 403 | 이번 공식 목록 요청 결과입니다. 이전 별도 검증의 200 응답과 구분하고, 적절한 공식 목록·허용 경로를 재확인해야 합니다. |
| `cn-tc260` — 중국 TC260 | 짧은 본문 | 목록 HTTP 200, 후보 10개; 본문 262자, Trafilatura; 국가표준 계획 통지, 날짜 후보 2026-10-13 | 접근 및 텍스트 추출은 됐으나 공지 본문 분량·첨부 유무를 확인해야 합니다. |
| `es-aepd` — 스페인 AEPD | 추출 | RSS HTTP 200, 후보 8개; 본문 4,470자, Trafilatura; 안전한 처리 환경 공동 가이드, 2026-11-05 | 표본 추출. 전체 RSS 보존 기간 및 다음 구간 확인 필요. |
| `edps` — EDPS (공식 Mastodon RSS) | RSS 본문 추출 | RSS HTTP 200, 후보 20개; 게시물 텍스트 895자, RSS 설명 추출; “Datapedia: Automated proctoring”, 2026-11-08 | 공식 RSS의 게시물 텍스트 표본입니다. RSS 보존 범위와 향후 증분 수집 확인 필요. |
| `anpd-br` — 브라질 ANPD | 추출 | 목록 HTTP 200, 후보 10개; 상세 4,421자, 어댑터 대체 추출; 국제 이전 협의 관련 글, 2026-11-06 | 상세 추출 성공. API의 페이지 수는 확인됐지만 끝까지 순회·커서 동작은 미검증. |
| `npc-ph` — 필리핀 NPC | RSS 전문 추출 | RSS HTTP 200, 후보 9개; `content:encoded` 본문 2,099자; 정부기관 정보 유출 보도에 관한 성명, 2026-11-06 | RSS에 포함된 전문을 추출했습니다. 상세 페이지는 403이라 요청하지 않았습니다. RSS만으로 날짜·본문이 충분한지 사람 검토 필요. |
| `jpdp-my` — 말레이시아 개인정보보호 감독관 | 공식 PDF 추출 | 목록 HTTP 200, 후보 11개; AI·개인정보보호 프레임워크 협의 PDF 본문 68,612자, Trafilatura 우선 후 pypdf 사용, 날짜 후보 2026-10-29 | 공식 PDF 표본 추출. 32쪽 문서가 포함된 사례이며 목록 이어보기·예약 수집은 미검증. |
| `g7-dpa` — G7 개인정보 감독기관 라운드테이블 | 추출 | 목록 HTTP 200, 후보 2개; 본문 6,809자, Trafilatura; 공동성명, 2026-07-08 | 본문 날짜는 수정일 후보일 수 있고 행사 자체 날짜는 2026-06-25/26으로 별도 기록돼 있습니다. 주간 반복 감시 경로는 미검증. |
| `nist` — 미국 NIST | 추출 | 목록 HTTP 200, 후보 25개(개인정보 관련 후보 2개); 본문 2,050자, Trafilatura; 프라이버시 보존 연합학습 테스트베드, 2026-10-29 | 표본 추출. 다음 페이지 및 관련 후보 필터의 정밀도 확인 필요. |
| `iapp` — IAPP | 추출 | 목록 HTTP 200, 후보 20개; 본문 10,340자, Trafilatura; 미국 정책 전망 기사, 2026-11-06 | 기사 본문 표본은 있으나 회원 전용 경계·사용 조건·다음 페이지를 확인해야 합니다. 현재 운영 설정은 hold. |
| `fpf` — Future of Privacy Forum | 추출 | 목록 HTTP 200, 후보 9개; 본문 11,086자, Trafilatura; AgeTech 관련 글, 2026-11-05 | 본문 추출 성공. 선택된 글의 개인정보 동향 적합성과 목록 이어보기는 별도 검토 필요. 현재 운영 설정 hold. |
| `gpa` — Global Privacy Assembly | 추출, 주제 과포함 우려 | 목록 HTTP 200, 후보 134개(개인정보 단어 필터 후보 133개); 본문 2,858자, Trafilatura, 2026-11-03 | 본문 표본은 있으나 용어 필터가 후보 대부분을 잡았습니다. 실제 관련성 정밀도를 확인해야 합니다. |
| `global-cbpr` — Global CBPR Forum | 공식 PDF 추출 | 목록 HTTP 200, 후보 12개; 공식 연차보고서·업무계획 PDF 본문 합계 7,031자, Trafilatura 시도 후 pypdf; 뉴스 게시일 2026-06-10 | PDF 텍스트 추출 성공. 문서 표지일과 뉴스 게시일은 다릅니다. 페이지 전체와 연속 수집은 미검증. |
| `ripd` — 이베로아메리카 개인정보 네트워크 | 실패 | 공식 RSS 요청 HTTP 503 | 일시 오류 가능성이 있습니다. 별도 이전 200 응답은 최신 실패와 분리해 기록했으므로 재시도 후 결과 비교가 필요합니다. |
| `iso-iec-sc27` — ISO/IEC JTC 1/SC 27 | 공식 PDF 추출 | 목록 HTTP 200, PDF 후보 1개; pypdf 본문 2,081자 | 페이지에는 2025-05 표기가 있고 문서명에는 2023-09 표준이 언급됩니다. 게시일과 표준 발행일을 혼동하지 않도록 원문 메타데이터 확인 필요. |
| `noyb` — noyb | 추출 | 목록 HTTP 200, 후보 12개; 본문 2,444자, Trafilatura; Fnac Darty 과징금 관련 글, 2026-10-29 | 표본 추출 성공. 전체 목록·날짜 및 반복 수집 동작 미검증. 현재 운영 설정 hold. |
| `nl-ap` — 네덜란드 AP | 추출 | 공식 RSS HTTP 200, 후보 10개; 본문 944자, Trafilatura; 집행정책 게시, 2026-10-30 | RSS에서 상세 주소를 찾고 robots 허용 여부를 확인한 뒤 본문을 추출했습니다. 접근은 확인됐지만 별도 이용조건 검토가 없어 runtime은 hold. |
| `vn-gov` — 베트남 정부 전자신문 | 관련 후보 없음 | 정책 목록과 홈페이지가 각각 HTTP 200; 후보 4개와 28개, 개인정보 필터 통과 0개 | 요청 경로에 접근은 됐으나 자동 후보 선별 결과가 없습니다. 본문 상세는 이번 실행에서 요청하지 않았습니다. 과거 별도 Decree 363 표본은 이번 결과를 대체하지 않습니다. |
| `freevacy` — Freevacy Privacy Newsfeed | 추출 | 목록 HTTP 200, 후보 72개; 본문 2,793자, Trafilatura; AI 에이전트 관련 법안 재게시 뉴스, 2026-11-05 | 집계·재게시 매체의 표본입니다. 원보도와 재게시문 일치 여부 및 출처 귀속을 유지해야 하며 전문이라고 단정하지 않습니다. |
| `overview-legal` — overview.legal | 추출 | 개별 글 목록 HTTP 200, 후보 29개; 본문 35,499자, Trafilatura; NSA의 직원 Facebook 메시지 사용 관련 글, 2026-05-28 | 긴 개별 글 표본을 얻었습니다. 집계 페이지와 개별 글을 구분하고 날짜 없는 글의 날짜를 추정하지 않으며, 전체 페이지·재사용 조건을 점검해야 합니다. |

### 8개 실패 또는 빈 후보 결과를 다음 사람이 이어서 확인할 순서

1. `oecd`: 403이 난 현재 페이지와 이전 RSS 경로를 분리해 다시 확인하고, RSS에서 실제 개인정보 관련 항목을 찾은 뒤 연결 문서까지 확인합니다.
2. `ftc`: 현재 탐색 URL이 robots 사전 판정에서 멈췄습니다. 공개 RSS/API 등 명시적으로 접근 가능한 공식 경로를 찾고 동일한 읽기 전용 점검으로 확인합니다. 차단을 우회하지 않습니다.
3. `calprivacy`: 현재 목록 403과 별도로 관찰된 공식 카테고리·상세 200을 각각 다시 요청해 어느 주소에서 막히는지 재현합니다.
4. `hk-pcpd`: 요청 기간 3일을 더 넓혀 공식 날짜별 아카이브를 순회하고, 기간별 후보 수를 기록합니다.
5. `eu-parliament`: 현재 RSS 403을 재현하고 다른 공식 뉴스 목록·RSS 대체 주소를 구별해 확인합니다.
6. `cn-cac`: 공식 개인정보 목록의 403을 재확인하고, 다른 공식 경로에 접근된 이전 결과가 최신 RSS/목록 경로와 일치하는지 대조합니다.
7. `ripd`: 503 재시도 결과와 이전 200 결과를 비교하고, 공식 RSS 항목·다음 구간을 확인합니다.
8. `vn-gov`: 200 응답만 확인된 정책 목록과 홈페이지에서 후보 선별이 0건인 이유를 확인합니다. 베트남어 용어·분류 또는 별도 공식 뉴스 경로를 조사하되 현재 경로가 검증됐다고 과장하지 않습니다.

## 코드와 증거를 찾는 곳

- 전체 목록·제외 기준: [`docs/collector-complete-source-scope.md`](collector-complete-source-scope.md)
- 최신 36곳 읽기 결과: [`docs/source-catalog-probe-36-current-2026-11-09.md`](source-catalog-probe-36-current-2026-11-09.md)
- 원본 증거(JSON): [`docs/evidence/source-catalog-probe-36-current-2026-11-09.json`](evidence/source-catalog-probe-36-current-2026-11-09.json)
- 출처별 상세 경로·운영 hold 메모: [`docs/source-route-status-2026-11-09.md`](source-route-status-2026-11-09.md)
- 출처 설정: [`config/trend-source-catalog.json`](../config/trend-source-catalog.json)
- 읽기 전용 카탈로그 probe: [`scripts/catalog_probe.py`](../scripts/catalog_probe.py)
- Crawlee/Trafilatura 고정 의존성: [`scripts/collector-crawlee/requirements.txt`](../scripts/collector-crawlee/requirements.txt)
- Python 작업자 및 쓰기 파이프라인: [`scripts/collector/`](../scripts/collector/)
- cloud Python worker 안내: [`docs/collector-cloud-worker.md`](collector-cloud-worker.md)
- probe 수동 실행 workflow: [`.github/workflows/source-catalog-probe.yml`](../.github/workflows/source-catalog-probe.yml)

## 다음 작업의 완료 기준

각 출처마다 목록이 실제로 최신 게시물을 놓치지 않는지, 날짜가 목록/상세/RSS/PDF 중 무엇에서 왔는지, 표본 본문이 제목에 해당하는 전문인지, 페이지 넘김·RSS 보존구간·API 커서가 끝까지 이어지는지 확인합니다. 성공한 HTTP 응답이나 긴 본문만으로 개인정보 주제 적합성을 판단하지 않습니다. 403, robots 차단, 503, 파서가 후보를 찾지 못한 상태를 서로 다른 오류로 기록하고 같은 출처를 누락 없이 재검증합니다.

출처 하나를 운영 수집에 넣으려면 별도로 어댑터·기간/이어보기·중복 방지·재시도/커서·작업실 초안 전달과 해당 출처의 이용조건 검토가 필요합니다. 이 PR의 36곳 probe 결과는 그 운영 승인을 대신하지 않습니다. 운영 Supabase 변경, 신규 출처 승인, 발행, PR 병합 및 배포는 이 인수인계 범위에 포함하지 않습니다.
