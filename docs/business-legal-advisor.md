# 기업 개인정보 상담 앱

## 사용자가 원하는 방식

사용자는 국제요정 사이트에서 앱을 내려받고, 자기 ChatGPT 계정을 연결한 뒤 궁금한 점을 자유롭게 물어봅니다. 앱은 **검색결과를 나열하는 통합검색 서비스가 아닙니다.** 국제요정의 질문은행·기업 안내서·상담사례·공개 법제 및 동향 자료를 내부에서 찾아, 사용자의 현재 질문과 대화 흐름에 맞게 자연어로 답하는 상담 앱입니다. 매 답변마다 웹 검색을 기본으로 실행해 최신 자료도 함께 확인합니다.

## 현재 구현

- 앱 위치: `apps/business-advisor-desktop/`
- 대화 UI는 국가 선택을 선행조건으로 두지 않고, 사용자가 지역·상황을 문장에 적어 이어서 묻습니다.
- 연결된 계정의 모델 목록을 불러와 선택할 수 있으며, Responses API 요청은 `store: false`로 보냅니다.
- 웹 검색은 매 답변의 기본 과정입니다. 연결 계정이나 선택한 모델에서 웹 검색을 지원하지 않으면 내부 자료만으로 자동 대체하지 않고, 웹 검색이 가능한 설정으로 다시 연결하도록 오류를 안내합니다.
- 자가점검 결과 화면에서 사용자가 상담 버튼을 누르면 선택 지역의 답변 수와 보완 항목만 딥링크로 데스크톱 앱에 전달합니다. 결과는 사이트 DB에 저장하지 않고 앱 실행 중 메모리에서만 보관합니다. 준비 완료 답변과 ‘해당 없음’ 사유는 전송하지 않습니다.
- 답변 아래에 웹 인용과 해당 국제요정 자료 인용을 따로 보여주며, 참고한 발췌도 열어볼 수 있습니다.
- 대화 이력은 앱 실행 중 메모리에만 있습니다. 사이트 DB나 앱 서버에 저장하지 않습니다.
- API는 답변 생성을 위한 내부 자료 조회만 합니다. 팀 작업실의 비공개·미발행 자료에는 접근하지 않습니다.
- 자료범위와 답변 흐름은 [`business-advisor/conversation-app.md`](business-advisor/conversation-app.md)에 정리했습니다.

## 상담에 연결된 자료

`/api/business-advisor/chat-context`에서 다음 자료 전체를 내부 검색 대상으로 사용합니다.

1. 일본·중국·EU·영국·캘리포니아·싱가포르 6개 관할의 자가점검 질문은행(현재 129개 문항).
2. `docs/business-advisor/guides/`의 관할별 기업 안내서 6개.
3. `docs/business-advisor/references/`에 보존한 사용자 제공 PDF 3종의 전체 Markdown 변환본: 중국 기업 규제대응 안내서, EU GDPR 안내서, 해외 개인정보보호 상담사례집.
4. `docs/jurisdiction-specific-self-assessments-2026-11.md`의 질문 설계와 공통 범주 누락 점검 기록.
5. `loadPublicSearchCorpus()`가 제공하는 공개 동향, 발행 법제 번역, 발행된 법제 비교 자료.

정적 자료는 배포 파일 추적 목록에 명시해 서버리스 API에서도 읽을 수 있게 했습니다. 공개 DB에 연결할 수 없을 때도 저장소에 포함된 안내서·자가점검·PDF 변환본으로 대화를 이어가며, 발행 자료 연결이 끊긴 상태를 답변 아래에 알립니다. 정적 원문 파일이 빠진 경우에는 일부만 조용히 건너뛰지 않고 API 오류로 처리합니다.

## 계정 연결과 개인정보

이음오피스/OpenOffice의 Apache-2.0 Sign in with ChatGPT 연결을 바탕으로 OAuth PKCE, state/nonce 검증, 로컬 loopback 콜백, 토큰 갱신과 폐기를 사용합니다. 토큰은 Electron `safeStorage`로 OS 보안 저장소에 보호합니다. 앱은 비밀번호·브라우저 쿠키·Codex 로그인 파일을 읽지 않습니다. 원본과 라이선스 고지는 `apps/business-advisor-desktop/THIRD-PARTY-NOTICE.md`와 `third-party/`를 확인하세요.

사용자가 입력한 질문·대화 맥락·관련 발췌문은 답변 생성을 위해 사용자의 ChatGPT 연결로 전송됩니다. `store: false`는 요청 저장 옵션이며, OpenAI의 계정·요금제·데이터 처리 조건 전체를 대체하지 않습니다. 로그인 연결, 실제 계정 모델 사용, 웹 검색 허용 여부는 계정·조직·모델 정책에 따라 다를 수 있습니다.

## 공개·검증 상태

- Windows 앱 빌드와 Next.js 프로덕션 빌드·타입검사를 확인했습니다.
- 실제 ChatGPT 사용자 계정 로그인, 대화 응답, 모델 사용, 웹 검색 성공 여부는 계정이 연결된 실환경에서 아직 확인하지 않았습니다. 실계정 동작까지 검증했다고 주장하지 않습니다.
- 코드 서명된 Windows 설치파일 또는 공개 GitHub Release는 아직 만들지 않았습니다. 기존 다운로드 페이지는 실제 Release ZIP이 생길 때만 다운로드 링크를 노출합니다.
- ChatGPT 연결 전에는 질문을 보낼 수 없습니다. 연결을 위해 시스템 브라우저에서 사용자가 로그인·승인을 해야 합니다.
- 답변은 참고용 일반 정보이며 법률 자문·법적 준수 판정·인증이 아닙니다. 인용된 공식 원문과 시행 시점을 확인해야 합니다.

## 관련 설계 문서와 공식 출처

- [`docs/business-advisor/conversation-app.md`](business-advisor/conversation-app.md)
- [`docs/jurisdiction-specific-self-assessments-2026-11.md`](jurisdiction-specific-self-assessments-2026-11.md)
- [OpenAI Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart)
- [OpenAI Sign in with ChatGPT: models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [OpenAI Help: Using your ChatGPT plan in other apps and sites](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites)
