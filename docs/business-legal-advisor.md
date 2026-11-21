# 기업 개인정보 보호 도우미 앱

## 사용자가 원하는 방식

국제요정에서 앱을 내려받아 실행하고, 질문을 살펴본 뒤 자기 ChatGPT 계정을 연결해 사용하는 데스크톱 앱입니다. ChatGPT 프로그램 설치는 필요하지 않습니다. 계정 연결은 시스템 브라우저에서 사용자가 직접 승인합니다. 앱은 이용자의 ChatGPT 연결로 모델에 질문하고, 공개된 법제 자료와 상담 사례를 근거로 답변과 출처를 보여줍니다.

## 이음오피스에서 가져온 연결 구조

이음오피스 저장소 `pblsketch/openoffice`의 직접 ChatGPT 연결 모듈을 기준으로 합니다. 해당 구현은 Apache-2.0 라이선스이며, 상류 커밋은 `92e0022e98d2cfb0734ec381d8b32a3274fb055f`입니다.

- OAuth PKCE와 state/nonce 검증
- 시스템 브라우저에서 ChatGPT 계정 승인
- 로컬 `127.0.0.1` 콜백으로 앱 복귀
- ID 토큰 서명·발급자·대상 확인
- 갱신·연결 해제·접근권한 거부 처리
- 이용자 계정 권한을 사용해 공개 Responses API 호출

상류의 `oauth.ts`, `connection.ts`, `credentials.ts`를 앱의 `src/vendor/ieumoffice-chatgpt/`로 가져오고 라이선스·NOTICE를 함께 보관합니다. Electron main process가 연결 토큰과 API 요청을 관리하고, renderer에는 필요한 IPC만 노출합니다. 토큰은 Electron `safeStorage`로 OS 보안 저장소에 봉인하며 안전한 저장소를 쓸 수 없으면 연결을 시작하지 않습니다. Codex 로그인 파일이나 브라우저 쿠키는 읽지 않습니다.

## 현재 구현 상태

- 앱 위치: `apps/business-advisor-desktop/`
- 로컬 앱 빌드와 실행 명령은 해당 폴더의 README를 따릅니다.
- OAuth 화면, 연결 상태, 연결 해제, 질문 UI와 Responses API 호출을 구현했습니다.
- `store: false`로 요청하지만, 이것만으로 앱 전체의 개인정보 처리 검토가 완료되는 것은 아닙니다.
- 사람 검수 완료된 7개 법제 번역을 자가진단 데이터와 연결했습니다. 새로 만든 자가진단 질문·조항 간 연결은 별도로 검토할 항목입니다.
- **법제 근거를 답변에 붙이는 연결**은 앱이 발행 자료를 읽고, 선택된 관할의 근거를 질문과 함께 보내고, 답변에 인용을 표시하는 작업입니다. 근거를 찾지 못하면 법률 답변 생성으로 넘어가지 않아야 합니다.
- 공개 상담 사례집은 현재 저장소에서 이용 가능한 자료를 확인해야 합니다. 이용할 수 있는 사례집이 없으면 법령 설명과 사례집을 이미 학습했다고 말하지 않습니다.
- Windows x64 ZIP 패키징과 `business-advisor-v*` 태그 기반 GitHub Release 자동 게시 workflow를 추가했습니다. 국제요정 다운로드 페이지도 실제 공개 Release asset만 표시하도록 연결했습니다.
- 현재 공개 Release asset은 아직 없으므로 웹사이트에서 내려받을 파일은 없습니다. 앱 PR 검토·병합 후 버전 태그를 발행하면 workflow가 ZIP을 올리고 다운로드 페이지가 링크를 표시합니다.
- 실제 사용자 계정으로 로그인·권한 동의·요청·토큰 만료/폐기까지 끝까지 확인하기 전에는 실계정 연결 완료라고 표시하지 않습니다. 설치파일도 아직 코드 서명되지 않았습니다.

## 자료 기반 응답 원칙

1. 사용자가 선택한 국가·주제에 맞는 발행된 공식 법령, 공개 설명자료와 이용 가능한 상담 사례를 찾습니다.
2. 모델에 보내는 근거에는 제목, 기관·관할, 판본·게시일, 조항·문단 위치, 원문 링크를 포함합니다.
3. 답변은 근거의 적용 범위 안에서 작성하고, 사실관계가 달라지면 결과가 달라지는 부분을 분리합니다.
4. 인용한 각 근거를 사용자가 직접 열어 볼 수 있게 표시합니다.
5. 근거가 없거나 연결 서비스가 실패하면 근거 없음 상태를 알리고 법률 답변을 만들어내지 않습니다.
6. 사용자가 입력한 상담 내용을 로그에 남기지 않습니다. 저장이 필요하면 그 동의·보유기간·삭제 방법을 별도로 설계합니다.

## 자료 출처 및 공식 문서

- [IeumOffice/OpenOffice 소스 저장소](https://github.com/pblsketch/openoffice)
- [OpenAI Sign in with ChatGPT 안내](https://developers.openai.com/siwc/quickstart)
- [오픈소스 앱에서 ChatGPT plan 사용](https://developers.openai.com/siwc/token-sharing-open-source)
- [Sign in with ChatGPT의 오픈소스 통합 안내](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [OpenAI 앱 사용 및 연결 안내](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites)

