# 법제 목록 — 공식 원문 확보·번역 진행 조사표

원문 조사일: 2026-10-06 (UTC). 상태 갱신: 2026-10-07 (한국 시각). 지정된 7개 법제. 한국은 한국어 원문을 사용하고 해외법은 자체 한국어 번역을 작성한다. **전문 번역 완료 법률은 아직 없다.**

이전의 전면 네트워크 차단 상태를 재조사 결과로 갱신했다. APPI는 공식 판본을 확정했고 다른 법률은 확보 자료의 한계를 아래에 구분했다. `in_review`는 조사를 진행 중이라는 뜻이며 사람이 검수 완료했다는 뜻이 아니다.

기존 외부 한국어 번역의 존재·직접 출처·판본 일치·이용허락은 아직 확인하지 못했다. 이는 번역이 없다는 뜻이 아니다. 이번 APPI 자체 초안은 기존 번역의 발견으로 기록하지 않는다. CSV의 기존 번역 URL·미확인 시행일 빈 값은 검토 필요를 의미한다. APPI·PIPL·CCPA의 effective_date는 아래 특정 판본 또는 공식 메타데이터의 표기이며 법 전체의 최초 시행일을 의미하지 않는다.

| ID | 관할권 | 법률명 | 공식 원문·조사 대상 URL | 판본·시행일 | 기존 한국어 번역 | 조사 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| kr-pipa | KR — PIPA | 개인정보 보호법 | [공식 판본](https://www.law.go.kr/LSW//lsInfoP.do?lsiSeq=283839&chrClsCd=010202&urlMode=lsInfoP&efYd=20260911&ancYnChk=0) | 국가법령정보센터 lsiSeq 283839; 법률 제21445호, 2026-03-10 일부개정, 2026-09-11 시행; 공식 본문 HTML 확보; 시행예정·부칙·누락 및 이용조건 대조 필요; 선택 판본 시행일: 2026-09-11 | 한국어 원문 확보; 기존 번역 조사 대상 아님 | in_review |
| jp-appi | JP — APPI | 個人情報の保護に関する法律 | [원문·대상](https://laws.e-gov.go.jp/api/2/law_data/415AC0000000057_20261001_507AC0000000070) | 415AC0000000057_20261001_507AC0000000070; CurrentEnforced; 본칙·제공 부칙·별표 확보; 선택 판본 시행일: 2026-10-01 | 유무·직접 출처 검토 필요 | in_review |
| cn-pipl | CN — PIPL | 中华人民共和国个人信息保护法 (Personal Information Protection Law of the People’s Republic of China) | [원문·대상](https://flk.npc.gov.cn/law-search/search/flfgDetails?bbbs=ff8081817b6472a3017b656cc2040044) | NPC DB bbbs ff8081817b6472a3017b656cc2040044; sxx=3(유효); 공포 2021-08-20·시행 2021-11-01 메타데이터 확인; 목차 확보·법문 파일 미확보; 선택 판본 시행일: 2021-11-01 | 유무·직접 출처 검토 필요 | in_review |
| eu-gdpr | EU — GDPR | Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation) | [원문·대상](https://op.europa.eu/en/publication-detail/-/publication/3e485e15-11bd-11e6-ba9a-01aa75ed71a1/language-en) | EU 출판국 OJ L 119, 4.5.2016 관보 원판 HTML·PDF; 11장·15절·99조·전문 고려사항 173개; 제99조 적용 2018-05-25; 정오표·현행 통합본 검토 필요; 선택 판본 시행일: 검토 필요 | 유무·직접 출처 검토 필요 | in_review |
| gb-uk-gdpr | GB — UK GDPR | Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data (United Kingdom General Data Protection Regulation) (Text with EEA relevance) | [원문·대상](https://www.legislation.gov.uk/eur/2016/679/data.xml) | revised XML; RestrictStartDate 2026-09-30; 미반영 개정 5건 존재, 현행성 검토 필요; 선택 판본 시행일: 검토 필요 | 유무·직접 출처 검토 필요 | in_review |
| us-ca-ccpa | US-CA — CCPA | California Consumer Privacy Act of 2018 (California Civil Code, Division 3, Part 4, Title 1.81.5) | [원문·대상](https://cppa.ca.gov/pdf/20260101_ccpa_statute.pdf) | CPPA PDF 표제 effective 01/01/2026, AB 137·AB 566 update; 주 의회 법전과 후속 개정 대조 필요; 선택 판본 시행일: 2026-01-01 | 유무·직접 출처 검토 필요 | in_review |
| sg-pdpa | SG — PDPA | Personal Data Protection Act 2012 | [원문·대상](https://sso.agc.gov.sg/Act/PDPA2012) | SSO Current version as at 06 Oct 2026; 2020 REVISED EDITION 기반; 전체 범위·후속 개정 시행일 검토 필요; 선택 판본 시행일: 검토 필요 | 유무·직접 출처 검토 필요 | in_review |

APPI 본칙·제공 부칙·별표 전체 초안과 조항 연결은 [appi.md](./translations/appi.md), [appi.json](./translations/appi.json)에 있다. 누락·이용조건·용어 검토는 [APPI 검토 메모](./translations/appi-review-notes.md), 나머지 법률과 영국 보완 법령은 [전체 검토 메모](./review-notes.md)를 참조한다.

[7개 법제 진행표](./translation-progress.md)와 [17개 기준 분류·요약표](./criteria-mapping.md)는 한국·일본 34개 셀의 사람 검수 전 초안이다. 다른 5개 법제 85개 셀은 미검토다. 한국은 [공식 한국어 원문 색인](./sources/pipa-index.md)에서 본문을 연결하며 원문 자체는 저장소에 포함하지 않는다.
