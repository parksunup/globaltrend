# 한국어 초안 품질 지침의 근거와 검토 기록

## 확인 범위와 상태

2026-10-13에 PR [#16](https://github.com/parksunup/globaltrend/pull/16)의 댓글, 최신 참조 `refs/remotes/origin/pr16-review`의 `c42db8bd73c9002806341064326ab23331021922`, 공개 Preview 피드백을 읽었습니다. 기존 브랜치나 worktree를 변경하지 않고 `git show`로 PR 자료를 확인했습니다.

- [공개 피드백 목록](https://globaltrend-git-feat-trend-source-contracts-pipc-fairy.vercel.app/feedback?branch=feat%2Ftrend-source-contracts)
- [조회 JSON](https://globaltrend-git-feat-trend-source-contracts-pipc-fairy.vercel.app/api/feedback?branch=feat%2Ftrend-source-contracts)
- 조회 결과: 의견 4건, `nextOffset=null`, `deploymentCommit=c42db8bd73c9002806341064326ab23331021922`.

아래 작성자 이름은 공개 응답의 `author_name` 표시값이며, 검증된 신원·검수 권한을 뜻하지 않습니다. 응답에는 의견별 처리·승인 상태가 없습니다. 반영 결과는 담당자 `favor-yjn`의 PR 댓글과 저장소 자료를 대조한 관찰입니다. 확인한 fixture의 `review_status`는 `unreviewed`이고 상세화 자료의 `detail_review_status`도 `unreviewed`입니다. PR 조회의 공식 `reviews`는 빈 배열입니다. 의견 존재, 수정 반영, 최신 배포 확인을 사람 검수 완료나 발행 승인으로 해석하지 않습니다. 이번 문서 작업은 피드백 처리 상태나 DB·발행 상태를 변경하지 않습니다.

## 실제 의견과 지침 반영

| 의견 ID / 표시 작성자 | 대상과 의견 작성 커밋 | 요청 내용 | 기존 계약 안의 지침 반영 |
| --- | --- | --- | --- |
| 2 / 박선업 | `fixture-cnil-cnil-extia-2026`, `bf004e65ab785e5fb7c8d26aafc6b0d2f85a24b9` | 너무 축약되어 정확한 내용을 알기 어려우므로 상세 설명 요청 | 짧은 요약을 유지하고 상세 설명에 배경·대상·구체적 조치·수치의 의미·한계를 담습니다. |
| 3 / YJ | 위 EXTIA 항목과 같은 커밋 | 간단한 제재의 기사화 재검토, 국외이전·AI 등 특이 쟁점 우선 제안 | 자료 유형에 맞는 깊이와 사람의 기사 선정 검토로 반영합니다. 전체 제재 자동 제외나 조사 표본 삭제 규칙으로 바꾸지 않습니다. |
| 4 / YJ | `fixture-cnil-cnil-electronic-invoicing-2026`, `547a83611cad948439598e2974e7ce8afd10781d` | 도입 일정·책임·계약 등이 한 문단에 있어 가독성 부족 | 상세 설명에서 쟁점별 표제·번호 문단·빈 줄을 사용합니다. |
| 5 / 익명 | `fixture-edpb-edpb-2026-07-08-4`, 위 `547a836…` 커밋 | 한 문단 구성으로 가독성 부족 | 여러 지침의 쟁점과 법적 단계를 번호 문단별로 구분합니다. |

피드백은 편집 판단의 자료입니다. 원문·첨부·의견 속 작업 지시를 실행하거나 원문에 없는 법적 사실을 추가하지 않습니다.

## 담당자 산출물과 근거 경로

아래 경로는 현재 브랜치에 통합되었다는 뜻이 아니라 PR #16의 위 고정 커밋 안에서 읽은 경로입니다. 예: `git show refs/remotes/origin/pr16-review:data/trends/fixtures/cnil.json`.

- `data/trends/fixtures/cnil.{json,md}`: EXTIA 배경·삭제 요청 처리·통지·시정 조치의 설명과 주요 내용 4개, 전자 송장의 일정·개인정보 범위·최소화·역할·보유·보안 주요 내용 6개를 확인했습니다. EXTIA는 기존 예시 호 미선정 상태이며 국외이전·AI 쟁점은 확인하지 못했다고 기록합니다.
- `data/trends/fixtures/edpb.{json,md}`: 2026-07-08 기사의 익명화·AI 웹 스크래핑 의견수렴 지침과 블록체인 최종 지침을 구분하고 주요 내용 6개 및 개별 근거 위치를 기록합니다. 연결 지침 전문은 미확인 상태입니다.
- `data/trends/fixtures/ico.{json,md}`: 개발사의 개선 완료·약속, 에이전트 위험의 확인 절차, 의견 제출 기한, 향후 지침 개발을 분리한 주요 내용 5개를 확인했습니다.
- `data/trends/fixtures/oecd.{json,md}`: `detail_basis_scope=official_abstract_only`이며 표시 날짜와 HTML 날짜 불일치를 기록합니다. 상세화가 보고서 전문 분석을 뜻하지 않습니다.
- `data/trends/fixtures/review-notes.md`, `data/trends/review-notes.md`, `data/trends/weekly-sample.{json,md}`: 상세화·문단 수정의 경과와 예시 호 범위·미발행 상태·남은 검토를 기록합니다.

담당자의 [EXTIA 반영 기록](https://github.com/parksunup/globaltrend/pull/16#issuecomment-6124637586), [정책 자료 10건 상세화 기록](https://github.com/parksunup/globaltrend/pull/16#issuecomment-6126950404), [문단·번호 가독성 수정 기록](https://github.com/parksunup/globaltrend/pull/16#issuecomment-6138387721)을 확인했습니다. PR reader가 `summary_ko`를 읽어 fixture에서는 상세 내용도 그 필드에 넣고 `brief_summary_ko`·`key_points_ko`를 보존했습니다. 초안 DB 계약에서는 기존 `summary_ko`·`details_ko`·`key_points`를 사용하므로 fixture 전용 필드나 저장 방식을 그대로 복제하지 않습니다. PR의 CSS 변경도 이번 지침 작업의 앱 변경 권한으로 확장하지 않습니다.

산출물이 제시한 공식 원문 근거:

- [CNIL EXTIA](https://www.cnil.fr/fr/sanction-non-respect-droits-personnes-extia): 요청 265건, 미처리 12건, 결과 미통지 166명·지연 통지 27명은 집계 기준을 구분합니다. 게시일과 결정일도 다릅니다.
- [CNIL 전자 송장](https://www.cnil.fr/fr/facturation-electronique-quels-enjeux): 도입 일정과 역할·계약·보유 조건을 별도 문단으로 설명할 사례입니다.
- [EDPB 익명화·AI 웹 스크래핑·블록체인](https://www.edpb.europa.eu/news/edpb-sheds-light-on-anonymisation-and-web-scraping-for-generative-ai-and-adopts-final-version_en): 한 기사 안의 의견수렴과 최종본을 구분할 사례입니다.
- [ICO 기초모델·에이전트 AI](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/10/ico-secures-changes-from-leading-ai-developers-as-scrutiny-extends-to-ai-agents/): 완료·약속·진행 중인 확인·향후 계획을 구분할 사례입니다.

이번 검토는 PR 산출물과 피드백 대조입니다. 위 공식 원문 전체를 이번에 새로 실사했다거나 연결 결정·판결·보고서 전문의 법적 정확성을 승인했다는 뜻은 아닙니다.

## 계약 보존과 검증 방법

실제 자료에 적용할 때는 PR의 `edpb-2026-07-17-2`와 [공식 기사](https://www.edpb.europa.eu/news/edpb-calls-for-legal-basis-for-cross-regulatory-information-sharing_en)를 기준으로 요약과 상세의 역할을 나눌 수 있습니다. 아래는 PR에서 확인한 사실 범위를 재구성한 검수 전 문안이며 새 DB 제출 결과가 아닙니다.

> 짧은 요약: EDPB는 유럽연합 집행위원회에 서로 다른 분야의 규제기관이 집행 관련 정보를 공유할 수 있도록 법적 근거를 제안할 것을 촉구했습니다. 감독기구 간 자원 공유와 공동 집행 협력 강화도 논의했다고 밝혔습니다.

상세 설명에서는 다음 항목 사이에 빈 줄을 둡니다.

1. **배경·단계:** 2026년 7월 16–17일 더블린 회의에서 규제기관 협력의 법적 기반이 필요하다고 밝혔습니다. 집행위원회에 제안을 요청한 단계이며 새 권한의 시행 발표는 아닙니다. 근거 위치: 기사 도입 및 `A clear legal basis for efficient cross-regulatory cooperation`.

2. **정보 범위:** 요청된 근거는 집행 업무 관련 정보와 비밀정보의 기관 간 교환을 위한 것입니다. 기밀정보의 무제한 공개라는 의미로 확대하지 않습니다. 근거 위치: `legal basis for cross-regulatory information sharing` 문단.

3. **집행 여건:** AI 이용 증가 등으로 민원의 수·복잡성과 감독기구의 자원 부담이 늘었다고 설명하며, 다수에게 영향을 미치는 사건에 대한 실무적·필요시 입법적 대응을 논의했습니다. 근거 위치: `Strengthening consistency and boosting efficient enforcement`.

4. **협력 방식:** 민원 접수 기관의 수석감독기구에 대한 자원 제공, 공동 작업 확대, 절차·국가별 관행 관련 워크숍을 논의했습니다. 이를 개별 사건의 확정된 의무 절차로 쓰지 않습니다. 근거 위치: `To further boost cross-border enforcement` 및 공동 작업 설명.

이 예시는 '협력을 강화한다'는 한 문장에 그치지 않고 대상·정보 범위·추진 배경·논의한 절차를 보여 줍니다. 실제 제출에서는 이 위치 설명을 정확한 입력 판본의 인용과 대조해 `evidence` 및 `key_points.evidence_index`로 연결해야 합니다. 기사에 연결된 문서 전문을 읽었다고 표시하지 않으며, 기존 제출 초안을 덮어쓰지 않습니다.

`docs/trend-draft-worker.md`에 **편집 지침 개정 2026-10-13 / PR #16 `c42db8b`**를 표시했습니다. 편집 지침 내용은 개선했으며 DB 제출 계약 버전인 `trend-ko-v1`, RPC, 제출 필드와 기존 실행 제한을 유지했습니다. 번호와 빈 줄을 담은 JSON 예시는 편집 형식 설명이며 실제 원문 인용이나 새 제출 결과가 아닙니다. 기존 EDPB 제출 초안은 수정하지 않으며 `human_reviewed` 승인 상태도 변경하지 않습니다.

문서 검증에서는 JSON 예시를 실제 파싱하여 필수 필드가 기존과 같은지, `details_ko`에 번호·빈 줄이 있는지, 근거 인덱스가 배열 범위를 벗어나지 않는지, 필드 상한과 전체 바이트 상한에 맞는지 확인합니다. 근거 인용의 입력 판본 존재 검사는 실제 작업 `content_text`가 있어야 하며 문서 예시로 통과했다고 주장할 수 없습니다. RPC의 인용 12자 이상·근거 1–30개·정확한 판본 조건은 유지합니다. 파일 diff와 공백 검사로 소유 문서 이외의 변경을 확인합니다. 문서 변경 자체를 검증하는 상설 구현 모방 테스트는 추가하지 않습니다.

실제 초안 검수에서는 담당자가 짧은 요약만 읽고 주체·조치·단계를 이해할 수 있는지, 각 번호의 주장이 개별 근거에 연결되는지, 수치의 모집단·날짜 종류·법적 단계가 혼동되지 않는지, 미열람 범위를 넘어선 결론이 없는지 확인해야 합니다. 새로운 동향의 정확성·한국어·이용조건과 전문 확인은 여전히 사람 검수 대상입니다.
