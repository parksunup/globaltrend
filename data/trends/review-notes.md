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
