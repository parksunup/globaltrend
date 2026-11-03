# 2026-10-23 날짜·첨부 파서 조사

## 적용한 수정

PPC 공식 공지 https://www.ppc.go.jp/news/press/2026/260717/ 의 `main.l-main .l-article > .date-box`에는 `令和８年７月17日`과 기관명이 표시되어 있다. 기존 파서는 본문 후보 날짜를 모으면서도 제목의 `公表（날짜）` 패턴만 게시일로 인정하여 이 공지의 날짜를 null로 남겼다. Python과 Edge 모두 전용 공지 머리말 날짜를 `published_notice_dateline` 관찰로 보존하여 2026-07-17로 인식한다. 본문의 국회 제출일·성립일은 게시일 후보로 사용하지 않는다. 명시적 공표 제목 날짜와 공지 머리말 날짜가 다르면 null과 검토 대기를 유지한다. Python에서 제목 날짜를 우선 확정하던 충돌 처리도 수정했다.

공지의 연결 PDF 3개는 미열람 상태와 검토 gate를 유지한다. 첨부를 읽었다고 표시하거나 `ai_ready`를 강제로 변경하지 않았다. https://www.ppc.go.jp/news/careful_information/261007_alert/ 에 나타나는 개정일·추가일은 전용 공지 머리말이 없으므로 게시일로 승격하지 않는다.

## 실제 응답에서 확인한 미해결 범위

아래 확인은 수동 HTTP GET 및 로컬 파서 실행이며, 운영 DB 변경·배포·예약 실행 결과가 아니다. 공식 본문 전문은 저장소에 복제하지 않았다.

| 출처·URL | 실제 확인 | 판정·한계 |
|---|---|---|
| PDPC `/media-events/dnc-registry-figures` | HTTP 200, `Published on 01 Jan 2026`, 기존 본문 추출 성공 | 이번 응답에서는 날짜 결함 미재현. 누적 unknown 카운터 해소로 보지 않음 |
| PDPC `/media-events/amendments-to-the-personal-data-protection-act-and-spam-control-act-passed-nov-2020` | HTTP 200, `Published on 14 Oct 2025`, 기존 본문 추출 성공 | URL의 2020년과 표시 날짜가 달라도 URL로 게시일을 추정하지 않음 |
| PDPC `/media-events/advisory-on-unsolicited-robocalls` | HTTP 200, `Published on 14 Oct 2025`, 기존 본문 추출 성공 | 이번 응답에서는 날짜 결함 미재현 |
| PDPC `/media-events/privacy-awareness-week-2021` | HTTP 200, `Published on 26 Apr 2021`, 기존 본문 추출 성공 | 이번 응답에서는 날짜 결함 미재현 |
| PDPC `/media-events/new-e-learning-programme-on-pdpa-now-available` | HTTP 200, `Published on 16 Jun 2021`, 기존 본문 추출 성공 | 이번 응답에서는 날짜 결함 미재현 |
| PDPC `/media-events/privacy-awareness-week-2026` | HTTP 200, 행사 전용 템플릿, `25 - 31 May 2026` 개최기간 | 기존 기사 RSC 추출기는 `title_or_body_missing`. 개최 시작일과 게시일을 구분해야 하므로 게시일 확정·지원 구현하지 않음 |
| PDPC `/media-events/singapore-data-festival-2026` | HTTP 200, 행사 전용 템플릿, `20 - 24 Jul 2026` 개최기간 | 기존 기사 RSC 추출기 실패. 개최일을 게시일로 확정하지 않음 |
| PDPC `/assets/25e68133-795e-4c3f-bbea-7456b01c8506` | HTTP 200, application/pdf, 1,768,582바이트, PDF 1.7, 비암호화 2쪽. pypdf 텍스트 1쪽 2,818자·2쪽 3,385자 | 2023/24 데이터 침해 현황·예방조치 자료. 텍스트만 확인했고 시각 검증·게시일 확정 안 함. 후속 수정에서 공식 asset PDF 텍스트 지원 추가(아래 참고) |
| PDPC `/assets/82bd9d26-fa3d-4f9f-96fc-8c7829fc6b64` | HTTP 200, application/pdf, 3,573,420바이트, PDF 1.4, 비암호화 2쪽. 두 쪽 모두 추출 텍스트 0자 | 이때 pypdf만으로 텍스트를 확보하지 못함. 후속 PDF.js 결과는 아래 참고하며 OCR 필요로 단정하지 않음 |
| DPC `/en/news-media/press-releases/data-processing-operations-require-data-protection-impact-assessment` | HTTP 200, 본문 183자 추출. `main p.date`와 표시 게시일 없음 | 날짜 null 유지. 연결 PDF 미열람 유지 |
| DPC `/en/news-media/latest-news/data-protection-commission-publishes-final-decision-following-inquiry-childrens-health-ireland-chi` | HTTP 200, `main p.date`의 `01st October 2026` | 기존 파서 2026-10-01 인식 성공 |

PDPC API `/api/listing-api?itemsperpage=10&listingtype=media_events&pathname=%2Fmedia-events`는 HTTP 200, totalItems=189였다. 최신 5개 기사와 기존 NRIC 공지에서 기존 RSC 본문·날짜 추출이 성공했다. 이 표본만으로 목록 전체 완료나 운영 unknown의 고유 기사 수를 확정하지 않는다. 승인 호스트·외부 링크 권한은 변경하지 않았다.

## 검증

새 회귀검사는 실제 구조를 축약한 합성 HTML을 사용하며 네트워크·DB가 필요 없다. 수정 전 Python에서 공지 날짜 누락과 충돌 날짜 우선확정 2개 실패를 재현했다. Edge도 원본 adapter와 새 회귀검사의 조합에서 같은 2개 실패를 확인했다. 본문 개정·추가일을 게시일로 쓰지 않고 연결 PDF 미열람 상태를 유지하는 검사도 포함한다.

수정 후 Python collector 98개, Deno adapter/runtime 20개, 앱 137개 검사와 `npm run validate:data`의 21건 검사가 통과했다. 실제 PPC HTML을 Edge 추출기로 다시 읽어 `published_date=2026-07-17`, `requires_review=true`, `ai_ready=false`, 관련 PDF 3개 모두 `read=false`를 확인했다. Deno PDF 텍스트 검사에서 canvas/Path2D 경고가 있었으며 시각 렌더링 성공으로 해석하지 않는다.


## 후속 수정: PDPC 공식 asset PDF 텍스트 지원

Python과 Edge가 PDPC의 승인 공식 호스트 `https://www.pdpc.gov.sg/assets/UUID`에서 application/pdf로 받은 자료를 텍스트로 읽도록 보완했다. 목록 제목이 있어야 하며, 다른 호스트나 다른 경로를 이 지원으로 우회하지 않는다. 기존 50쪽·80,000자 제한과 페이지별 최소 텍스트 확인을 사용한다. 텍스트가 없는 페이지가 있으면 `pdf_text_missing_or_ocr_required` 오류를 보존한다. 모든 페이지의 텍스트 추출이 끝나기 전에는 ingest하지 않으며, backlog 실패 위치·범위·재시도 횟수를 유지한다. Python은 기존 PDF 도우미가 이 명시적 오류를 일반 오류로 덮던 문제도 수정했다.

PDPC PDF에는 CURIA의 Luxembourg dateline이나 보도자료/판결 의미를 적용하지 않는다. `read_scope=pdf_text_only`, `requires_review=true`, `ai_ready=false`로 보존한다. 목록 날짜의 게시일 의미가 입증되지 않았으므로 `listing_date_candidate`로 남기고 `published_date=null`로 유지한다. 행사 시작일이나 PDF 본문 날짜를 게시일로 선택하지 않는다. 연결 문서는 여전히 미열람이다. 행사 2개는 `.rte`가 HTML에서 비어 있고 별도 RSC 구조이므로 지원을 추가하지 않았다. 이 수정은 운영 backlog 재처리를 수행하지 않는다.

실제 두 PDF를 PDF.js로 다시 읽은 결과는 pypdf와 달랐다. `25e68133…`는 PDF.js 3,419자, pypdf는 페이지별 합계 6,203자였다. `82bd9d26…`는 pypdf 0자였지만 PDF.js가 8,231자의 영문 텍스트를 추출했다. 후자는 보안권고·데이터 위험에 관한 유효한 영문 문장과 피드백 링크를 포함하나 문구 중복과 인포그래픽 순서 혼재가 있어 시각 구조·본문 완결성을 입증하지 않는다. pypdf 실패만으로 이 파일에 OCR이 반드시 필요하다고 단정하지 않는다. 두 Edge 결과 모두 날짜 null·검토 대기·AI 부적격 상태를 확인했다. 시각 렌더링이나 사람 내용 검토는 완료하지 않았다.

합성 PDF 회귀검사에서 수정 전 Python·Edge 각각 3개 실패를 확인했고 수정 후 전체 Python collector 101개, Deno adapter/runtime 23개, 앱 137개, 자료 21건 검사가 통과했다. 실제 이미지형/무텍스트 PDF의 재현은 새 합성 빈 PDF를 사용하며 공식 PDF 원본을 저장소에 복제하지 않는다. Deno canvas/Path2D 경고는 텍스트 추출만 검증한다는 제한으로 유지한다.
