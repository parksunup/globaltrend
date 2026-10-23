"use client";

import {useEffect, useState} from "react";

type Turn = {speaker: "Mina" | "Joon"; text: string};
type PreviewStyles = Record<string, string>;

export default function PodcastPreview({
  turns,
  styles,
}: {
  turns: Turn[];
  styles: PreviewStyles;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/podcast/sample", {method: "POST"});
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "음성 생성에 실패했습니다.");
      }
      const blob = await response.blob();
      if (!blob.type.startsWith("audio/")) {
        throw new Error("오디오 파일을 받지 못했습니다.");
      }
      setUrl(URL.createObjectURL(blob));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.body} aria-label="팟캐스트 제작 테스트">
      <div className={styles.actions}>
        <button
          className={styles.generate}
          onClick={generate}
          disabled={busy}
          type="button"
        >
          {busy ? "음성 만드는 중…" : url ? "다시 만들기" : "예시 음성 만들기"}
        </button>
        <span className={styles.help}>
          버튼을 누르면 미리 작성된 대본을 두 화자의 음성으로 합성합니다.
          생성 결과는 이 화면에서만 재생됩니다.
        </span>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {url && (
        <audio
          className={styles.player}
          controls
          preload="metadata"
          src={url}
          aria-label="생성된 팟캐스트 음성"
        />
      )}

      <div className={styles.transcript}>
        <h2>대본 미리보기</h2>
        {turns.map((turn, index) => (
          <article className={styles.turn} key={index}>
            <strong className={styles.speaker}>
              {turn.speaker === "Mina" ? "진행자 1" : "진행자 2"}
            </strong>
            <p>{turn.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
