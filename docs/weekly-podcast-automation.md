# 주간 팟캐스트 자동화 방식

## 지금 구현한 범위

작업 화면에서 NotebookLM이 내려준 오디오 파일을 올리고, 해당 주간호에 실제 포함된 공개 동향을 연결해 공개 페이지에서 재생하는 기능을 PR47에 추가했습니다. 오디오 파일은 브라우저에서 Supabase Storage로 직접 전송하고, 서버는 관리자 권한과 공개 동향 연결을 확인한 뒤 게시 기록을 저장합니다. 따라서 Vercel의 요청 본문 크기 제한 때문에 긴 오디오 업로드가 막히는 일을 피합니다.

현재 데이터베이스에는 주간호 자체를 표현하는 기존 테이블이 없습니다. PR47은 팟캐스트 게시 기록에 호수, 기간, 포함 동향 ID를 저장해 주간호 연결을 표현합니다. 관리자가 업로드할 때 실제 공개된 동향 중 포함된 자료를 선택해야 합니다.

## 컴퓨터가 꺼져 있을 때 NotebookLM을 자동으로 쓰는 방법

Google의 개인용 Gemini Notebook 도움말은 노트북에서 Studio의 Audio Overview를 생성하고, 완료한 파일을 다운로드하는 화면 절차를 안내합니다. 이 소비자 기능에 대해 Google이 공개한 예약 실행 API는 확인되지 않았습니다. Codex가 로그인된 브라우저 화면을 조작하는 방식은 브라우저와 인증 세션이 있는 컴퓨터가 켜져 있어야 하므로 컴퓨터가 꺼진 동안 실행할 수 없습니다.

Google의 공식 Codex 예약 작업 안내도 컴퓨터의 로컬 파일이나 로컬 전용 기능을 쓰는 작업은 컴퓨터와 데스크톱 앱을 켜 두어야 한다고 설명합니다. 웹·클라우드 실행은 연결된 도구만으로 끝낼 수 있는 작업에 적합하지만, 현재 NotebookLM 개인 계정의 화면 조작은 연결된 클라우드 도구가 아닙니다.

## 선택지

| 방식 | 컴퓨터가 꺼져도 실행 | 비용·제약 | 판단 |
| --- | --- | --- | --- |
| 개인용 NotebookLM + Codex 화면 자동화 | 불가 | NotebookLM 오디오 생성·다운로드 화면에 로그인된 브라우저가 필요 | 사용자가 컴퓨터를 켠 시간에 수동 실행하거나 로컬 예약으로만 가능 |
| Gemini Notebook Enterprise Audio Overview API + 클라우드 예약 실행 | 가능 | API는 Preview. Enterprise 제품 가격은 30일 시험 후 사용자당 월 9달러, 최소 15개 라이선스로 안내됨(월 135달러부터, 세금·계약 조건 별도 확인 필요) | NotebookLM 방식의 클라우드 자동화에 가장 가까우나 무료 조건에 맞지 않음 |
| 독립형 NotebookLM Podcast API | 설계상 클라우드 실행 가능 | Google이 2026년 5월 20일 기준 API 사용 중단 및 신규 고객 허용 중단을 안내 | 새 프로젝트의 기반으로 채택 불가 |
| Gemini API 등 다른 생성 서비스 | 서비스별로 가능 | NotebookLM과 같은 결과가 아니며 무료 할당량·품질·사용 조건을 별도 검증해야 함 | NotebookLM 결과와 비교 평가 후 대안으로만 검토 |

## 결론과 다음 결정

무료 개인용 NotebookLM을 그대로 유지하면서 컴퓨터가 꺼져 있을 때 완전 자동 생성·다운로드·게시까지 수행하는, Google이 지원하는 경로는 현재 확인되지 않았습니다. 따라서 PR47은 오디오 생성 자동화를 가장한 화면 조작을 넣지 않고, NotebookLM 파일의 사이트 게시 경로를 구현합니다.

완전 자동화가 필요하면 다음 중 하나를 선택해야 합니다.

1. NotebookLM Enterprise API와 클라우드 예약 실행 비용을 받아들입니다.
2. NotebookLM 대신 사용 가능한 Gemini API 같은 클라우드 생성 수단을 정하고, 무료 할당량과 오디오 품질을 확인합니다.
3. 생성은 개인용 NotebookLM에서 사람이 실행하고, 파일을 PR47 작업 화면에 올려 공개합니다.

외부 비용이나 Google Cloud 프로젝트를 자동으로 만들지는 않습니다. 비용이 발생하는 방식을 채택하기 전에는 제품·요금·사용 조건을 먼저 확정해야 합니다.

## 공식 참고 자료

- [Gemini Notebook에서 Audio Overview 생성·다운로드](https://support.google.com/gemininotebook/answer/16212820?hl=en)
- [Gemini Notebook Enterprise Audio Overview API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview)
- [Gemini Notebook Enterprise 요금 안내](https://cloud.google.com/gemini-enterprise/gemini-notebook)
- [독립형 Podcast API 안내 및 지원 종료 상태](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/podcast-api)
- [Codex 예약 작업과 로컬 컴퓨터 실행 조건](https://developers.openai.com/training/walkthroughs/scheduled-tasks)
