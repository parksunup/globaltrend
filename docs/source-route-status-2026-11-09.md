# 출처 37곳 등록부와 36개 요청 출처 경로 점검표 (2026-11-09)

이 등록부는 전체 37개 ID를 보존합니다. 이번 경로 검증 대상은 사용자가 보류한 EUR-Lex를 제외한 36개입니다. EUR-Lex는 이 작업의 수집 요청 대상이 아니며 재요청하지 않았습니다. 확인 결과가 좋지 않은 항목도 목록에서 제외하지 않았습니다.

## 읽는 방법

- 첫 **일반 37-ID probe**는 진단용 원본일 뿐입니다. 자동 실행 중 EUR-Lex도 요청된 사실이 확인되어 해당 요청은 의도하지 않은 시도로 분류하며, EUR-Lex 결과는 양성 증거로 쓰지 않습니다. 이 실행은 일반 목록·상세 경로만 사용해 RSS/PDF/공식 재게시와 일치하지 않은 표본이 있습니다.
- 위의 출처별 경로 메모 중 일부는 이전 probe와 별도 route 확인 기록입니다. 최신 전체 결과는 [36개 출처 최신 Crawlee probe](source-catalog-probe-36-current-2026-11-09.md)와 그 [원본 JSON](evidence/source-catalog-probe-36-current-2026-11-09.json)을 기준으로 봅니다. 최신 전체 실행은 36개 중 28개에서 목록·본문 표본을 추출했고 8개는 실패했습니다. 이 결과도 표본 smoke test이므로 페이지 전체 수집·주제 적합성·운영 준비를 증명하지 않습니다.
- **보완 증거**는 별도 재검증에서 확인한 더 적합한 공식 경로입니다. 전수 probe가 실패했거나 다른 페이지를 골랐는데 보완 경로가 검증된 경우 두 결과를 함께 적었습니다.
- 본문 글자 수가 길거나 HTTP 200인 것만으로 주제 관련성, 날짜, 전체 페이지 이어보기, 운영 준비가 검증된 것은 아닙니다.
- `작업실 경로`는 저장소 설정상 수집 실행자입니다. 운영 Supabase에 새 마이그레이션을 적용했거나 실제 예약 실행까지 확인했다는 뜻은 아닙니다.
- `terms_reviewed_at`은 현재 수집 파이프라인의 승인 게이트가 확인하는 검토 이력 표시입니다. 이용약관이나 라이선스가 수집을 허용한다는 판정과 같지 않습니다. 이 문서에서 별도 이용 조건이 확인되지 않은 곳은 그렇게 표시합니다.

현재 설정상 37개 중 enabled/hold 개수는 설정 파일을 기준으로 관리합니다. 이는 이 브랜치 설정값이며 운영 배포·예약 실행을 뜻하지 않습니다. 이번 요청 범위 36개 중 실제 경로가 실패하거나 보류된 항목, 본문·주제·기간 전체 수집이 미검증인 항목을 표에서 분리했습니다.

## 37개 출처 결과

| ID / 출처 | 시도한 목록 경로와 최신 목록 결과 | 상세 본문·날짜 증거 | 이어보기·범위 | 작업실 실행 경로와 현재 판정 |
|---|---|---|---|---|
| `edpb` 유럽 개인정보보호이사회 | `https://www.edpb.europa.eu/news_en?page=1` — 200, 107,452B, 기사 카드 16개 및 `<time datetime>` 16개. `?page=0..12`와 다음 페이지 링크 관찰. 공식 RSS `/feed/news_en`은 503 | 일반 추출 1,319자에는 breadcrumb/소개만 포함; 각 카드에 제목·날짜·링크 있음 | 다음 주소 `?page=2` 확인; 13쪽 전체 순회 검증 전 | 현재 Edge 일반 파서는 카드 16개를 기사 목록으로 읽지 못함. HTTP 200만으로 수집 성공이라 하지 않음 |
| `oecd` OECD | 개인정보 주제 경로 403. 공식 API RSS는 200, 프랑스어 보도자료 15건 | RSS 요약 144–352자, 개인정보 관련 용어 0건; 표본 링크 상세 403 | 다음 구간 없음; privacy 기사 수집 경로로 검증되지 않음 | Edge 설정은 활성이나 실질 privacy 기사를 확인하지 못함. 차단 우회는 하지 않음 |
| `curia` EU 사법재판소 | 공식 보도자료 목록 200, 160개 후보. Media Centre가 제공한 RSS 링크는 200 HTML/7,881B, RSS 항목 0 | 판결 보도자료 PDF 표본 6,594자; 게시일 2026-11-05 | 목록 다음 페이지 확인 안 됨 | Edge 활성. PDF 표본 경로는 있으나 전체 이어보기는 미검증 |
| `cnil` 프랑스 CNIL | `https://www.cnil.fr/fr/actualites` — 200, 25개 후보 | 상세 HTML 4,881자; 게시 후보일 2026-11-06 | 전체 페이지 완료 미확인 | Edge 설정 활성. 표본 성공, 전체 이어보기·검수 필요 |
| `ico` 영국 ICO | WiredGov 최신목록 `https://www.wired-gov.net/wg/home.nsf/nav/latest+news?open&id=BDEX-6ZFKSH` — 200, 197,807B, 204개 anchor; `a.link-past-week`의 채널명이 Information Commissioner’s Office인 항목만 선별 | ICO 재게시 상세 200, 37,222B; Trafilatura 5,257자, 제목·날짜 일치(2026-11-05) | 최근 영업일 약 5일의 교차기관 목록; 다음 페이지 없음. 과거 전체성 없음 | Route 코드와 테스트는 추가됨. 접근정책 검토 전 config/DB hold; `coverage_complete=false` |
| `dpc` 아일랜드 DPC | `https://www.dataprotection.ie/en/news-media/latest-news` — 200, 5개 후보 | 상세 HTML 3,694자; 게시 후보일 2026-10-01 | 전체 페이지 완료 미확인 | Edge 설정 활성. 표본 성공이나 최신 후보 여부·이어보기 점검 필요 |
| `pdpc` 싱가포르 PDPC | 최신 전체 probe: 공식 목록/API 200, 후보 10개 | 선택된 상세 페이지에서 Trafilatura가 20자만 추출. 제목은 “Advisory for Data Protection Risks When Using Unauthorised AI Tools For the Development of Software or Scripts”; 전문 추출 성공으로 볼 수 없음 | 이번 실행은 상세 표본 1건만 확인; API 전체 페이지 순회는 미검증 | 목록 접근은 확인됐지만 본문 추출은 미완성. 이전 약 295자 상세 표본은 최신 전체 probe로 대체됨 |
| `ppc` 일본 PPC | 최신 전체 probe: 2026 archive 목록 200, 후보 12개; 선택 표본 게시일 후보 2026-10-28 | 선택된 상세 페이지는 Trafilatura 56자. 별도로 확인한 공식 PDF 첨부 21쪽 추출 경로는 이전 경로 검증 결과이며 이번 전체 probe 표본에는 적용되지 않음 | 최신 실행은 목록·상세 표본만 확인; 연 archive 월 탐색과 전체 이어보기는 미검증 | 이번 표본은 짧아 본문 수집 성공으로 보기에 부족함. PDF 경로와 최신 probe 결과를 서로 다른 증거로 유지 |
| `ftc` 미국 FTC | 공식 `search.ftc.gov` 검색+소비자보호 필터 URL을 production Crawlee가 robots 사전 확인에서 `robots_disallowed`로 판정; 목록 HTTP 요청 0회 | 이전 별도 읽기 전용 확인에서 개인정보 관련 Hims & Hers 상세 200, 2026-07-29였으나, 현재 수집 실행은 robots 차단 때문에 목록을 요청하지 않음 | 새 필터 조합의 이어보기는 미확인 | 코드·route는 보존했지만 config/DB를 hold로 둠. 다른 주소로 우회하지 않음 |
| `ec` 유럽연합 집행위원회 | 공식 Press Corner JSON API 200, 10개 후보와 다음 페이지 정보. `SPEECH/26/2370` JSON 상세도 200 | JSON 9,495B에 제목·`htmlContent`·`publishDate`·`eventDate`; HTML shell 본문 0자 | API 종료까지 실제 순회 미검증 | Cloud Python source-specific API 어댑터 및 테스트 있음; 예약 worker 실행은 별도 |
| `calprivacy` 캘리포니아 CPPA | 공식 press-release category와 `/page/2/` 링크는 별도 재확인에서 200; 현재 route-specific Crawlee 실행은 목록 403 | 별도 공식 상세 표본은 200; 현재 실행에서는 상세 요청 전 단계에서 실패 | page 2 존재는 확인했지만 전 구간은 미검증 | 현행 category 코드는 연결, 현재 403을 기록. 예전 announcements는 2026-01-12까지인 역사자료라 현행 대체로 보지 않음 |
| `oaic` 호주 OAIC | `https://www.oaic.gov.au/news/media-centre` — 200, 10개 후보 | 상세 HTML 2,586자; 게시 후보일 2026-11-04 | 전체 페이지 완료 미확인 | Edge 설정 활성. 표본 성공, 주제·이어보기 검수 필요 |

## 신규 경로 5곳의 별도 접근·재사용 검토

robots.txt에서 경로가 허용되는지와 저작물의 번역·요약·재게시가 허용되는지는 별개의 문제입니다. 다음 결과는 법률 자문이나 포괄적 이용 허가 판단이 아닙니다.

| 출처 | 확인된 이용조건 | 현재 조치 |
|---|---|---|
| ICO / WiredGov 재게시 | ICO 자료에는 OGL v3 표시가 확인됐지만, WiredGov 재게시 화면 자체의 권리 표시와 재사용 조건은 확인되지 않았습니다. | ICO 자료의 라이선스와 WiredGov 목록·페이지 권리를 분리 확인할 때까지 hold |
| 홍콩 PCPD / ISD | ISD 이용조건은 개인·교육 목적의 정확한 원문 재사용을 허용하는 것으로 확인됐으며, 번역 또는 공개 웹 요약을 허가한다고 명시하지 않습니다. | 허용 범위가 확인될 때까지 hold |
| G7 / Canada OPC | OPC는 비상업적 재생산을 허용하지만, 공동 G7 문서에 제3자 권리가 포함되는지는 별도 확인되지 않았습니다. | 공동 문서 권리 범위가 확인될 때까지 hold |
| 베트남 정부 전자신문 | 페이지에 저작권 보유 및 모든 권리 유보 표시가 있으며, 별도의 재사용 허가는 찾지 못했습니다. | hold; 경로·본문 검증은 유지 |
| EU 이사회 | 이사회 저작권 안내는 출처 표시를 조건으로 복제를 허용하며 비상업적 이용 제한을 별도로 두지 않지만, 개별 문서의 제3자 콘텐츠는 예외입니다. | 일반 안내와 문서별 예외를 반영한 승인 기준이 정리될 때까지 hold |
| `ca-opc` 캐나다 OPC | 공식 뉴스 RSS 200, 667 XML 항목; 639개 고유 제목·667개 링크(제목 반복 존재) | 상세 표본 1,386자, pubDate 2026-11-06 | feed 날짜 범위 2013-10-09~2026-11-06; 과거 이어보기·중복 제목 의미 미검증 | Edge 활성. 항목 수를 고유 기사 수와 혼동하지 않음 |
| `hk-pcpd` 홍콩 PCPD | ISD 날짜 archive. 2026-01-27 archive는 200, 15,627B, 53개 링크; PCPD·HKMA 공동발표 상세 200, 18,418B, Trafilatura 4,913자, 날짜 2026-01-27 | 기간 내 PCPD/개인정보 관련 제목만 상세 후보로 남김. 일반 RSS는 100건 rolling feed이며 관찰 시 PCPD 언급이 없음 | collector가 요청 구간 `until`부터 `since`까지 날짜별 목록을 순회하도록 연결; 테스트에서 3일 archive를 모두 요청함. 과거 전체 재게시 범위는 미확인 | 경로·날짜 순회 테스트 통과; source 설정은 정책 검토 hold. 운영 DB/예약 실행 검증 아님 |
| `eu-parliament` 유럽의회 | RSS 재검증은 현재 403 (과거 200, 20개였던 실행 이력과 구분) | 현재 RSS 표본 상세를 가져오지 못함 | 이번 응답에서 이어보기 미검증 | Cloud Python 설정 활성이나 현재 공식 RSS 요청 실패 |
| `eu-council` EU 이사회 | 공식 RSS `https://www.consilium.europa.eu/en/rss/pressreleases.ashx` — 200 XML, 14,640B, 20개 항목, 날짜·64–282자 요약 포함. 현재 최신 20개 중 개인정보 관련 후보 0 | 한 상세 URL은 403. 운영 adapter는 개인정보 관련 RSS 요약만 저장하고 상세 URL을 요청하지 않음 | 20개 rolling window, 다음 페이지 링크 없음; 과거 자료 전체성 미확인 | summary-only route 코드·테스트는 추가됨. 접근정책 검토 전 config/DB hold; 전문 수집 아님 |
| `cn-cac` 중국 CAC | 공식 개인정보 목록은 별도 검사에서 200, 2026년 항목 20개; 현재 같은 Crawlee 경로는 403 | 목록을 현재 받아오지 못해 상세 표본을 실행하지 않음. 이전 관찰된 상세 형식과 선택자는 유지 | `_2.htm` 경로는 404였으므로 페이지 2를 만들지 않음; 범위 미검증 | catalog/config/runtime을 검증된 개인정보 목록 URL로 정렬. 최근 403은 그대로 기록하고 우회하지 않음 |
| `cn-tc260` 중국 TC260 | `https://www.tc260.org.cn/tc260/tzgg/list.shtml` — 200, 10개 후보 | 상세 HTML 262자; 날짜 2026-10-13, 짧아 본문 품질 검토 필요 | 전체 페이지 미확인 | Edge 설정 활성. 접근 성공, 본문 표본은 짧음 |
| `es-aepd` 스페인 AEPD | 공식 RSS 200, 고유 item 25개 | 상세 4,470자, pubDate와 상세 날짜 2026-11-05 일치 | latest-25 창, 이어보기 없음 | Edge 활성; 과거 전체 coverage 미검증 |
| `edps` 유럽 데이터보호 감독기구 | 공식 Mastodon RSS `https://social.edps.europa.eu/@EDPS.rss` — 200, 20개 항목 | 전체 RSS 게시물 텍스트 895자; RSS 날짜 후보 2026-11-08 | RSS 다음 구간·보존 기간은 미확인 | Cloud Python 활성. RSS 본문 경로 성공, 사람 검토 필요 |
| `anpd-br` 브라질 ANPD | 공식 Plone JSON API page=2 200, 10행, `items_total=694`; 다음 b_start=20, 마지막 690 | 상세 JSON 8,672자, 제목 일치; 목록 `effective` 날짜 2026-10-28 표본 | 69페이지 continuation 정보; 끝까지 실제 순회 미검증 | Cloud Python adapter. robots 허용, 이용조건 페이지 404는 허가가 아님 |
| `npc-ph` 필리핀 NPC | 공식 RSS `https://privacy.gov.ph/feed/` — 200, 9개 항목 | `content:encoded` 전체 본문 2,099–9,378자; 예시 2,099자; 원 pubDate 2026-11-06을 서울 날짜로 정규화. 링크 HTML은 403이어서 요청하지 않음 | feed에서 다음 페이지 없음; 롤링 기간 전체성 미검증 | Cloud Python 설정 활성. 상세 링크 우회 없이 RSS 원문 활용; 초안 사람 검토 필요 |
| `jpdp-my` 말레이시아 감독기관 | `https://www.pdp.gov.my/en/main-page/` — 200, 11개 후보 | production PDF 경로에서 Trafilatura를 먼저 시도한 뒤 승인된 공식 PDF 32쪽을 pypdf로 추출, 68,612자. 목록 게시일 2026-10-29 | 목록 다음 페이지 미확인 | Cloud 설정에는 활성; route SQL은 disposable PG17에서 재생 확인. 운영 반영·예약 실행과 전수 목록 이어보기는 미완료 |
| `nist` 미국 NIST | NCCoE 뉴스 200, 25개 후보; 최신 production adapter는 다음 페이지를 반환하지 않음 | 개인정보 관련 PPFL 기사 2,050자, 날짜 2026-10-29 | 페이지 이어보기는 최신 Crawlee adapter 검증에서 미확인 | Cloud Python 활성. 이전 “다음 페이지 확인” 서술을 정정; 원문/토픽 사람 검토 필요 |
| `iapp` IAPP | `/news` 200, 20개 후보; production helper가 제목·날짜·링크를 읽음 | privacy 관련 표본 10,340자, 2026-11-06. 회원 전용 경계와 사용조건 미확인 | helper next 없음 | Python adapter 테스트 통과하나 cloud 설정은 hold; 재사용·회원 경계·접근정책 검토 미완료 |
| `fpf` Future of Privacy Forum | `/blog/` 200, 47개 후보; 초기 선택 FAQ는 2014년 글로 부적합 | 별도 privacy 관련 2026-11-05 기사 11,086자 | helper next 없음 | Python adapter 테스트 통과하나 cloud 설정은 hold; 접근정책 검토 미완료 |
| `gpa` Global Privacy Assembly | 공식 뉴스 목록 200, 121항목; RSS 별도 12개 | 표본 2,858자, 2026-11-03. 121개 중 120개가 단어 필터에 잡혀 과포함 우려 | RSS rolling window, 전체 이어보기 미검증 | Python adapter 테스트 통과하나 cloud 설정 hold; topic 정확도·접근정책 검토 미완료 |
| `g7-dpa` G7 DPA Roundtable | Canada OPC membership hub 200; G7 communiqué와 privacy-preserving age-assurance 항목 2개 발견 | communiqué 상세 200, production Crawlee+Trafilatura 6,809자; 추출된 2026-07-08은 수정일 후보이고, 사건 자체는 2026-06-25/26 | hub pagination 없음; 반복 주간 목록 미확인 | 실제 route/parser 연결·5곳 probe 확인. 연속성·공동문서 재사용 조건 때문에 hold 유지 |
| `global-cbpr` Global CBPR Forum | `https://www.globalcbpr.org/news/` — 200, 12개 후보 | production 경로에서 기사 HTML을 우선 시도한 뒤 공식 연차보고서와 업무계획 PDF 각 2쪽, 합계 7,031자 추출. 두 PDF 표지일은 2026-05-26, 뉴스 게시일은 2026-06-10으로 분리 보존 | 다음 페이지 미확인 | Cloud 설정에는 활성; route SQL은 disposable PG17에서 재생 확인. 운영 반영·예약 실행과 전수 목록 이어보기는 미완료 |
| `ripd` 중남미 개인정보 네트워크 RIPD | 공식 `/noticias/rss.xml`은 별도 검사에서 200/311항목, robots 200 및 공개 뉴스 허용. 현재 route-specific Crawlee 요청은 HTTP 500 | 이전 연결 상세 200, Trafilatura 약 3,896자; 현재 실패로 새 상세 요청 안 됨 | RSS 이어보기 확인 안 됨 | 최신 500과 이전 성공을 구분해 기록. 별도 이용조건·feed 범위 확인이 남아 hold 유지 |
| `iso-iec-sc27` ISO/IEC JTC 1/SC 27 | `https://committee.iso.org/sites/jtc1sc27/home/news.html` — 200, 검증된 PDF 후보 1개 | production 경로에서 정확히 허용한 PDF 1쪽, pypdf 2,081자 추출. 목록 표기는 2025-05만 있어 publication date는 미확정; 표준 발행일 2023-09와 구분 | 목록 다음 페이지 미확인 | Cloud 설정에는 활성; route SQL은 disposable PG17에서 재생 확인. 운영 반영 전이며 연월만 확인돼 날짜 확정 필요 |
| `noyb` 유럽 디지털권리단체 noyb | 공식 뉴스 목록 200, 12개 후보; production candidate adapter가 기사 카드·제목·날짜를 읽음 | 상세 2,444자; 게시일 후보 2026-10-29 | 전체 목록 이어보기 미확인 | Python adapter 및 Trafilatura-first 상세 fallback 추가, 테스트 통과. 현재 cloud 설정 hold; live worker 실행·전체성 미검증 |
| `nl-ap` 네덜란드 AP | 공식 RSS 200, 10항목; RSS는 기사 발견에 사용 | `Allow: /actueel/*` 상세 URL은 Protego 0.6.2로 허용 판정. `/actueel/handhavingsbeleid-ap-gepubliceerd` 200, Trafilatura 936자, 2026-10-30 | RSS next 없음, rolling completeness 미확인 | production collector와 catalog probe에 RSS→robots 확인→Trafilatura 본문 흐름 연결. 테스트 통과. 별도 이용조건 검토가 없어 runtime source는 hold, terms timestamp 미기록 |
| `vn-gov` 베트남 정부 전자신문 | 최신 전체 probe는 공식 `/policies.htm`과 홈페이지 focus 경로를 각각 요청(둘 다 HTTP 200). 후보 4건과 28건을 확인했으나 개인정보 관련 용어 필터를 통과한 항목은 0건 | 최신 실행에서 본문 상세 요청 없음. 과거 Decree 363 기사 4,309자 추출은 별도 표적 경로 확인이며 이번 전체 probe 결과가 아님 | 최신 실행은 두 목록 경로만 확인; timeline 전체 페이지 이어보기 미검증 | 최신 자동 경로는 후보 탐색·관련성 판정에서 실패. 기존 Decree 363 표본은 historical 보완 증거로만 유지 |
| `freevacy` Freevacy | 공식 뉴스 목록 200, 72개 후보; production candidate adapter가 재게시 카드와 출처 표기를 보존 | 상세 2,793자; 날짜 후보 2026-11-05. syndicated summary이며 원보도/재게시 동일성은 미확인 | 이어보기 확인 안 됨 | Python adapter 및 Trafilatura-first 상세 fallback 추가, 테스트 통과. 현재 cloud 설정 hold; 전문이라고 표시하지 않음 |
| `overview-legal` overview.legal | 개별 글 목록 `/this-week?ui=v1` — 200, 43개 후보; adapter는 `/posts/<id>`만 기사로 선택 | aggregate 10,343자는 제외. 개별 `/posts/607721`은 별도 검증 106,457자; yearless `Nov 5`를 게시일로 추정하지 않음 | 개별 포스트 이어보기·큰 본문 안정성 미검증 | Python adapter와 Trafilatura-first 상세 fallback 추가, 테스트 통과. 현재 cloud 설정 hold; 제3자 법률집계 자료이며 날짜 미확정 |
| `eur-lex` EUR-Lex News | catalog probe가 홈페이지로 잘못 이동해 200, 126개 일반 링크 | homepage 270자는 뉴스 상세 아님; 관련 상세·날짜 미검증 | 사용자 보류 상태 유지 | Hold / 수집 권한 미승인; 일반 홈페이지 probe 성공을 운영으로 해석하지 않음 |

## 과거 probe 및 별도 경로 기록 (최신 전체 probe로 대체됨)

초기 일반 37-ID probe는 EUR-Lex를 의도치 않게 한 번 요청했습니다. 해당 응답은 이후 수집 가능성의 증거로 사용하지 않습니다. 그 뒤 수행한 이전 36-ID route-aware probe는 일부 경로·어댑터 수정 전 스냅샷이므로 최신 상태를 설명하지 않습니다. 이전 표본의 PDPC 약 295자 본문, PPC 56자 HTML 티저, JPDP 342자 footer, G7의 무관한 CNIL 홈 305자, CBPR의 316자 티저, overview.legal aggregate는 적합한 전문 수집 증거가 아닙니다. 최신 36개 전체 probe는 별도 최신 문서와 JSON에 기록했습니다.

PPC의 공식 PDF 21쪽 추출, 베트남 Decree 363 기사 4,309자 추출 등은 각각의 표적 경로를 별도로 확인한 기록입니다. 이 결과들은 최신 전체 probe의 선택 표본 결과를 대체하지 않으며, 목록 전체 coverage도 증명하지 않습니다.

현재 `catalog_probe.py`에서 NPC는 RSS `content:encoded`의 전문을 직접 사용합니다. NL AP는 공식 RSS에서 URL을 찾은 뒤 Protego 0.6.2로 로봇 규칙을 판단하고, 허용된 상세 URL에서 Trafilatura를 실행하도록 변경했습니다. NL AP 설정은 이용조건·재사용 검토 전 hold이며, 이는 robots 차단을 뜻하지 않습니다.

IAPP·FPF·GPA·noyb·Freevacy·overview.legal은 목록 helper와 Trafilatura-first 본문 추출 경로를 Python collector에 연결하고 단위 테스트를 통과했습니다. 이용 조건·페이지 이어보기·worker 운영 검증이 남아 있어 현재 hold를 유지합니다. ICO WiredGov, PCPD ISD 날짜 archive, G7 OPC, Vietnam homepage/timeline, EU Council RSS-summary도 source-specific Python 경로와 테스트를 추가했습니다. 본문 한 건 확인이 출처 전체의 완전한 coverage를 뜻하지 않으며, PCPD·Vietnam·ICO에는 관찰된 기간/목록 누락 한계가 남아 있습니다.

최신 route-aware 전체 36개 probe는 완료됐지만 28개 표본 추출·8개 실패로 부분 결과이며, 전체 pagination·관련성·날짜·예약 수집은 증명하지 않습니다. 이 점검은 운영 DB에 쓰지 않았고, cloud claim gate·Edge 배포·예약 수집을 운영 환경에서 실행한 것도 아닙니다. 신규 migration은 별도 PostgreSQL 17에서 순서대로 재생해 검증하며, 13:00 NL AP activation migration의 terms timestamp는 14:00 forward migration에서 null/hold로 정정하도록 했습니다. cloud claim gate와 예약 실행 검증은 여전히 남아 있습니다.

