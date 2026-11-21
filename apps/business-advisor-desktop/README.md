# GlobalTrend 기업 개인정보 보호 도우미 데스크톱 앱

기업용 상담 도우미를 제공하는 별도 Electron 앱 시제품입니다. 사용자는 본인의 ChatGPT 계정으로 연결하고, 앱은 국제요정의 공개 법령 근거를 먼저 검색한 뒤 근거가 있을 때만 ChatGPT Responses API에 질문과 출처를 전달합니다.

## 실행

```sh
npm install
npm start
```

Windows 64비트 배포용 ZIP은 다음 명령으로 만들 수 있습니다.

```sh
npm run dist:win
```

결과는 `release/GlobalTrend-Business-Advisor-<version>-Windows-x64.zip`에 생성됩니다. 이 파일은 아직 코드 서명되지 않으며 Git에는 추가하지 않습니다. GitHub Actions는 `business-advisor-v<version>` 형식의 태그를 명시적으로 push할 때만 빌드하고 GitHub Release에 ZIP을 게시합니다. 공개 버전이 실제로 생긴 뒤 국제요정의 `/public/business-advisor-download` 페이지가 GitHub Releases API에서 파일을 찾아 다운로드 링크를 보여줍니다.

이 연결은 IeumOffice의 **Sign in with ChatGPT** 구조를 따릅니다. 사용자가 시스템 브라우저에서 이 로컬 앱을 ChatGPT 계정에 직접 허용하고, 앱은 자체 OAuth 토큰으로 OpenAI 공개 Responses API를 호출합니다. Codex 프로그램이나 CLI를 실행하지 않고, Codex 로그인 파일도 읽지 않습니다. Claude Code 구독 로그인과도 별도 경로이며 이 앱에는 포함하지 않았습니다.

OAuth 흐름(PKCE, state/nonce, 127.0.0.1 loopback 콜백, ID 토큰 검증, ChatGPT 요금제 권한 확인, 토큰 갱신·폐기)은 IeumOffice/OpenOffice의 Apache-2.0 구현에서 가져왔습니다. 이 앱은 Electron `safeStorage`를 이용해 OS 보안 저장소에 토큰을 봉인하며, 보안 저장소가 없거나 Linux의 `basic_text` backend면 연결을 거부합니다. 출처 및 라이선스는 `THIRD-PARTY-NOTICE.md`와 `third-party/`를 참고하세요.

질문은 먼저 공개 사이트의 근거 API로 전송됩니다. API는 현재 발행 중인 법령 자료에서 관련 조항을 검색하고 `published` 또는 `official`인 자료만 반환합니다. Electron main process는 반환된 근거가 있을 때에만 질문과 근거를 Responses API로 전송하고 `store: false`를 요청합니다. 근거가 없거나 API에 연결하지 못하면 모델에 질문을 보내지 않습니다. 답변은 `[1]` 형식으로 근거를 인용하고, 앱에는 공식 원문 링크를 함께 표시합니다. 이 플래그는 별도 개인정보 영향 검토를 대체하지 않습니다.

기본 근거 API 주소는 `https://globaltrend-six.vercel.app/api/business-advisor/evidence`입니다. Preview 배포를 시험할 때는 실행 전에 `GLOBALTREND_EVIDENCE_API_URL` 환경변수에 해당 배포의 `/api/business-advisor/evidence` 주소를 설정합니다. Responses API 모델 기본값은 `gpt-5-mini`이며, 바꾸려면 `GLOBALTREND_CHATGPT_MODEL` 환경변수에 계정에서 사용할 수 있는 모델 ID를 지정합니다.

웹 API는 공개 발행 자료용 Supabase 설정이 있어야 근거를 찾을 수 있습니다. 저장소 연결이 설정되지 않은 배포는 이유를 표시하고 질문에 대한 법률 답변 생성을 중단합니다. API 운영 환경이 올바른 프로젝트를 보고 있는지와 공개 자료가 들어있는지는 배포 뒤 별도로 확인해야 합니다.

## 아직 확인하지 않은 사항

- 실제 OpenAI 계정으로 로그인·동의·토큰 갱신·연결 해제를 끝까지 시험하지 않았습니다.
- 실제 계정이 구독 공유에 적격한지, 요청 모델이 사용 가능한지, 응답 형식이 현재 API와 맞는지 확인하지 않았습니다.
- 진단 질문지·진단 결과·상담 사례집은 아직 앱에 연결되지 않았습니다. 현재 근거 검색은 공개된 법령 자료뿐입니다.
- 공개 근거 API가 실제 운영 환경의 Supabase 설정과 발행 법령을 읽는지 실서비스에서 확인하지 않았습니다.
- 실제 모델 연결은 계정의 구독 자격, 허용 모델, 계정별 정책과 OpenAI 응답에 따라 달라집니다.
- 실제 ChatGPT 계정 연결을 검증하지 않았으며, 코드 서명과 자동 업데이트는 아직 없습니다.
- 배포 파이프라인과 웹 다운로드 화면은 추가했지만, 현재 GitHub Release에 앱 바이너리는 게시되어 있지 않습니다.

실제 로그인은 계정이 연결된 사용자가 앱에서 직접 실행해야 합니다. 로그인 없이 이 경로를 실계정에서 검증했다고 주장하지 않습니다.
