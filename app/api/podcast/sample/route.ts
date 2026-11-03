import {NextResponse} from "next/server";
import {buildWeeklyPodcastScript} from "../../../../lib/weekly-podcast-script";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.GEMINI_API_FREE_TIER_CONFIRMED !== "true") {
    return NextResponse.json(
      {error: "무료 등급 사용을 확인한 뒤 음성 생성을 활성화해 주세요."},
      {status: 503},
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {error: "GEMINI_API_KEY를 설정해야 음성을 만들 수 있습니다."},
      {status: 503},
    );
  }

  const {turns} = buildWeeklyPodcastScript();
  const input = turns.map(turn => ({
    type: "text",
    text: turn.text,
    annotations: [{
      type: "speech_metadata",
      speaker: turn.speaker,
      style: turn.speaker === "Mina"
        ? "호기심 있고 또렷한 한국어 진행자. 청자의 질문을 짧고 자연스럽게 던지며, 따뜻하지만 과장하지 않는다."
        : "차분하고 편안한 한국어 분석 진행자. 결론을 먼저 말하고 근거와 한계를 풀어 설명하며, 지나치게 강의하듯 말하지 않는다.",
    }],
  }));

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash-lite-tts",
          input: [{type: "user_input", content: input}],
          response_format: {type: "audio"},
          generation_config: {
            speech_config: {
              mode: "conversational",
              speakers: [
                {speaker: "Mina", voice: "Kore"},
                {speaker: "Joon", voice: "Puck"},
              ],
            },
          },
        }),
        signal: AbortSignal.timeout(90000),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      const limited = response.status === 429 || response.status === 403;
      return NextResponse.json(
        {
          error: limited
            ? "Gemini 무료 사용 한도 또는 접근 조건에 도달했습니다. 유료 호출은 하지 않았습니다."
            : `음성 생성 실패 (HTTP ${response.status})`,
        },
        {status: limited ? 429 : 502},
      );
    }

    const audio = payload.steps
      ?.flatMap((step: {content?: Array<{type?: string; data?: string}>}) => step.content ?? [])
      .filter((part: {type?: string}) => part.type === "audio")
      .at(-1)?.data;

    if (!audio) {
      return NextResponse.json(
        {error: "Gemini 응답에서 오디오를 찾지 못했습니다."},
        {status: 502},
      );
    }

    return new NextResponse(Buffer.from(audio, "base64"), {
      headers: {
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "content-disposition": 'inline; filename="weekly-podcast-sample.wav"',
      },
    });
  } catch {
    return NextResponse.json(
      {error: "음성 생성에 연결하지 못했습니다. 유료 대체 호출은 실행하지 않았습니다."},
      {status: 502},
    );
  }
}
