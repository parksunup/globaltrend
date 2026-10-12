# EU GDPR 번역 시작 — 원판 기준 부분 초안·공개 보류

작업일: 2026-10-12 (한국 시각). **전문 미완성·사람 검수 미착수·번역 본문 Git 공개 보류.** 일본 작업은 사람 검수 대기로 유지하고 EU 작업을 시작했다. 기존 브랜치 `feat/legal-corpus-foundation`과 PR #15를 사용한다.

## 선택 원문과 확인한 날짜

- 공식 법률명: Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation).
- 관할권: 유럽연합(EU). CELEX `32016R0679`, OJ L119,4.5.2016,pp1–88의 영어 **관보 원판**.
- 공식 [출판물 페이지](https://op.europa.eu/en/publication-detail/-/publication/3e485e15-11bd-11e6-ba9a-01aa75ed71a1/language-en)와 [XHTML 원판](https://op.europa.eu/o/opportal-service/download-handler?identifier=3e485e15-11bd-11e6-ba9a-01aa75ed71a1&format=xhtml&language=en&productionSystem=cellar&part=)·[PDF 원판](https://op.europa.eu/o/opportal-service/download-handler?identifier=3e485e15-11bd-11e6-ba9a-01aa75ed71a1&format=pdfa1a&language=en&productionSystem=cellar&part=)을 확인했다. 원문 파일 전체는 저장소 밖에 둔다.
- 공식 [RDF 메타데이터](https://op.europa.eu/en/publication-detail?p_p_id=publicationDetailsActions_PublicationDetailsActionsPortlet_INSTANCE_P7Lc96wTRLvv&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_publicationDetailsActions_PublicationDetailsActionsPortlet_INSTANCE_P7Lc96wTRLvv_requestAction=rdf&cellarId=3e485e15-11bd-11e6-ba9a-01aa75ed71a1&nonInferred=true)와 원문 제99조를 대조했다. 서명/채택2016-04-27,관보 공표2016-05-04,발효2016-05-24,적용2018-05-25를 구분한다.
- RDF의 in-force=true는 법규 효력 정보다. 원판 문구가2026년 현행 통합 문구라는 뜻이 아니다. XHTML 변환 생성일2024-12-11이나RDF 수정/버전값을 법률 개정일로 쓰지 않는다.

**최신 통합판·정오표 전체 목록·언어별 반영 범위는 미확정**이다. EUR-Lex 통합본·정오표·고지 요청은 HTTP202 빈 본문/WAF,일부 공식CELLAR 경로는 proxy403으로 본문을 얻지 못했다. 정오표가 없거나 후보 식별자의 영어본문이 적용된다고 추정하지 않는다. 공식 원판을 작업 기준으로 명시하되 현행판 비교 근거로 확정하지 않았다.

## 작성 범위와 미작성 범위

| 단위 | 선택 원판 수 | 비공개 초안 작성 | 미작성 | 상태·확인 방법 |
| --- | ---: | ---: | ---: | --- |
| 조 | 99 | 11 (제1~11조) | 88 (제12~99조) | 원문 art_1~99 번호·순서·구조·원문해시 대조 |
| 고려사항 | 173 | 21 (제1~21호) | 152 (제22~173호) | 원문 rct_1~173 번호·순서·본문해시 대조; 조문과 구별 |
| 장 제목 | 11 | 2 (I·II) | 9 | 원문 장 제목·상위 관계 확인 |
| 절 제목 | 15 | 0 | 15 | 원문 구조 색인; 첫 구간에 절 없음 |
| 항 | 372 | 29 | 343 | 원문 번호있는 문단을 Paragraph로 보존 |
| 호·대시 항목 | 389 | 68 | 321 | Item 번호·원문 라벨·상위 관계 확인; 제4조 정의호를 항으로 바꾸지 않음 |
| 번호 없는 도입·후행 본문 | 25 | 5 | 20 | Text로 별도 보존,목록 뒤 문장 누락 방지 |
| 서문 | 9 | 0 | 9 | 고려사항과 별개 Preamble |
| 말미·서명 | 8 | 0 | 8 | Closing |
| 각주 | 21 | 0 | 21 | 원문 각주 노드; 본문의 각주 표지 보존과 각주 내용 번역은 구별 |
| 법률 표제 | 1 | 0 | 1 | 공식 법률명은 문서 메타데이터로 기재; 원문 표제 노드 번역은 미작성 |
| 구조 노드 합계 | 1123 | 136 | 987 | 고유ID·원문순서·상위 관계·해시·번역 앵커 대조 |
| 부칙·별표 | 0 | 0 | 0 | 선택 원판에 해당 노드 없음; 발효·적용은 제99조 |

이는 원판 구조에 따른 작성 수이며 전체 의미 검수 완료율이 아니다. 총계136/1123을 법률 내용의 전체 진행률로 환산하지 않는다. 모든 번역·구조 노드의 사람 검수 상태는 미착수다. 단서·참조·후행 문장·정의의 범위를 원문대로 옮기며 해석은 본문 밖의 검토 메모에 둔다.

[공개 구조 색인](../sources/gdpr-index.md)·[JSON 색인](../sources/gdpr-index.json)에는 **원문 본문과 한국어 본문이 없다.** 작업 파일은 Git 밖 `/workspace/legal-drafts/gdpr.md`·`gdpr.json`에 같은 법률의 한 문서로 저장했다. 다음 작업도 같은 문서에 이어 쓴다. 이 경로는 실행 작업공간의 파일이며 공개 PR/Preview에 포함되거나 영구 보관을 보장하는 링크가 아니다. 환경이 교체되기 전 비공개 보관이 필요하다.

## 원문·번역 이용조건과 공개 보류

[OP 저작권 고지](https://op.europa.eu/en/web/about-us/legal-notices/publications-office-of-the-european-union-copyright)와 [배포 일반조건](https://op.europa.eu/en/web/about-us/legal-notices/general-conditions-of-dissemination)을 읽었다. EU 소유 웹 편집 콘텐츠에 CC BY4.0·출처/변경 표시를 안내하지만,출판물별 저작권 고지 및 EUR-Lex 콘텐츠의 별도 고지를 확인하라고 한다. 제3자 자료·로고 등 예외도 있다.

**GDPR 법령 자체와 프로젝트 자체 번역의 공개 PR 재배포 허용 근거는 아직 확정하지 못했다.** 위 웹 편집물 조건을 법령 번역 전체에 자동 적용하지 않는다. 따라서 한국어 본문과 원문 본문은 커밋하지 않고 판본·진행·공개 보류 이유를 리더가 검토하도록 기록했다. 공식 원문 확보가 번역 공개 승인이라는 뜻은 아니다.

## 국회도서관 번역본 참고 출처

사용자가 [국회도서관 EU GDPR 검색주소](https://dl.nanet.go.kr/search/searchInnerList.do?searchType=INNER_SEARCH&resultType=INNER_SEARCH_LIST&searchMehtod=F&queryText=EU+GDPR%3AALL_NI_TOC%3AAND&zone=ALL_NI_TOC&pageSize=10&orderBy=WEIGHT&topMainMenuCode=ASSM_ALL&topSubMenuCode=TLAW&searchQuery=EU+GDPR)를 알려주었다. 일반/승인 실행 경로 모두 proxy tunnel403으로 목록을 열지 못했다. 사용자의 번역본 게시 안내는 기록하되 열람·재사용 확인 완료로 쓰지 않는다.

| 확인 항목 | 현재 확인 내용 |
| --- | --- |
| 번역본 유무·출처 | 사용자가 국회도서관 게시 번역본의 검색주소를 제공; 검색 결과·개별 서지 직접 확인 필요 |
| 번역 주체·제목·식별번호 | 검토 필요 |
| 번역 대상 판본·정오표 반영 | 검토 필요 |
| 전문 여부·고려사항·조·항·호·각주 범위 | 검토 필요 |
| 원문 열람·이용·재배포 조건 | 검토 필요; 사이트 게시만으로 번역문의 재배포가 허용된다고 판단하지 않음 |
| 이번 초안과의 대조 | 미실행. 제3자 번역 본문을 전재하지 않고 공식 영어 원판에서 직접 번역 |

## 개인정보보호위원회 게시물 참고 후보

사용자가 [PIPC 지정 게시물](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS105&mCode=D060010000&nttId=5139)도 제공했다. 일반 요청 및 승인된 읽기 전용 요청 모두 HTTP503이었고,응답은 연결 시간초과 오류문91바이트였다. 게시물 제목·게시일·첨부파일·번역 주체·대상 판본·전체 범위·공공누리 유형·이용조건은 **검토 필요**다. 내용을 열람했다고 쓰거나 공식 기관 게시만으로 재배포를 허용받았다고 판단하지 않는다. 후보 출처로 법제 목록에 연결했으며,번역 공개 보류·원판 선택은 유지한다.

## 사용자 제공 PIPC 첨부 PDF 확인

게시물 페이지 접근 실패와 별개로 사용자가 PDF2개를 직접 제공하여 파일 자체를 읽었다. [참고 문서 판본·범위·표본 대조](../sources/gdpr-reference-files.md)와 [기계 메타데이터](../sources/gdpr-reference-files.json)를 기록했다.

영문April문서는2016-04-06 이사회1차 독회 자료이고 최종 관보 원문이 아니다. 한국어PDF는99조·173고려사항 제목을 포함하지만 정확한 대상판본·번역자·재배포 조건은 미확정이다. 따라서 **번역 자료 존재 자체는 확인됐으나 공식 한국어 법문·최신 판본·재배포 허용이 확인된 것은 아니다.** 제3조제2·3항,제4조(16)(a),제11조제2항 등 원판과 다른 표현·누락이 발견돼 검토 쟁점으로 기록했다. 자체 초안은 해당 원문 내용을 보존하고 참고 번역을 그대로 전재하지 않는다.

## 잠정 용어와 사람 확인 사항

| 영어 | 잠정 한국어 | 확인할 사항 |
| --- | --- | --- |
| controller / processor | 개인정보처리자 / 수탁처리자 | 제4조 목적·수단 결정자와 그를 대신해 처리하는 자를 구별; 한국법 개념과 동일시하지 않음 |
| data subject | 정보주체 | 식별된/식별 가능한 자연인의 정의를 유지 |
| pseudonymisation | 가명처리 | 제4조(5)호의 추가정보 분리·조치 요건 확인; 익명처리와 구별 |
| vital interests | 중대한 이익 | 제6조제1항(d)·제9조제2항(c),생명 관련 의미와 substantial public interest 구별; 고려사항46도 추가 대조 필요 |
| parental responsibility | 부모책임 | 제8조의 책임 보유자 의미; 일반 보호자·한국 법정대리인 개념으로 임의 치환하지 않음 |
| should / shall / may | 하여야 한다 / 하여야 한다 / 할 수 있다 등 문맥별 초안 | 고려사항의 설명과 본칙의 의무를 구별; 규범 강도는 사람 검수 필요 |

세부 용어 결정·불확실성은 Git 밖 `gdpr-terms.json`과 번역 담당 검토 메모에 보관했다. 출판물·정오표·기존 한국어 번역 대조 후 용어를 통일할 때 원문에 없는 해석을 본문에 추가하지 않는다.

## 비교표와 사람 검수의 구분

비교 CSV의 EU17셀은 법제 목록과 맞추어 판본 메타데이터만 갱신했다. 요약·예외·조항 연결·미검수 상태는 변경하지 않았다. EU17셀은 **미검토**다. 전체 한국어 초안·선정 판본/정오표·누락 대조가 끝나기 전 부분 번역에서 EU 비교 셀을 채우지 않는다. 기존 한국·일본34셀 및 그 사람 미검수 상태도 유지한다. 사용자가 확인했다고 명시한 EU 조문·비교 셀 범위는 없으며 사람 검수 완료로 기록하지 않는다.

## 다음 구간·리더에게 전달할 사항

- 본칙 제12~99조,고려사항 제22~173호,서문·말미·각주·표제를 같은 법률 문서에 이어 번역하고 단위별 누락·순서를 대조한다.
- 최신 통합판·정오표 전체와 해당 영어본 반영 범위를 확보해 원판과 대조한다. 판본이 바뀌면 번역을 조용히 덮어쓰지 않고 변경 근거를 기록한다.
- EUR-Lex/출판물의 법령 번역 재배포 근거와 국회도서관 개별 번역본 서지·판본·이용조건을 확인한다. 이번 본문 공개 보류를 승인으로 바꾸지 않는다.
- 전체 초안 이후 기존17기준 EU셀을 작성한다. 일본 사람 검수 대기·미해결 쟁점과 섞지 않는다.

역할: gpt-6.1-sol 공식 출처·판본 조사 및 본칙/고려사항 번역,gpt-6-luna 읽기 전용 구조 대조,통합 담당 파일·검증·브랜치/PR 정리. 모델 대조는 사람의 법률·번역 검수가 아니다.

## 실행한 검증

- GDPR 원판·비공개 초안을 입력한 구조 검사 통과:1123노드·99조·173고려사항,136작성/987미작성,첫11조/21고려사항,앵커136과 JSON/Markdown 대응. 공개 색인에 원문·한국어 본문 필드 없고 공개 gdpr.json/md 본문 파일 없음 확인.
- 읽기 전용 독립 구조 대조 통과: 원문 번호·순서·장/절·항/호·후행 문장·서문·말미·각주·해시,작성 첫구간 patch115/21개 반영,모든 사람 미검수 상태 확인. law/main은 선언된 가상 root다.
- 기존 APPI·PIPA 원문을 입력한 corpus 검사 통과. EU17셀은 source_version만 갱신하고 내용·검수 상태 보존; 나머지102셀과 APPI 번역 JSON/Markdown 보존.
- 팀 데이터 검사 및 저장소 테스트22/22 통과. `git diff --check` 통과. 의존성 자동 재설치만 생략하는 pnpm옵션을 사용하고 실제 검사 로직을 실행했다.
- 구조 검사는 번역 의미·법률적 완전성·저작권 허용·사람 검수 완료를 뜻하지 않는다.
