# 6개 출처용 별도 Scrapling 수집기

## 구축 범위

기존 Crawlee/Edge 수집기와 설정은 보존하고, 별도 Python CLI 수집기와 출처별 어댑터를 추가했습니다. Scrapling 0.4.11의 공개 `Fetcher` API를 고정 버전으로 사용하며, 사이트별 목록·상세 파서는 이 패키지에 분리되어 있습니다. 이 수집기는 Supabase/DB에 쓰지 않고 결과 JSON만 만듭니다.

| 출처 | 새 수집 경로 | 구현 상태 |
|---|---|---|
| OECD | 공식 WebCMS RSS API 두 경로를 우선 사용하는 대체 경로. PR #42의 HTML 경로는 별도 보조 파서로 유지 | 구축; 실시간 시험에서 RSS 두 요청 200, 해당 기간 관련 후보 0건 |
| CAC | 공식 목록에서 검증된 기사 경로를 찾고 상세 본문 파싱 | 구축; 본문 271자 공지를 그대로 보존하고 검토 필요 표시 |
| PCPD | ISD 날짜 아카이브를 요청한 날짜마다 순회 | 구축; 2026-01-27 하루 시험에서 목록·상세 200, 본문 4,982자, 그 하루의 범위 완료 |
| 베트남 정부 전자신문 | 공식 홈페이지/정책 목록과 타임라인을 읽고 상세 본문으로 관련성을 확인 | 구축; 본문 5,351자 표본 확보. 페이지 제한 때문에 날짜 범위 전체는 미완료 |
| FTC | 공식 privacy 검색 경로; robots에서 허용하지 않는 `items_per_page` 파라미터를 쓰지 않음 | 구축; 본문 5,715자 표본 확보. 목록 월과 상세 날짜가 달라 날짜를 비우고 충돌 검토 표시 |
| CalPrivacy | 공식 press-release 목록 및 관찰한 공식 다음 페이지를 따라 상세 파싱 | 구축; 본문 3,129자 표본 확보 |

이 표는 어댑터 구축 여부와 제한된 실시간 표본을 설명합니다. 전체 기간·목록을 전부 수집했다는 뜻은 아닙니다. OECD의 기존 977자 초록 사례는 PR #42의 Python `urllib.request` 경로였으며 Crawlee 실행으로 기록하지 않습니다. 현재 OECD 대체 RSS 경로는 요청 접근은 확인됐지만 2026-11-02~09 시험에서는 관련 기사가 없었습니다. 따라서 이 실행만으로 기간 내 OECD 기사 부재나 수집 범위의 완전성을 주장하지 않습니다.

## 공통 정책

- HTTPS와 어댑터별 호스트 허용 목록을 확인합니다. robots를 먼저 읽고 페이지 요청마다 허용 여부를 검사합니다.
- 사이트별 요청 간격은 최소 5초이며, robots `Crawl-delay`가 더 길면 더 긴 값을 적용합니다.
- 각 redirect hop의 호스트와 robots 정책을 다시 검사합니다. robots 응답 확인 뒤 첫 페이지 요청에도 최소 간격을 둡니다.
- 프록시, stealth 헤더, CAPTCHA 처리, 브라우저 세션을 사용하지 않습니다. 401/403/429는 해당 요청의 종료 응답으로 기록합니다.
- 출처 어댑터가 공식 페이지에 연결된 PDF URL을 명시하면 Scrapling으로 받은 PDF를 제한 크기·페이지 수 내에서 pypdf로 추출합니다. OCR은 하지 않으며 추출물은 검토 대상으로 둡니다.
- 본문이 짧은 공식 공지를 임의로 보충하지 않습니다. 모호한 날짜와 추출물은 검토 필요로 남깁니다.

## 실행 및 검증

저장소 루트에서:

```powershell
python -m venv .venv-scrapling
.\.venv-scrapling\Scripts\Activate.ps1
python -m pip install -r scripts/collector-scrapling/requirements.txt
python -m scripts.collector_scrapling.runner --source all --since 2026-11-09 --until 2026-11-09 --output work/scrapling-result.json
```

`--source`는 `oecd`, `cn-cac`, `hk-pcpd`, `vn-gov`, `ftc`, `calprivacy` 중 하나를 지정할 수 있습니다. `--max-pages`와 `--max-items`는 점검량을 제한하며, 제한 도달 시 결과는 부분 수집으로 표시됩니다.

별도 읽기 전용 시험 결과는 [OECD](evidence/scrapling-oecd-live-2026-11-09.json), [CAC](evidence/scrapling-cac-live-2026-11-09.json), [PCPD](evidence/scrapling-pcpd-live-2026-11-09.json), [베트남](evidence/scrapling-vn-live-2026-11-09.json), [FTC](evidence/scrapling-ftc-live-2026-11-09.json), [CalPrivacy](evidence/scrapling-calprivacy-live-2026-11-09.json)에 있습니다. 시험은 DB를 변경하지 않았습니다. 단위 테스트 33개가 통과했고 `git diff --check`도 통과했습니다.

이 작업은 별도 수집기 구축과 로컬 검증까지입니다. 운영 DB 기록, 클라우드 배포, 예약 실행, Codex 예약 작업을 통한 한국어 초안 작성, 작업실 게시까지의 자동 연결은 이 변경으로 활성화하지 않았습니다. 기존 수집기를 바꾸지 않고 별도 단계로 남겨뒀습니다.
