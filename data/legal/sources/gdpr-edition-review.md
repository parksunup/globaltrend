# GDPR 후속 판본·정오표·재사용 검토

검토일: 2026-10-13 (한국 시각). 아래 출처조사는 읽기 전용으로 수행했으며, 이후 통합 단계에서 확인된 정정17개를 반영했다. 사람의 법률·번역 검수 전이다.

## 확인한 공식 본문

OP의 공식 메타데이터 RDF에서 식별자를 확인한 뒤 공식 다운로드 경로로 영어 통합본문과 영어 정오표를 확보했습니다.

- 영어 통합본문: CELEX `02016R0679-20160504`, 표지 `EN — 04.05.2016 — 000.002`. [OP 상세](https://op.europa.eu/en/publication-detail/-/publication/5f2552c2-cc45-11e6-ad7c-01aa75ed71a1/language-en). 캐시 `gdpr-followup-consolidated-base.source`.
- 영어 정오표: CELEX `32016R0679R(02)`, OJ L 127, 23.5.2018, p. 2. [OP 상세](https://op.europa.eu/en/publication-detail/-/publication/683d5816-5e52-11e8-ab9c-01aa75ed71a1/language-en). 캐시 `gdpr-followup-corr02-op.source`.
- 통합본문은 99개 조를 포함하지만 고려사항은 포함하지 않습니다. 문서 자체도 법적 효력이 없는 문서화 도구이며 진정한 본은 관보에 실린 관련 법적 행위라고 명시합니다.

## 정오표와 언어 범위

| 식별자 | 공식 날짜 | 확보 범위 |
|---|---|---|
| R(01) | 2016-11-22 | 공식 RDF의 DEU·EST·HUN·ITA 표현 확인. 영어 표현 없음. 비영어 본문 검수 미실시. |
| R(02) | 2018-05-23 | 영어 정오표 본문 및 영어 통합본문의 C1 반영 확인. |
| R(03) | 2021-03-04 | 공식 RDF의 15개 언어 표현 확인. 영어 표현 없음. 비영어 본문 검수 미실시. |

2021년 통합 변형 `_0000030`도 같은 15개 언어만 메타데이터에 나타나며 영어 본문을 확보한 것이 아닙니다. `04.05.2016`을 마지막 수정일로 보거나 `_0000030`을 시행일로 읽지 않습니다. EUR-Lex의 최신판 선택 화면과 전체 개정이력은 확인하지 못했으므로 **2026년 현행성 확인 완료라고 표시하지 않습니다**.

## 기존 원판과 확인된 차이

99개 조를 대조해 9개 조에서 문구 차이를 확인했고, 정오표의 15개 수정 묶음을 기존 구조의 17개 본문 노드에 대응시켰습니다.

- 고려사항 71.
- 제37조제1항(c): 특별 범주 정보와 범죄 관련 정보 사이의 연결을 `and`에서 `or`로 수정.
- 제41조제3항·제5항, 제42조제7항, 제43조제3항 첫 문장·제6항, 제57조제1항(p).
- 제64조제1항(c)·제6항·제7항·제8항, 제65조제1항(a), 제69조제2항, 제70조제1항(l)·(o)·(p).

인정·인증의 criteria/requirements 구별, 등록부 관련 문장 삭제, 관할 감독기관 표현 및 이사회 권한·참조 문구의 변경이 포함됩니다. 정확한 노드 ID·원문 전후·해시는 scratch의 `gdpr-node-correction-diff.json`에 있습니다. 고려사항 71은 정오표의 수정 전 구절이 기존 원판과 정확히 일치함을 확인한 뒤 수정 후 구절을 대입한 후보를 별도 저장했습니다. 기존 본문·번역을 덮어쓰지 않았습니다.

## 공개 재배포 조건

이번에도 [EUR-Lex 재사용 상세](https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html)와 [법적 고지](https://eur-lex.europa.eu/content/legal-notice/legal-notice.html)는 HTTP 202 빈 본문이었습니다. 승인된 별도 실행에서도 AWS WAF challenge 헤더와 0바이트 응답이 확인되었습니다.

[OP 저작권 고지](https://op.europa.eu/en/web/about-us/legal-notices/publications-office-of-the-european-union-copyright)는 EU 소유 웹사이트 편집 콘텐츠의 CC BY 4.0 및 출처·변경 표시를 안내하지만 개별 출판물의 고지와 EUR-Lex 별도 고지를 확인하라고 명시합니다. 확보한 법문·관련 RDF에서는 이 법문에 적용되는 별도의 명시적 라이선스를 확인하지 못했습니다.

따라서 **GDPR 원문과 자체 한국어 번역 전문의 공개 PR 재배포 허용은 미확정**으로 유지합니다. 제3자 한국어 번역의 권리도 별도입니다. 기존 공개 범위인 출처 링크·판본·정오표 식별정보·검토 범위는 기록할 수 있지만, 그 사실이 법문·번역 전문의 공개 허가를 뜻하지 않습니다.

출처조사에 성공한 범위와 직접 경로의 차단 범위를 구별했습니다. 차단된 요청을 자료 부재나 공개 허용으로 판단하지 않았습니다.

## 통합 결과와 항목별 증거

원래 원판 전체 초안은Git밖 gdpr-2016-original.md/json으로 보존했다. 작업 gdpr.md/json은2016영어관보원판+확인된2018영어정오표의 보정판으로 명시적으로 변경했다. 통합문서의 ►C1/◄는 법문이 아닌 편집표지라 제외했다. 본칙은 EN000.002와 대조했고 고려사항은 원판과 정오표를 합성했다. 원판의1123개ID·순서/수는 유지됐으며 아래17개 항목의 원문해시와 한국어 초안만 바뀌었다. 전체영어통합본문을 최신현행법이나관보자체로 확정한 것이 아니다.

| 정정 항목 ID | 원판 해시 | 보정 해시 | 사람 검수 |
| --- | --- | --- | --- |
| recital-71 | 86ca840b5d2ab835db301f9492e2ea84147dda17e8d5180b270fb384fc23f23b | 88e97c539c009856e6d4ec2c62e96df20112be8de63dd62778a1b99c244279d0 | 미착수 |
| main-a37-p1-ic | d803619d48db0c5c40e31f7fa374c4f6db7de1ec98f5855a5ec7d0b849a6c4f8 | d2b886ad827fd386a1e58ff769d0082f996a4d8455e7c1f034865658bd3d041c | 미착수 |
| main-a41-p3 | c1d2bbb8f89b712f5d00c7c5b738ddb22d8327c279d5c54bb1de90840134f6f8 | 5594937aacfdc4b8ed6450a7871c3e86257dbfc4a930f3429a69800c2d116a9c | 미착수 |
| main-a41-p5 | 9257754bfce3cac13632b604406913b2a9316d58a566f23c02f4b2d8dda4a176 | ffae39cec31fcde82bda5a3b35ba5ba7e9dc09e89714148028850fc4913b2eb2 | 미착수 |
| main-a42-p7 | 72f4cc652d7aef225b936dd1c167ebc66b314f0caf128377a3ebba0a8f8b2da6 | d09dcd3faee07cbbb8d4166b7ca080cdc1911364e92e9ea78896043e7cb8d86c | 미착수 |
| main-a43-p3 | fcde71c337a8d104b367b905e189d93d38f7b084664ab62664ef9be632183cc3 | b806efe39a1629047cb39c20182d03c14deaadf9b624a86ef4436bac47bcd1fe | 미착수 |
| main-a43-p6 | 6724fcc9f5cc1094b20a19a48de6a19544d9edaafd48066d286435170e7f2cef | 159f23e2bdbf38081eb0acaf1a5a2032b01c1c1323065761451de1cc36bba55a | 미착수 |
| main-a57-p1-ip | 48e91d540b45f4d5ed534661c23871dc9c64107b428de4ca2f3c494a2989a725 | 4c7fb90ff1c0c4e29233a3189fcc62feca440106fbfcc1ee35ec848a3a713f63 | 미착수 |
| main-a64-p1-ic | 7ac53eefa565ce9751f0cda6f98625e841de42a1419238d88a77e3383cb77fba | 0204c6a3e3f8aea5870cae1a0fbae4ebd670da56374600046380818af3c3ff52 | 미착수 |
| main-a64-p6 | b06e5bf66f9f5485d598afe2f0c687abbd7e8481d3804fc87482bbfaaf1ef8f4 | e43b17d6f275b410403dc973c727d4c14b0df4402e6e0e2bde94854c955516f2 | 미착수 |
| main-a64-p7 | 0db10e41111c1a6610ebad65ca5d45064f2ba54dfc5ccd70a300d504b33fd2ba | 06f2afdcee46cec78778bb1c1a294cb966dbd63316d88a202d0be046ef6416ac | 미착수 |
| main-a64-p8 | 32fb658401bbfba040a4dd81d451cddb00b4bda68e9e3fe1340c3f62efad4130 | f9eee956d9d24cad309e3814fc6efb854d0e92ff47f9d092d766a4a214913f5a | 미착수 |
| main-a65-p1-ia | 1a05092aaae42deaad6c1719e7c2dc10ac52ffde7fd4ef74153773cf1ac821c8 | 5f8681e5b6b25d359a914afff48818b53eb14802297834b0d830ee3957e98407 | 미착수 |
| main-a69-p2 | 8967058245de2863889fe53124d00c4f94068c46ef5dd5798f399ef35ad1d50f | d2c35b337162b577a59852748f1c59b90fc187d518f34c56205bb5fbf699d609 | 미착수 |
| main-a70-p1-il | 31504540d62e96afac08021da0da4eda57338c74d81a6335ef60ac4782ece8aa | 8264fb6c9ed29e7ad5de850f9af98b9da084e5456fffc033fb8ae4960da49f51 | 미착수 |
| main-a70-p1-io | dce5110a660c724643f590f520c4ebb4ee8414de4e13acab2a33affc3f920048 | 7119c6c99af45dc365542eed462c9732810e27d590964f7960c6a154391d714f | 미착수 |
| main-a70-p1-ip | d7eb0b38352689fccbf2717be54822057b97e06a26602a47102a55266f603943 | dbfc19d2f202cd5f4ebc1d94f90689c8882596bab37d67b2ea121d4d58fd2820 | 미착수 |

[정정 manifest](./gdpr-correction-manifest.json) · [출처/조회 증거](./gdpr-edition-review.json) · [EU 비교 진행](../gdpr-comparison-review.md)
