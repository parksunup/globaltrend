# 침해·유출·data breach 번역 검토

조사일: 2026-10-18. 후속 사용자 결정: 단일 국문 명칭을 강제하지 않고 실제 사건과 국가별 법률 정의에 맞춰 구체적으로 풀어 씁니다. 아래 조사 당시 제안은 검토 이력이며, 현행 적용 기준은 [용어집](glossary.md)을 따릅니다. 기존 원고 전수 교정은 아직 수행하지 않았습니다.

## 결론

`breach`를 단어 하나만 보고 침해 또는 유출로 치환하면 안 됩니다. 법규·의무의 위반을 뜻하는 경우와 각 법률이 정의한 사고를 가리키는 경우를 구분해야 합니다. 국가별 정의도 다릅니다.

사실관계와 법률상 평가를 두 축으로 관리하는 방안을 제안합니다. ‘위법 수집’과 ‘유출’은 서로 배타적인 분류가 아니며, 한 사건에 둘 다 있을 수 있습니다. 사고가 있었다는 사실과 안전조치 의무 위반이 인정됐다는 판단, 감독기관 신고·정보주체 통지 의무는 각각 확인해야 합니다.

## 국내 한국어 용례

개인정보보호위원회 개인정보 포털은 ‘개인정보 침해’를 법적 근거 없는 수집·이용·제공과 유출·오남용·불법유통 등을 포괄하는 표현으로 설명합니다. 따라서 이 넓은 개념을 GDPR의 personal data breach와 동일시하면 범위가 달라집니다.

- [개인정보 포털: 개인정보 침해 개념](https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=37)
- [개인정보 포털: 개인정보 유출](https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=56): 통제 상실·권한 없는 접근이라는 설명도 있으므로, 유출을 항상 ‘복사본이 외부로 반출됐음이 입증된 경우’로만 좁히는 규칙도 피합니다.
- [KISA GDPR 자료실](https://cbpr.kisa.or.kr/gdpr/bbs/selectArticleList.do?bbsId=BBSMSTR_000000000061): 2026-08-03 등록된 ‘EDPB 개인정보 침해 통지 템플릿 주요 내용 및 기업 대응방안’이라는 국문 제목을 확인했습니다. 이는 제목 수준의 용례이며 첨부 본문의 번역 기준을 확인한 결과는 아닙니다.
- [2022 GDPR 가이드북의 법무부 제공 파일](https://www.moj.go.kr/bbs/moj/177/482353/download.do): 검색 색인에서는 ‘제34조(개인정보 유출 통지 등)’ 표기도 확인되지만 원문 파일 직접 열기는 리디렉션 오류로 실패했습니다. 전면적인 번역 기준의 근거로 채택하지 않습니다.

## 법률별 차이

| 범위 | 확인한 개념과 범위 | 번역 시 유의점 |
|---|---|---|
| EU GDPR | 제4조 제12호의 personal data breach는 보안 침해로 인한 파기·분실·변경·무단 공개·제공 또는 접근 등을 포함 | 유출로 일괄 축소하지 않으며 모든 개인정보 보호법 위반을 이 개념으로 부르지 않음 |
| 영국 UK GDPR 관련 ICO 안내 | 개인데이터가 외부 반출되지 않아도 랜섬웨어로 접근을 상실한 경우를 다룸 | ‘유출되지 않았으므로 breach가 아니다’라는 추론 금지 |
| 싱가포르 PDPA | PDPC의 2021년 공식 안내는 data breach의 정의에 무단 접근·수집·이용·제공·복사·변경·폐기를 열거 | ‘무단 수집·이용은 어느 나라에서나 data breach와 별개’라는 규칙 금지. 해당 조항의 의미와 사실관계를 확인 |
| 일본 APPI | PPC는 漏えい(외부 유출), 滅失(내용 상실), 毀損(예기치 않은 변경·이용 불능)을 구별 | ‘漏えい等’의 等을 생략하여 전부 유출로 옮기지 않음. 제도 설명과 개별 사건의 구체적인 유형을 구별 |
| 중국 PIPL | 제57조는 泄露·篡改·丢失를 열거 | 조항 번역에서는 유출·변조·분실이라는 열거를 보존. 다른 법의 breach 개념으로 합치지 않음 |
| 캘리포니아 | 법무부 신고 안내는 무권한자의 개인정보 취득 또는 합리적으로 취득이 의심되는 상황을 설명 | GDPR의 넓은 정의와 자동 동일시하지 않음. 일반 보안사고, 민법 제1798.82조 통지 제도, CCPA의 민사청구 요건을 구별 |

근거:

1. [GDPR 제4조 제12호·제6조·제33~34조](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
2. [EDPB Guidelines 9/2022, v2.0, 문단 14~20, 본문 7~8쪽](https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202209_personal_data_breach_notification_v2.0_en.pdf): 보안사고와 personal data breach의 관계, 기밀성·무결성·가용성 기준을 설명합니다.
3. [ICO: Ransomware and data protection compliance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/ransomware-and-data-protection-compliance/)
4. [PDPC: Guide on Managing and Notifying Data Breaches under the PDPA, 2021-03-15, 본문 8쪽](https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Other-Guides/Guide-on-Managing-and-Notifying-Data-Breaches-under-the-PDPA-15-Mar-2021.pdf)
5. [일본 PPC FAQ Q4-5](https://www.ppc.go.jp/all_faq_index/faq2-q4-5/)
6. [중국 시장감독관리총국 게재 PIPL 제57조](https://www.samr.gov.cn/wljys/gzzd/art/2023/art_3ef1e889c1e644d4b65b5f5c7f432386.html)
7. [캘리포니아 법무부: Data Security Breach Reporting](https://www.oag.ca.gov/privacy/databreach/reporting), [CCPA 안내](https://www.oag.ca.gov/privacy/ccpa)

싱가포르 및 캘리포니아 법령 사이트 직접 열기는 접근 오류로 실패했습니다. 위 표는 확인 가능한 감독기관·법무부 설명에 근거하며 각국의 모든 최신 개정·판례를 전수 검증한 법률 의견이 아닙니다.

## 원문 표현에 따른 편집 제안

| 원문·확인된 사실 | 제안하는 한국어 처리 | 피해야 할 처리 |
|---|---|---|
| breach/infringement of the GDPR, breach of an obligation | GDPR 위반, 해당 의무 위반 | 개인정보 유출이라고 변환 |
| unlawful collection/processing | 위법 수집·위법 처리. 조사 단계라면 혐의·의혹 등 원문의 판단 단계 보존 | 근거 없이 유출이라고 쓰기 |
| collection without consent | 동의 없이 수집. 필요한 경우 다른 적법 근거의 존재와 감독기관 판단을 확인 | 동의가 없다는 이유만으로 곧바로 위법이라고 단정 |
| unauthorised access | 무단 접근, 실제 열람이 확인되면 무단 열람 | 다운로드·반출까지 있었다고 추정 |
| exfiltration, theft, leak | 사실관계에 따라 반출·탈취·유출 | 단순 접근과 실제 반출을 혼동 |
| exposure, publicly accessible database | 개인정보 노출, 외부에서 접근 가능한 상태 등 구체적 사실 설명 | 실제 누군가 내려받았다고 추정. 단, 반출 미확인이 곧 법률상 유출 부정을 뜻하지도 않음 |
| loss, destruction, alteration, loss of availability | 분실·파기·변경·이용 불능 등 실제 결과 설명 | 외부 유출로 뭉뚱그리기 |
| data breach, 세부 유형 불명 | 국가·근거 조항·사고 범위 확인 후 표현 결정. 불명확하면 추가 확인 표시 | 제목만 보고 유출로 확정 |

표의 국문 표현은 조사자의 편집 제안입니다. 법률상 해당 여부는 출처와 해당 법률에 따라 별도로 확인해야 하며 위 표는 상호 배타적인 사건 분류표가 아닙니다.

## 실제 기관 자료가 보여주는 표현 구분

- [EDPB 게재 HUBSIDE.STORE 제재 사례](https://www.edpb.europa.eu/news/news/2024/commercial-prospecting-french-sa-fined-hubsidestore-eu525000_pt): 처리의 법적 근거와 고지 의무 위반을 설명합니다. 이를 근거 없이 ‘유출 사건’으로 번역해서는 안 됩니다.
- [EDPB 중소기업 안내의 사례](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en): 잘못된 이메일 발송, USB 분실, 백업 없는 의료데이터 삭제, 랜섬웨어 암호화 등을 함께 설명합니다. 이들은 모두 같은 방식의 ‘외부 반출’ 사건은 아닙니다.
- [ICO의 스코틀랜드 경찰 사례](https://cy.ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/03/police-scotland-fined-66k-and-reprimanded-following-serious-data-mishandling/): 휴대전화 정보 추출과 이후 제3자에 대한 위법 제공을 나눠 다룹니다. 한 사건 안에서도 수집·처리 및 제공 문제를 구체적으로 나눠 표현해야 함을 보여줍니다.

## 조사 당시 프로젝트 적용 제안 · 검토 이력

1. 제목과 요약에는 가능한 한 확인된 행위·결과를 씁니다. 예: ‘위법 수집으로 제재’, ‘고객정보 무단 열람’, ‘랜섬웨어로 환자정보 이용 불능’, ‘개인정보 유출 신고의무 위반’.
2. 제도·조문 번역에는 관할별 정의를 보존합니다. GDPR의 포괄 명칭은 아직 확정하지 않았습니다. ‘개인정보 침해사고’는 넓은 국내 침해 개념과, ‘개인정보 유출 등 사고’는 유출 중심 인상과 혼동될 수 있어 정의 설명을 함께 검토해야 합니다.
3. 사건 사실과 법률 평가를 별도로 기록합니다. 원어, 관할, 근거 조항, 실제 행위, 확인된 결과, 유출·반출 확인 여부, 감독기관의 법적 판단, 의혹·확정 여부를 확인합니다. 이 목록은 검토 체크 항목이며 DB 필드를 구현한 상태가 아닙니다.
4. 신고·통지 대상이라는 결론은 따로 확인합니다. breach라는 이유만으로 모든 감독기관 신고·정보주체 통지가 필요하다고 쓰지 않습니다.
5. TERM-040의 47개 필드는 추출된 표현의 검토 위치이며 47개 오류를 확인했다는 뜻이 아닙니다. 기존 원고의 실제 원문 대조와 교정은 아직 수행하지 않았습니다.
6. 사용자 선택 없이 용어집의 확정 표기나 기존 본문을 변경하지 않습니다. 이번 조사는 TERM-040에 연결하고 후속 검토 근거로 사용합니다.
