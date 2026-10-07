# 한국·일본 비교 검토 — 비교 작성 전 점검

작업일: 2026-10-07 (한국 시각). 사용자의 우선순위에 따라 **한국 PIPA·일본 APPI를 먼저 진행**하고 다른 해외법의 추가 번역·비교는 뒤로 미룬다. 기존 17개 기준과 7개 법제 열은 유지한다.

## 현재 확인할 수 있는 것

현재 [비교표](./criteria-mapping.md)는 119개 셀 모두 미검토인 준비표다. 한국·일본의 비교 내용이 완성되었거나 정확성 검수를 통과했다고 평가할 수 없다. 별도 원본 첨부파일은 확보하지 못했으며, 저장소에 확정된 [architecture.md §6.0](../../architecture.md#60-첫-법제-범위와-비교-기준)과 기존 seed의 17개 기준명·순서를 그대로 대조했다.

일본은 [공식 고정 판본](https://laws.e-gov.go.jp/api/2/law_data/415AC0000000057_20261001_507AC0000000070)을 기준으로 [제1조~제123조 초안](./translations/appi.md)을 작성했다. 본칙 185개 조문 중 123개이며, 부칙·별표와 제124조 이후는 미번역이다. 한국은 [국가법령정보센터 공식 판본](https://www.law.go.kr/LSW//lsInfoP.do?lsiSeq=283839&chrClsCd=010202&urlMode=lsInfoP&efYd=20260911&ancYnChk=0)의 법률 제21445호(2026-03-10 일부개정, 2026-09-11 시행)와 본문 HTML을 확보했다. 시행예정 조문·부칙 등 전체 범위 대조와 이용조건 검토는 미완료다.

## 기존 17개 기준에서 검토할 질문

아래 링크는 **이미 작성한 APPI 초안에서 먼저 확인할 근거 후보**이며 전체 관련 조항 목록이나 국가 간 비교 결과가 아니다. 한국 근거, 일본 미번역 구간, 부칙·별표를 확인한 다음에 실제 비교 셀을 작성한다. 모든 링크의 번역은 사람 검수 전이다. 공공부문과 민간부문 규정을 함께 확인하며, 표의 질문은 원문에 없는 해설로 번역 본문에 넣지 않는다.

| 번호·기준 | APPI 작성 구간의 우선 확인 링크 | 한국·일본 비교에서 사람이 확인할 점 | 현재 상태 |
| --- | --- | --- | --- |
| 1. 개인정보 범위 | [제2조](./translations/appi.md#main-a2), [제16조](./translations/appi.md#main-a16), [제60조](./translations/appi.md#main-a60) | 개인정보·개인데이터·보유개인데이터·보유개인정보를 구분하고 한국 용어와의 대응 근거를 확인 | 비교 미작성·초안 검수 전 |
| 2. 법 적용 대상 | [제16조](./translations/appi.md#main-a16), [제57조](./translations/appi.md#main-a57), [제58조](./translations/appi.md#main-a58), [제60조](./translations/appi.md#main-a60) | 사업자·공공기관의 적용 범위, 특례·제외와 일본 제125조·제171조의 미번역 근거를 확인 | 비교 미작성·후속 조문 미번역 |
| 3. 개인정보보호 원칙 | [제3조](./translations/appi.md#main-a3), [제17조](./translations/appi.md#main-a17), [제18조](./translations/appi.md#main-a18), [제19조](./translations/appi.md#main-a19), [제61조](./translations/appi.md#main-a61) | 기본 원칙과 개별 의무·노력 의무를 구분하고 목적 제한의 예외를 확인 | 비교 미작성·초안 검수 전 |
| 4. 정보주체 권리 | [제32조](./translations/appi.md#main-a32), [제33조](./translations/appi.md#main-a33), [제34조](./translations/appi.md#main-a34), [제35조](./translations/appi.md#main-a35), [제76조](./translations/appi.md#main-a76), [제90조](./translations/appi.md#main-a90), [제98조](./translations/appi.md#main-a98) | 민간·공공 권리의 요건·거절 사유·기한을 구분하고 제109조 이후 및 제124조 특례를 추가 확인 | 비교 미작성·권리 절차 일부 미번역 |
| 5. 처리근거 — 수집 | [제20조](./translations/appi.md#main-a20), [제21조](./translations/appi.md#main-a21), [제62조](./translations/appi.md#main-a62), [제64조](./translations/appi.md#main-a64) | 수집·고지·특별한 정보 취득의 요건을 구분하고 동의 예외를 모두 확인 | 비교 미작성·초안 검수 전 |
| 6. 처리근거 — 이용 | [제17조](./translations/appi.md#main-a17), [제18조](./translations/appi.md#main-a18), [제19조](./translations/appi.md#main-a19), [제69조](./translations/appi.md#main-a69) | 이용목적의 특정·변경·목적 외 이용 및 공공부문 예외를 따로 확인 | 비교 미작성·초안 검수 전 |
| 7. 제공 | [제27조](./translations/appi.md#main-a27), [제29조](./translations/appi.md#main-a29), [제30조](./translations/appi.md#main-a30), [제31조](./translations/appi.md#main-a31), [제69조](./translations/appi.md#main-a69), [제70조](./translations/appi.md#main-a70), [제72조](./translations/appi.md#main-a72) | 제3자 제공, 공동이용·위탁, 확인·기록 의무와 개인관련정보의 조건을 구분 | 비교 미작성·초안 검수 전 |
| 8. 특별한 보호가 필요한 정보 | [제2조 제3항](./translations/appi.md#main-a2-p3), [제20조](./translations/appi.md#main-a20), [제27조](./translations/appi.md#main-a27), [제60조](./translations/appi.md#main-a60) | 要配慮個人情報와 조례상 지정 정보의 범위를 확인하고 한국 민감정보와 같다고 단정하지 않기 | 비교 미작성·초안 검수 전 |
| 9. 가명·익명정보 | [제41조](./translations/appi.md#main-a41), [제42조](./translations/appi.md#main-a42), [제43조](./translations/appi.md#main-a43), [제44조](./translations/appi.md#main-a44), [제45조](./translations/appi.md#main-a45), [제46조](./translations/appi.md#main-a46), [제73조](./translations/appi.md#main-a73) | 재식별 금지·제공 제한·준용을 확인하고 [제109조](./translations/appi.md#main-a109)~[제123조](./translations/appi.md#main-a123) 초안의 공공부문 근거도 검토 | 비교 미작성·공공 익명가공 구간도 초안 검수 전 |
| 10. 아동 개인정보 | [제20조](./translations/appi.md#main-a20), [제76조 제2항](./translations/appi.md#main-a76-p2) | 취득 동의와 권리행사 대리인의 규정을 구분. 아동 연령·보호자 동의 기준의 직접 근거를 별도 조사하며 한국 기준을 일본법에 대입하지 않기 | 직접 관련 근거 범위 미확정·비교 미작성 |
| 11. 안전성 확보조치 | [제23조](./translations/appi.md#main-a23), [제24조](./translations/appi.md#main-a24), [제25조](./translations/appi.md#main-a25), [제66조](./translations/appi.md#main-a66), [제67조](./translations/appi.md#main-a67) | 사업자 안전조치·직원 및 위탁 감독과 공공부문 비밀유지의 의무 범위 확인 | 비교 미작성·초안 검수 전 |
| 12. 처리 위탁 | [제25조](./translations/appi.md#main-a25), [제27조 제5항](./translations/appi.md#main-a27-p5), [제66조](./translations/appi.md#main-a66), [제73조](./translations/appi.md#main-a73) | 위탁의 제3자 제공 예외와 감독·재위탁 의무를 구분하고 [제116조](./translations/appi.md#main-a116)·[제121조](./translations/appi.md#main-a121)·[제123조](./translations/appi.md#main-a123) 근거도 검토 | 비교 미작성·일부 근거 미번역 |
| 13. 국외이전 | [제28조](./translations/appi.md#main-a28), [제71조](./translations/appi.md#main-a71) | 국가 인정·적정 조치·동의 및 정보 제공 조건을 민간·공공별로 대조 | 비교 미작성·초안 검수 전 |
| 14. 과징금 | 작성된 번역 구간만으로 확정하지 않음 | 제176조~제185조와 다른 직접 근거를 확인하여 罰金·過料를 한국 과징금으로 치환하지 않기. 아직 ‘규정 없음’으로 판정하지 않음 | 제재 구간 미번역·비교 미작성 |
| 15. 시정조치 등 | 작성된 번역 구간만으로 확정하지 않음 | 제146조~제160조의 조사·지도·권고·명령 및 권한 제한을 확인하고 민간·공공·인정단체 구분 | 감독 구간 미번역·비교 미작성 |
| 16. 유출 등의 통지·신고 | [제26조](./translations/appi.md#main-a26), [제68조](./translations/appi.md#main-a68) | 위원회 보고와 본인 통지를 구분하고 대상 사건·위탁 관련 예외·세부 규칙 근거 확인 | 비교 미작성·초안 검수 전 |
| 17. 데이터활용 촉진 | [제1조](./translations/appi.md#main-a1), [제41조](./translations/appi.md#main-a41), [제43조](./translations/appi.md#main-a43) | 목적 조항·구체적 활용 제도·보호 장치를 구분하고 [제109조](./translations/appi.md#main-a109)~[제123조](./translations/appi.md#main-a123) 초안도 검토 | 비교 미작성·공공 활용 구간도 초안 검수 전 |

## 발견한 오류와 이어서 할 일

- 이전 PR의 ‘제1~4장(제1~58조)’ 표현은 잘못되었다. 제4장은 **제59조까지**다. 이번 상태 목록은 공식 상위 관계로 장·절·관의 시작·끝 조 번호를 계산하여 제목 번역 수와 장 전체 작성 수를 구분한다.
- 제106조 제2항의 법정 치환표 21행·63셀 및 제107~108조를 초안으로 작성했다. 원문 빈 셀·행·열 순서·테두리 속성을 유지하고 셀별 앵커를 연결했다. 다음 구간은 제124조부터이며 표의 문구와 인용 관계는 사람 검수 전이다.
- APPI의 나머지 본칙·제공 부칙·별표를 같은 문서에 이어 작성하고 전체 누락을 대조한다. 한국 공식 원문을 확보한 뒤 두 법률을 같은 기준일의 판본으로 비교한다.
- 실제 비교 셀을 채울 때는 모든 관련 조항, 한국어 핵심 요약, 예외, 조항 앵커, 공식 URL, 판본, 사람 검수 상태를 기록한다. 작성된 비교표의 17행은 위 질문을 따라 한국·일본부터 검토하고, 그 이후 다른 해외법 작업을 재개한다.
