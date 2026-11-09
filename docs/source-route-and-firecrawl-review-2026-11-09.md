# 기존 출처 경로와 Firecrawl 시험 검토

2026-11-09 기준의 코드·저장소 기록·제한된 실시간 시험을 합쳐 기록합니다. 여기서 “수집 성공”은 목록 발견, 상세 페이지 접근, 본문 확보, 날짜 판정, DB 반영을 구분합니다. 실시간 시험은 읽기 전용이며 DB에 쓰지 않았습니다.

## OECD 기존 실행

2026-10-22 클라우드 Python 실행은 OECD 목록에서 6개 항목을 살펴보고 첫 문서의 공식 초록 977자를 추출했습니다. 목록 날짜(2026-10-15)와 상세 HTML 날짜(2026-10-14)가 달라 날짜·초안 준비를 보류했고 ingest는 기존 자료와 중복으로 처리했습니다. 따라서 이는 OECD의 공식 초록을 읽은 실행이지, 새 자료를 전문으로 수집해 반영한 성공으로 볼 수 없습니다. 실행 기록은 요청 3회, 수신 3,014,114바이트로만 집계돼 있고 상세 URL별 접근 로그는 저장돼 있지 않습니다.

구현된 HTTP 경로는 `scripts/collector/core.py`의 Crawlee `HttpxHttpClient`입니다. 요청의 redirect는 끄고 응답을 받은 뒤 허용 호스트와 robots 규칙을 직접 점검하며, 고정 User-Agent와 crawl-delay를 사용합니다. 실행 기록상 이 클라우드 Python 경로는 기존 Edge 배포와 control git_sha를 바꾸지 않았습니다. 2026-10-21 Edge 경로는 같은 OECD 주제 목록에서 HTTP 403 및 “Just a moment…”를 기록했습니다. 로그로 확인되는 차이는 Edge의 `pg_net`와 Python의 Crawlee/HTTPX 실행 경로입니다. 다만 저장된 증거는 egress IP, 헤더, 라이브러리 가운데 무엇이 차이를 만들었는지 분리하지 않습니다.

파서는 `scripts/collector/parsers.py`의 OECD 전용 파서를 사용합니다. 일반 OECD 페이지의 추출 범위는 보고서 전문이 아니라 공식 Abstract이며, 보도자료 HTML도 보고서 전문과 별도로 표시합니다. 10월 22일 세 요청이 robots + 목록 + 상세 각 1회였다는 분해는 코드 흐름에 부합하지만, 요청별 로그가 없으므로 확정 사실로 취급하지 않습니다.

## PCPD·Vietnam 및 Scrapling 역할

| 출처 | 관찰된 결과 | 판정 |
|---|---|---|
| PCPD | 공식 ISD 날짜 아카이브가 HTTP 200. 2026-11-09 날짜 페이지에서 PCPD 관련 후보 0개 | 그 날짜 아카이브를 요청하고 읽는 경로는 작동했습니다. 해당 날짜에 PCPD 발표가 없었다는 뜻으로는 볼 수 있지만, 넓은 수집 기간 전체에 기사가 없었다는 결론은 아닙니다. 기간을 수집하려면 날짜별 아카이브를 순회해야 합니다. Scrapling은 페이지 전달 수단으로 쓸 수 있으나, 보도자료 존재 여부는 기간 범위 시험으로 확인해야 합니다. |
| Vietnam Government | 공식 홈페이지 HTTP 200, 27개 카드 발견, 시험의 제목 키워드 일치 0개 | 홈페이지 fetch가 됐다는 사실만 확인됐습니다. 해당 기간 전체에 기사가 없었다고 단정할 수 없습니다. 정책·타임라인 페이지와 본문-aware 관련성 판정까지 이어져야 합니다. 과거 검증 기록에는 2026-11-02 Decree 363 기사 4,309자가 있어, 단순 홈페이지 제목 필터만으로 부재 판정을 해서는 안 됩니다. Scrapling만으로 coverage가 해결되지는 않습니다. |
| CalPrivacy | Scrapling HTTP 200, 관련 후보와 상세 본문 2,494자 | 공개 페이지 수집 경로로 쓸 근거가 확인됐습니다. 기관 목록/전용 추출을 유지합니다. |
| FTC | robots 허용 조건을 확인한 검색 목록과 상세 페이지 접근 성공, 상세 본문 6,069자 | 기존 `items_per_page` 쿼리 값은 robots 제한을 피하지 못하므로 사용하지 않습니다. 5초 이상 간격을 지키고 허용 검색 URL을 쓰는 전제에서 Scrapling Fetcher 경로를 사용할 수 있습니다. FTC는 전면 차단으로 분류하지 않습니다. |

따라서 Scrapling은 CalPrivacy와 robots에 맞춘 FTC 경로에 바로 적용할 수 있습니다. PCPD와 Vietnam에는 전송 계층 후보로 둘 수 있지만, 각각 날짜 아카이브 순회와 주제 목록/타임라인 범위가 보강되기 전에는 수집 완료 또는 무기사 기간으로 처리하지 않습니다. 모든 페이지 접근은 기존 robots·host allowlist·최소 5초 간격 제한을 따릅니다.

## CAC 본문 길이와 전용 PDF 경로

| 출처 | 관찰된 본문/경로 | 판정 |
|---|---|---|
| CAC | 목록 HTTP 200, 후보 20개 중 관련 제목 14개. 샘플 기사 HTML/본문 HTTP 200, 271자. Scrapling과 Firecrawl 추출 결과가 같은 공지 내용을 보여줌 | 공지 자체가 제3차 인증 기관 21곳을 발표하고 목록 확인처를 안내하는 짧은 형식입니다. 현재 증거로는 parser truncation으로 보이지 않으며 첨부 목록이 발견되지 않았습니다. 271자를 전문 기사라고 보증하지는 않으며, 출처 DOM과 연결된 공식 첨부 여부를 확인하는 짧은 공지 전용 판정은 유지합니다. |
| PDPC | 기존 embedded-RSC 전용 파서로 7,616자 | 이미 있는 전용 파서를 계속 사용합니다. |
| PPC | 연결 공식 2페이지 PDF에서 1,221자 | 기사 HTML이 아니라 공식 PDF 추출 결과입니다. 짧은 공지일 수 있어 review 표식을 유지합니다. |
| TC260 | 기사 ID가 일치하는 공식 5페이지 PDF에서 2,767자 | 전용 PDF 파서로 추출하고 `requires_review`를 유지합니다. 일반 목록 프로브의 후보 선택 문제는 별도입니다. |
| EU Council | 공식 RSS 20개 요약, 과거 64–282자, 샘플 상세 403 | RSS만으로는 초안용 전문이 아닙니다. 공식 full-text 대체 페이지나 접근 가능한 공식 API/아카이브를 먼저 찾아야 합니다. 검증되지 않은 우회나 제목 요약을 전문으로 간주하지 않습니다. |

## Firecrawl Docker 시험

기존 저장소 코드와 첨부 인계 문서에서는 과거 Firecrawl 비교시험의 로그나 결과표를 찾지 못했습니다. 이번 PR의 앞선 소스별 작업은 요청하신 Scrapling 오픈소스 Fetcher 검증과 기관별 경로 개선에 집중돼 Firecrawl을 포함하지 않았습니다. 따라서 기술상 실행 불가라서 제외한 것은 아니며 시험 범위에서 빠진 것입니다. 사용자가 알려주신 과거 성능 결과를 재현할 필요가 있어, Firecrawl OSS를 별도 시험으로 추가했습니다.

GitHub Actions의 임시 Linux Docker runner에서 Firecrawl OSS `v2.11.0` 공식 Docker Compose를 빌드하고 로컬 `/v2/scrape` API를 띄웠습니다. 공개 Firecrawl API, stealth, 제3자 proxy, DB 기록은 사용하지 않았고, 각 출처 목록과 관련 상세 한 건까지만 요청했습니다. 스크립트는 각 URL의 robots 규칙, HTTPS, 카탈로그 호스트, 최소 5초 간격을 검사합니다. 원본 시험 JSON은 `docs/evidence/firecrawl-seven-source-2026-11-09-initial.json`에, EP/RIPD 선택 재시험 JSON은 `docs/evidence/firecrawl-seven-source-2026-11-09-followup.json`에 저장했습니다. 첫 실행은 작업 스크립트의 import 경로 문제로 원문 요청 전에 끝나 코드를 고쳤고, 다음 전체 실행과 두 출처 재시험은 완료됐습니다. Firecrawl의 공식 self-host 문서는 OSS 인스턴스에서 고급 차단 대응 Fire-engine을 제공하지 않는다고 설명합니다. 이 결과는 관리형 Firecrawl cloud 성능을 재현한 것으로 간주하지 않습니다.

첫 실시간 실행의 판독:

| 출처 | HTTP/후보 | 상세 결과 | 의미 |
|---|---|---|---|
| OECD | 목록 HTTP 403 | 상세 요청 없음 | Firecrawl OSS self-host 시험 runner에서 현재 목록 경로가 거부됐습니다. 이를 robots 거부라고 오인하지 않습니다. 기존 Crawlee 클라우드 Python의 공식 초록 성공과는 다른 실행 경로입니다. |
| EP | RSS 목록 HTTP 403 | 상세 요청 없음 | 첫 실행의 XML 파서 오류와 겹쳐 원인이 불분명했으나, 선택 재시험에서도 CDN 오류 본문과 HTTP 403이 재현됐습니다. 현재 증거상 접근 차단입니다. |
| RIPD | RSS 목록 HTTP 500 | 상세 요청 없음 | 첫 실행의 XML 파서 오류와 겹쳐 원인이 불분명했으나, 선택 재시험에서 AEPD 차단 안내와 HTTP 500이 재현됐습니다. 현재 증거상 접근 차단입니다. |
| CAC | 목록 HTTP 200, 20개 후보, 관련 후보 14개 | HTTP 200, 271자 | 발견과 짧은 본문 재현 성공. |
| PCPD | 해당 날짜 목록 HTTP 200, 0개 후보 | 상세 요청 없음 | 날짜 페이지 fetch와 무후보를 분리해 해석합니다. |
| Vietnam | 홈 HTTP 200, 27개 후보, 주제 일치 0개 | 상세 요청 없음 | 검색 범위/관련성 문제이지, 기간 내 기사 부재 증거가 아닙니다. |
| EU Council | RSS HTTP 200, 관련 제목 후보 1개 | 상세 HTTP 403, 본문은 “Verification successful…” 71자 | 현재 Firecrawl self-host 경로로 이 상세 원문을 읽지 못했습니다. 71자는 기사 전문이 아닙니다. |

**상태 분류 및 재현:** HTTP 403/500 응답을 파서에서 후보가 나오지 않았다는 뜻과 분리하도록 `access_denied`/`http_error` 상태를 기록합니다. EP/RIPD를 단독으로 다시 실행했을 때도 각 사이트의 접근 거부 응답을 받았으므로 현재는 Firecrawl fetch 경로의 제한으로 분류합니다. 첫 응답의 XML 파서 오류만으로 파서 문제라고 확정하지 않습니다. Firecrawl 한 번으로 7개 기관의 완전한 기간 수집을 입증하지 않으며, 목록 발견과 본문 확보를 따로 기록합니다.

## 증거 위치

- 원래 cloud Python/Edge 실행: `docs/cloud-runtime-operation-20261022.md`, `docs/cloud-runtime-operation-20261021.md`
- 기존 소스별 시험: `docs/scrapling-eight-source-probe.md`, `docs/source-route-status-2026-11-09.md`
- 짧은 본문 재검증: `docs/evidence/short-body-recheck-2026-11-09.json`, PPC/TC260 전용 parser live evidence
- Firecrawl 재현 workflow: `.github/workflows/firecrawl-source-probe.yml`
- Firecrawl 실행 코드: `scripts/firecrawl_probe.py`

