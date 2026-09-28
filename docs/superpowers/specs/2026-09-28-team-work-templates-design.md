# 팀 업무 양식과 제출 검증 설계

## 목적

법제 담당과 동향 담당이 각자 작업 브랜치에서 같은 형식으로 조사 결과를 작성하고, 프로젝트 리드가 Pull Request에서 빠진 내용과 작업 범위를 쉽게 확인할 수 있게 한다.

이번 작업은 실제 법제·동향 내용을 작성하거나 Supabase에 입력하는 작업이 아니다. 담당자가 사용할 빈 양식, 제출 안내, 자동 검사와 문서·웹 온보딩 안내를 만드는 작업이다.

## 작업 순서

1. 프로젝트 리드가 `team-work-templates` 브랜치에서 공용 양식과 자동 검사를 만든다.
2. 이 작업을 `main`에 반영한다.
3. 법제 담당은 최신 `main`에서 `feat/legal-corpus-foundation` 브랜치를 만든다.
4. 동향 담당은 최신 `main`에서 `feat/trend-source-contracts` 브랜치를 만든다.
5. 두 담당자는 정해진 폴더만 수정하고 각각 Pull Request를 만든다.
6. 프로젝트 리드가 공식 근거, 검토 필요 항목과 자동 검사 결과를 확인한 뒤 병합한다.

## 저장소 구조

```text
data/
├── README.md
├── legal/
│   ├── README.md
│   ├── instruments.template.md
│   ├── instruments.template.csv
│   └── review-notes.template.md
└── trends/
    ├── README.md
    ├── source-configs/
    │   ├── source.template.md
    │   └── source.template.json
    └── review-notes.template.md

scripts/
└── validate-team-data.mjs

.github/
├── ISSUE_TEMPLATE/
│   ├── legal-research.yml
│   └── trend-research.yml
├── pull_request_template.md
└── workflows/
    └── ci.yml
```

템플릿 파일에는 실제 조사 결과를 넣지 않는다. 어떤 값을 어디에 적는지만 알 수 있는 명백한 예시와 `검토 필요` 상태만 넣는다.

## 담당자 결과물

### 법제 담당

법제 담당은 `data/legal/` 아래에 다음 결과를 작성한다.

- `instruments.md`: 사람이 읽는 법제 조사표
- `instruments.csv`: 조사표와 같은 내용을 담은 구조화 데이터
- `review-notes.md`: 이용·재배포 조건, 확인 방법과 불확실성

법률마다 고유 ID, 관할권, 공식·통용 법률명, 공식 원문 URL, 판본·시행일, 기존 한국어 번역과 출처, 이용조건 확인 상태, 검수 상태를 기록한다.

### 동향 담당

동향 담당은 `data/trends/source-configs/` 아래에 출처별 Markdown과 JSON을 작성하고, `data/trends/review-notes.md`에 확인·제외·실패 사유를 기록한다.

출처마다 고유 ID, 기관명, 공식 시작 URL, 자료 유형, 확인된 수집 방식, 제목·게시일·본문 확인 방법, 제외 대상, 이용조건 확인 상태, 표본 URL과 검수 상태를 기록한다.

## 상태 표현

확인하지 않은 내용을 임의로 채우지 않는다. 공통 검수 상태는 다음 네 가지를 사용한다.

- `unreviewed`: 아직 확인하지 않음
- `in_review`: 확인 중
- `verified`: 공식 근거로 확인함
- `blocked`: 이용조건이나 접근 문제로 진행 보류

사람이 읽는 Markdown에는 위 상태와 함께 쉬운 한국어 설명을 표시한다. 날짜나 판본을 확인하지 못했으면 값을 만들어 넣지 않고 검토 메모에 이유를 적는다.

## 자동 검사

`pnpm validate:data`는 다음을 검사한다.

- 필수 결과 파일이 함께 존재하는지
- CSV·JSON에 필수 필드가 있는지
- 고유 ID가 중복되지 않는지
- URL이 `https://` 형식인지
- 상태값이 정해진 네 가지 중 하나인지
- 담당자가 허용된 `data/legal/` 또는 `data/trends/` 범위에 결과를 작성했는지 안내와 일치하는지

외부 사이트에 실제로 접속하는 검사는 CI에서 하지 않는다. 공식성, 법적 내용과 이용조건 판단은 사람이 검토한다.

## GitHub 자동 검증

Pull Request에서는 다음 명령을 실행한다.

- 의존성 고정 설치
- TypeScript 검사
- Next.js 빌드
- 팀 데이터 검사

Issue 양식은 담당 범위, 결과 파일과 완료 조건을 미리 보여준다. PR 양식은 변경 파일, 확인한 공식 URL, 검토 필요 항목과 실행한 검증을 적게 한다.

## 문서와 웹 안내 동기화

다음 네 곳에 같은 작업 순서를 쉬운 말로 반영한다.

- `README.md`
- `architecture.md`
- `docs/team-onboarding.md`
- 배포되는 `/guide` 페이지인 `app/guide/page.tsx`

문서에는 리드 작업이 `main`에 반영된 뒤 담당자 브랜치를 만든다는 순서를 명시한다. 법제 담당과 동향 담당은 서로의 브랜치나 앱·Supabase·인증·환경변수를 수정하지 않는다.

## 이번 작업에서 제외하는 것

- 실제 법률·번역·동향 조사 결과
- Supabase schema나 seed 변경
- 수집기와 예약 실행
- Codex 초안 자동화
- `/team` 입력·승인 기능
- 검색과 주간호 발행

위 기능은 담당자의 첫 조사 결과와 이번 양식의 실제 사용 결과를 확인한 뒤 별도 단계에서 설계한다.

## 완료 조건

- 두 담당자가 템플릿을 복사하여 첫 작업을 시작할 수 있다.
- 잘못된 구조의 CSV·JSON은 로컬 검사와 Pull Request 검사에서 실패한다.
- 기존 Next.js 앱의 타입 검사와 빌드가 통과한다.
- README, 설계 문서, 온보딩 문서와 배포용 가이드가 같은 브랜치·제출 절차를 안내한다.
- Supabase와 기존 데이터는 변경되지 않는다.
