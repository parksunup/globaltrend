# 동향 출처 검토 메모

- 기록 시각: 2026-10-06T14:33:38+09:00 (한국시간)
- 담당 역할: 동향 담당
- 상태: 공식 목록·상세 페이지 확인이 네트워크 정책으로 차단됨. 조사 완료·수집기 구현 가능 상태가 아닙니다.

## 확인한 공식 주소와 접근 결과

| ID | 공식 시작 주소 | 직접 요청 결과 |
|---|---|---|
| `edpb` | [https://www.edpb.europa.eu/news_en](https://www.edpb.europa.eu/news_en) | 프록시 CONNECT 403; 목록·상세 본문 미확인 |
| `oecd` | [https://www.oecd.org/en/topics/privacy-and-data-protection.html](https://www.oecd.org/en/topics/privacy-and-data-protection.html) | 프록시 CONNECT 403; 목록·상세 본문 미확인 |
| `curia` | [https://curia.europa.eu/site/](https://curia.europa.eu/site/) | 프록시 CONNECT 403; 목록·상세 본문 미확인 |

## 확인 범위

README.md, architecture.md, docs/team-onboarding.md, data/의 양식과 자동 검사를 확인했습니다. 원격에 있던 feat/trend-source-contracts 브랜치를 사용하고 최신 main을 fast-forward로 반영했습니다. 앱·Supabase·인증·환경변수는 조사 결과로 수정하지 않았습니다.

실제 접근은 Python urllib HTTPS GET, TLS 검증 유지, 프록시 설정 유지, 30초 제한으로 시도했습니다. 오류 문자열은 `<urlopen error Tunnel connection failed: 403 Forbidden>`입니다. 원문 서버 HTTP 상태·페이지 부재·사이트 차단은 확인하지 못했습니다. 접근 제한 우회는 하지 않았습니다.

## 남은 검토

- 세 출처 모두 공식 목록의 자료·상세 URL·HTML/PDF 구조·제목·게시일·본문·공식 링크·RSS/API 응답을 확인해야 합니다.
- CURIA 사건번호·ECLI·선고일의 표시 여부는 모두 미확인입니다.
- EDPB RSS에 관한 설계 문서의 과거 기록은 이번 실사 검증으로 취급하지 않았습니다.
- 수집·저장·Codex 처리·번역·발췌·재배포 조건은 모두 미확정입니다.
- 개인정보 보호 관련성·단순 공지 제외·중복/같은 사건 연결 규칙은 설계상 제안이며 실제 표본 적용 전입니다.

## 네트워크 선행 조건

클라우드 설정의 기존 사용자 지정 허용 목록이 비어 있음을 확인하고 www.edpb.europa.eu, www.oecd.org, curia.europa.eu 세 도메인을 추가하는 초안을 저장했습니다. 초안 저장은 런타임 적용이나 게시를 뜻하지 않습니다. 사용자가 환경 설정에서 관련 네트워크 변경을 저장한 뒤 요청을 재시도해야 합니다. 아직 확인하지 못한 리디렉션·PDF·피드 호스트는 임의로 허용하지 않았습니다.

## 검증 해석

pnpm validate:data는 파일 대응·필수 값·ID·URL·상태를 검사합니다. 통과해도 공식 페이지 확인·선택자 동작·원문 이용조건 확인이 완료된 것은 아닙니다. 이 조사표는 blocked 상태를 유지합니다.


## CNIL·ICO·아일랜드 DPC 후보 추가 — 2026-10-11

- 확인 시각: 2026-10-11T16:39:49+09:00 (한국시간). 담당: 동향 담당. 배정된 feat/trend-source-contracts 및 기존 PR #16에 후보 자료를 추가합니다.
- 요청된 뉴스·결정·지침의 공식 목록·상세 실사는 **미완료**입니다. 세 기관 홈·시작 목록 후보 모두 HTTPS 프록시 CONNECT 403이며 원문 본문·원문 서버 상태·경로 유효성을 확인하지 못했습니다.

| 출처 | 홈 후보 | 목록 후보 | 실제 표본 | 상태 |
| --- | --- | --- | --- | --- |
| cnil | https://www.cnil.fr/ | https://www.cnil.fr/fr/actualites | 0건 | blocked |
| ico | https://ico.org.uk/ | https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/ | 0건 | blocked |
| dpc | https://www.dataprotection.ie/ | https://www.dataprotection.ie/en/news-media/latest-news | 0건 | blocked |

- 원제목·게시일·본문·공식 상세 URL·선택자·RSS/API·이용조건은 추정하지 않고 검토 필요/null/빈 배열로 기록했습니다. 뉴스·결정·지침은 요청 범위이며 사이트 제공 여부를 확인한 결과가 아닙니다.
- 선정 보류 이유: 사실 확인의 선행 조건인 공식 원문 접근이 실패했습니다. 0건은 자료 부족·부재 판단이 아닙니다. 실제 자료를 읽지 않아 개별 제외·사건 중복 판정은 수행하지 않았습니다. 같은 사건의 결정문·보도자료를 한 번만 세는 것은 향후 적용할 원칙입니다.
- 기존 EDPB 5건·OECD 2건·CURIA 2건, 예시 호 8건과 실제 발행 상태는 변경하지 않았습니다. 신규 후보를 예시 호에 삽입하지 않았습니다.
- 네트워크 초안에 www.cnil.fr, ico.org.uk, www.dataprotection.ie를 추가하고 기존 api.github.com·curia.europa.eu·www.edpb.europa.eu·www.oecd.org 허용을 보존했습니다. 초안 저장은 현재 런타임 적용을 뜻하지 않습니다. 저장 후 및 별도 실행 권한 재시도도 동일 403이었습니다. 접근 제한을 우회하거나 TLS 검증을 끄지 않았습니다.
- 이용정책·robots.txt·공개 요약 및 재배포 조건을 읽지 못했습니다. 원문·무허가 번역 전문은 저장소에 넣지 않았습니다.
- 후속 작업: 네트워크 변경 적용 → 실제 목록·상세·지침·결정 링크 확인 → RSS/API·이용조건·필드 위치 검증 → 출처별 최대 5건 선정 및 Markdown/JSON 대응 검증 → 같은 PR에 보완. 현재 상태를 실사 완료/수집기 사용 가능/법률 검수 완료로 승인하면 안 됩니다.


## 네트워크 게시 후 CNIL·ICO·DPC 실사 보완 — 2026-10-11

- 확인 시각: 2026-10-11T17:25:34+09:00 (한국시간). 이전 신규 3곳의 blocked/0건 기록은 당시 관찰입니다. 사용자 게시 후 뉴스 목록 3곳 모두 HTTP 200이며 현재 신규 출처 상태는 unreviewed입니다.
- 실제 신규 표본: CNIL 3건, ICO 2건, DPC 2건, 총 7건. 기존 9건까지 합하면 표본 총 16건입니다. 5건은 상한이며 채우기 위한 기사 추가를 하지 않았습니다. 주간 예시 호 8건·발행 상태는 변경하지 않았습니다.
- CNIL 선정: EXTIA 삭제 요청·통지 의무, 루아르 민간병원 보안·침해 통지, 전자송장 데이터 최소화. 모두 개인정보 보호와 직접 관련된 기사 본문·게시일을 확인했습니다. 행사 재방송·일정 공지와 교육 홍보물은 이번 내용 중심 표본에서 제외했습니다. CEPD 과징금/DSA 기사와 규제기관 정보 공유 재전달 기사는 기존 EDPB 표본과 같은 주제·행사일 수 있어 신규 표본에 추가하지 않았고 전체 사건 동일성은 별도 대조 대상입니다.
- ICO 선정: 기초모델·에이전트 AI 개선/의견 수렴, TikTok 과징금 및 정보요구 불복 철회. FOI 전용 지침과 사무소 개소·기관 전환 소개는 이번 개인정보 쟁점 중심 표본에서 제외했습니다. 집행 TWLS의 과징금·집행명령 상세 2곳은 같은 회사/행위/날짜/설명으로 연결할 사건이며 별도 표본으로 추가하지 않았습니다. Date의 게시일/결정일 의미도 추가 확인 필요합니다. 뉴스 GET은 Loading...만 보이지만 실제 JS가 호출하는 POST /api/search에서 뉴스/집행 목록을 확인했습니다. 내부 검색 API이며 공식 공개 API 지원을 확정한 것이 아닙니다.
- DPC 선정: CHI의 종이 아동 건강기록, Google 위치정보 처리. FAQ와 Tullamore 결정 설명은 직접 읽었으나 게시일을 확인하지 못해 이번 게시일 포함 표본에서는 제외했습니다. 결정일을 게시일로 바꾸지 않았습니다. FAQ PDF 경로의 연·월도 게시일로 추정하지 않았습니다.
- 중복: CNIL EXTIA/병원 결정 링크, ICO AI 보고서와 TikTok 2023 집행 상세는 related_documents로 연결하고 별도 건수로 세지 않습니다. TikTok 뉴스는 과징금 사건과 별도 추천시스템 정보요구 절차를 함께 다루므로 related_event_ids로 구분했습니다. 같은 기사가 모든 사건의 같은 결론을 뜻하지 않습니다. CHI/Google은 전문을 추후 공개한다는 안내만 확인해 미확인 전문 URL을 만들지 않았습니다. 이번 사건 고유성 판단은 표본 안의 범위이며 운영 DB 전수 중복 검사 아님.
- 날짜: CNIL EXTIA 게시일 9월 9일과 결정일 7월 21일 구분. 병원 표시 게시일 9월 3일은 확인했지만 본문 제재일 9월 3일과 연결 결정 제목 7월 21일이 달라 결정일은 null/검토 필요. ICO 뉴스 표시 날짜와 API createdDateTime은 서로 다른 관찰이며 생성 시각을 게시일로 사용하지 않습니다. DPC CHI 게시일 10월 1일과 결정 통지일 9월 10일 구분.
- CNIL Légifrance EXTIA 결정 전문은 다른 호스트 CONNECT 403으로 미확인. 원문 서버 HTTP 403으로 해석하지 않습니다. 병원 결정/PDF 전문·DPC 결정 PDF 전문은 미열람입니다. 기사에서 확인할 수 없는 추가 법적 결론·불복 상태는 쓰지 않았습니다.
- RSS: 열람한 페이지의 링크/푸터에서 공식 피드를 발견하지 못했으며 미제공으로 단정하지 않습니다. CNIL/DPC 공개 API, ICO 공개 API 문서·장기 안정성·필터/다음 페이지 동작은 검토 필요입니다.
- 이용조건: CNIL Mentions légales 및 Informations publiques의 CC-BY-ND/번역 허용 문구와 자료 유형별 차이, ICO copyright의 OGL v3.0·attribution·이미지/로고/교육 콘텐츠 예외를 직접 읽었습니다. 로봇 정책 3곳 확인. DPC 저작권/재사용 정책은 확인한 페이지에서 확보하지 못했습니다. 공개 접근만으로 Codex 처리·요약·번역·재배포 허가를 확정하지 않으며 terms_status는 모두 unreviewed입니다. 원문 전문은 /tmp에서만 읽고 저장소에는 링크·짧은 독자 요약·메타데이터만 기록했습니다.
- ICO robots.txt 확인 후 후속 요청은 6초 간격을 적용했습니다. TLS 검증·플랫폼 프록시를 유지했습니다.
- 사람 검토: 한국어 요약 정확성, CNIL 병원 결정일 불일치·요약 이용조건, ICO 현재/과거 기관명과 두 TikTok 절차 구분, DPC 결정 전문과 재사용 조건. 다른 페이지 유형·PDF·목록 순회 선택자는 검토 필요로 유지합니다.
