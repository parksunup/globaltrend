# OECD 보도자료 추출 및 FTC 재개 크기 검증

저장소 코드의 수동 검증입니다. 운영 DB 변경·배포·예약 실행은 하지 않았습니다. 승인 호스트, 관련성 판정, 사람 승인 및 기간 전체 완료 gate를 변경하지 않았습니다.

## OECD

기존 discovery는 topic의 `/en/about/news/press-releases/` 링크를 발견하지만 상세 추출기는 보고서 제목과 Abstract/Introduction만 지원했습니다. 따라서 보도자료가 발견되면 `title_or_body_missing`으로 실패할 수 있었습니다.

2026-10-23 공식 호스트에서 `HttpClient.get`으로 robots 및 응답 상한을 적용하여 다음 페이지를 읽었습니다.

- URL 및 최종 URL: https://www.oecd.org/en/about/news/press-releases/2022/12/landmark-agreement-adopted-on-safeguarding-privacy-in-law-enforcement-and-national-security-data-access.html
- 응답: text/html, 1,461,791 bytes, SHA-256 `40202ccc70a7ab3bc212dd36f270fa28a1cff3fcd512ac5adbb13247bf1db9e5`
- 확인한 구조: `main [itemtype="https://schema.org/Article"]` 아래 `h1.cmp-article-header__title`, `.cmp-article-header__date time[itemprop="datePublished"]`, `[itemprop="articleBody"] .cmp-text`.
- 추출: 공식 제목, 표시·속성 날짜 일치 `2022-12-14`, 본문 4,461자. 이 표본은 현재 수집 기간 밖이며 신규 실적으로 세지 않습니다.
- 변경: 보도자료 경로에서만 관찰한 구조를 지원합니다. `read_scope=press_release_html_not_report`, `requires_review=true`, `ai_ready=false`와 연결 문서 `read=false`를 유지합니다. 날짜 충돌은 null로 보존하며 관련 보고서 전문 열람으로 표시하지 않습니다.

현재 topic https://www.oecd.org/en/topics/privacy-and-data-protection.html 은 text/html 1,514,535 bytes, SHA-256 `9319158668aa09599c78fcd285553e602f7efdf2b5dced1a6b3705ff43f134c5`였습니다. discovery 결과 6개는 모두 발간물이며 보도자료 링크는 0개이고 다음 페이지도 없습니다. 기존 topic의 보도자료 링크 발견 회귀검사는 유지하지만, 이 표본으로 전체 보도자료 목록 발견·최근 기간 누락 없음을 입증하지 않습니다. `/en/about/news/press-releases.html`을 별도 확인해도 정적 main에서 상세 보도자료 링크를 얻지 못했으므로 검증되지 않은 API/목록 전환을 추가하지 않았습니다.

## FTC

URL SHA-256 전체 집합을 cursor에 보존하는 기존 수정은 제목·순서 변경 후 반복을 막지만 집합이 커지면 `collector_set_progress`의 jsonb 텍스트 4,000byte 상한을 넘습니다. synthetic 65건 피드에서 수정 전 4,067byte cursor를 재현했습니다.

새 URL을 요청·추출·저장하기 전에 그 URL hash와 실패/날짜미확정 카운터 여유를 포함한 다음 cursor 크기를 검사합니다. 4,000byte 초과 시 `ftc_resume_cursor_capacity_exceeded`로 명시 실패하며 마지막 안전 cursor를 보존합니다. 기존 실패 backoff가 적용될 수 있는 상태이며, 새 자료를 요청하거나 ingest/backlog를 만들거나 hash를 잘라내지 않습니다. SHA-256 형식과 cursor 필드는 그대로입니다. 이 중단은 전체 수집 완료를 뜻하지 않습니다. 더 큰 피드의 완주는 별도 영속 진행 구조 없이는 해결되지 않습니다.

실제 설정 피드 https://www.ftc.gov/feeds/press-release-consumer-protection.xml 은 application/rss+xml, 150,829 bytes, SHA-256 `49d5ea65badbd763c54e763b674dd951c28edd930f0dab453f856615cf102c2d`였으며 30개 URL, next=null이었습니다. 실제 피드 상세 전체를 운영에 수집한 검증은 아닙니다.

## 검사

- OECD 보도자료 2건의 추출 실패와 FTC 65건의 cursor 초과를 먼저 재현한 뒤 수정했습니다.
- Python collector 100개 통과. 추가 5개: 보도자료 본문 범위·미열람 보존, 날짜 충돌, 다른 경로 템플릿 거부, 매 단계 제목/순서를 바꾸는 30건 완주, 65건 상한 중단과 다음 재개시 안전 cursor/무요청 보존.
- `npm test`: 137개 통과. 기존 Node MODULE_TYPELESS_PACKAGE_JSON 및 npm http-proxy 환경 경고가 출력됐습니다.
- `npm run validate:data`: 21건 통과. `git diff --check` 통과.
- SQL cursor validator 자체와 운영 RPC는 실행하지 않았습니다. 새 필드나 형식 변경은 없으며 4,000byte 상한 계약만 코드·회귀검사로 보존합니다.
