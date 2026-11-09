# 정책·학술 자료 수집 후보 명단

ID: `policy-academic-candidate-registry-v1`

사용자가 요청한 전체 후보 11곳/명입니다. 기관 4곳(IAPP·CIPL·FPF·SAPI), 연구자 7명(Solove·Hartzog·고학수·박상철·임용·김병필·카민스키)이며, 카민스키 교수는 사용자가 Margot E. Kaminski로 확인했습니다. 공식 프로필 대조는 별도입니다. 기관과 연구자를 운영 DB의 활성 출처로 등록한 목록이 아닙니다.

- 출처 조사표가 있는 후보: 기존 5곳/명과 SAPI, 총 6곳/명 — 접속 차단·실사 미완료
- 공식 프로필/주소 탐색 대기: 연구자 5명
- 신규 실제 선정 자료: 0건 / 미발행
- 내부 candidate_id의 로마자는 공식 저자명·영문 표기를 검증한 결과가 아닙니다.

| 후보 ID | 요청된 기관·연구자 | 성격 | 시작 URL | 현재 상태·후속 확인 |
| --- | --- | --- | --- | --- |
| iapp | IAPP | professional_association | https://iapp.org/ | 이전 GET은 HTTPS 프록시 CONNECT 403. 공식 목록·본문·저자 프로필 미확인. |
| cipl | Centre for Information Policy Leadership (CIPL) | policy_organization | https://www.informationpolicycentre.com/ | 이전 GET은 HTTPS 프록시 CONNECT 403. 공식 목록·본문·저자 프로필 미확인. |
| fpf | Future of Privacy Forum (FPF) | policy_research_organization | https://fpf.org/ | 이전 GET은 HTTPS 프록시 CONNECT 403. 공식 목록·본문·저자 프로필 미확인. |
| daniel-solove | Daniel J. Solove | individual_researcher | https://www.law.gwu.edu/daniel-j-solove | 이전 GET은 HTTPS 프록시 CONNECT 403. 공식 목록·본문·저자 프로필 미확인. |
| woody-hartzog | Woody Hartzog | individual_researcher | https://www.bu.edu/law/profile/woody-hartzog/ | 이전 GET은 HTTPS 프록시 CONNECT 403. 공식 목록·본문·저자 프로필 미확인. |
| sapi | SAPI(사용자 제공 명칭) | university_initiative | https://sapi.co.kr/publications/?e-filter-d61a3b0-publicaton_category=papers | 사용자 제공 URL GET은 CONNECT 403. 목록·본문·공식 명칭 미확인 |
| researcher-ko-hak-su | 고학수 | individual_researcher | 미확인 | 사용자가 지정한 연구자. 공식 프로필·저자 식별자·공저자·논문 목록과 출판 판본을 확인할 예정. |
| researcher-park-sang-cheol | 박상철 | individual_researcher | 미확인 | 사용자가 지정한 연구자. 동명이인을 피하기 위해 공식 프로필과 논문 저자 정보를 교차 확인할 예정. |
| researcher-im-yong | 임용 | individual_researcher | 미확인 | 사용자가 지정한 연구자. 공식 프로필의 영문 표기·공저자·논문 목록을 확인할 예정. |
| researcher-kim-byeong-pil | 김병필 | individual_researcher | 미확인 | 사용자가 지정한 연구자. 소속·저자 프로필·논문 목록은 공식 원문 확인 전 확정하지 않음. |
| researcher-kaminski | Margot E. Kaminski | individual_researcher | 미확인 | 사용자 신원 확인 완료, 공식 프로필·소속·논문 목록 대조 대기 |

한 표 행은 JSON items 한 항목과 대응합니다. URL이 비어 있는 항목에 대학 홈페이지·임의 프로필 경로·논문 URL을 만들어 넣지 않았습니다. source-configs는 HTTPS 시작 URL이 필요한 형식이므로 정확한 주소를 확보하기 전에는 이 명단에 대기 항목으로 보존합니다.

## 선정과 연구자 식별

- SAPI의 국·영문 명칭·운영 주체·공식 자료실을 확인하고 대학·연구자 관련 자료와 연결합니다. 서울대의 모든 AI 자료를 SAPI 발간물로 분류하지 않습니다.
- 연구자는 현재 소속·영문 표기·저자 식별자(확인 가능한 ORCID 등)·공저자·출판사 정보를 대조합니다. 사용자에게 이름을 받은 것과 공식 프로필의 일치를 확인한 것은 구분합니다.
- 기관 발간물의 저자가 후보 연구자인 경우 기관·저자 관계를 연결하고 한 문서를 두 번 세지 않습니다. 공저 논문도 저자별로 중복 수록하지 않습니다.
- AI 관련 자료라도 개인정보·프라이버시와 직접 관련되는지 본문으로 판단합니다. 제목·연구자의 명성만으로 심층 동향을 만들지 않습니다.
- 초안·학술지판·기관 재소개·번역판은 관계와 수정 이력을 보존합니다. 같은 연구의 실질적 후속 연구인지도 실제 내용을 읽고 구분합니다.
- 기존 [정책·연구 편집 계약](research-editorial.md)의 저자 주장·방법/논증·근거·한계·정책 제안 구분을 함께 적용합니다.

## 아직 확인하지 못한 부분

SAPI는 사용자 제공 주소에 실제 GET을 했으나 CONNECT 403으로 목록·본문을 확인하지 못했습니다. 추가 연구자 5명은 정확한 프로필 URL·논문 제목·게시일·판본·학술지 상태·권리를 확인하지 못해 프로필 탐색 대기입니다. 연구자 주소에는 요청하지 않았으므로 접속 차단으로 표시하지 않습니다. Margot E. Kaminski라는 신원과 SAPI 주소에 관한 사용자 응답을 반영했습니다.

운영 DB·앱·환경변수·발행 상태를 수정하지 않습니다. 원문 전문·무허가 번역문·비밀값을 이 명단에 넣지 않습니다.

[대응 JSON](research-candidates.json) · [편집 계약](research-editorial.md)
