# 주간 팟캐스트 제작 테스트

경로: `/public/weekly/podcast-preview` (제작 테스트 전용)

현재 동작은 예시 주간 동향 7건에서 대본을 구성하고, Gemini TTS에 대본을 그대로 전달해 두 화자의 WAV 음성을 생성합니다. Gemini는 사실 요약이나 대본 작성에 사용하지 않습니다. 생성 버튼을 눌렀을 때만 한 번 요청합니다. 실제 주간호·공개 목록·저장소에는 게시하지 않습니다.

## 무료 사용 조건

1. Google AI Studio에서 Gemini API 키를 만들고, **결제 계정을 연결하지 않은 무료 프로젝트 키**만 사용합니다.
2. Vercel Preview 환경변수에 `GEMINI_API_KEY`를 등록합니다. 키를 브라우저 코드나 Git에 넣지 마세요.
3. `gemini-3.8-flash-lite-tts`가 해당 프로젝트의 무료 등급에서 활성화됐는지 AI Studio의 모델/사용량 화면에서 확인합니다.
4. 무료 한도 초과(429), 접근 거부(403), 네트워크 오류는 멈추며 유료 모델·유료 프로젝트로 재시도하지 않습니다.

Gemini API의 무료/유료 등급은 프로젝트의 결제 설정에 따라 달라집니다. 애플리케이션 API만으로 결제 연결 여부나 Google 측 무료 quota 잔량을 확정할 수 없으므로, 결제 계정이 붙은 키는 이 기능에 사용하지 마세요. 무료 프로젝트 키가 없으면 대본만 확인하고 음성을 만들지 않는 것이 비용을 보장하는 방법입니다.

공식 문서: https://ai.google.dev/gemini-api/docs/speech-generation · https://ai.google.dev/gemini-api/docs/pricing · https://ai.google.dev/gemini-api/docs/rate-limits
