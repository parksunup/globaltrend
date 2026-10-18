"use client";

import { useMemo, useState } from "react";
import styles from "./draft-viewer.module.css";

type Bundle = { comparisonHtml: string; translationHtml: string; archiveBase64: string };
type Manifest = { format: string; salt: string; iv: string; iterations: number; ciphertext: string; ciphertextSha256: string };
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");

function embeddedDocument(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  let hasOfflineLinks = false;
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#") || /^https?:\/\//i.test(href)) return;
    const label = document.createElement("span");
    label.textContent = link.textContent;
    label.title = "전체 파일을 내려받아 확인해 주세요.";
    link.replaceWith(label);
    hasOfflineLinks = true;
  });
  if (hasOfflineLinks) {
    const note = document.createElement("p");
    note.textContent = "CSV·Markdown·참고 문서는 상단의 ‘전체 파일 다운로드’를 눌러 확인해 주세요.";
    document.body.prepend(note);
  }
  return "<!doctype html>" + document.documentElement.outerHTML;
}

export default function DraftViewer() {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"comparison" | "translation">("comparison");
  const source = useMemo(() => bundle ? embeddedDocument(view === "comparison" ? bundle.comparisonHtml : bundle.translationHtml) : "", [bundle, view]);

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!file || file.size > 8 * 1024 * 1024) throw new Error("load");
      const manifest: Manifest = JSON.parse(await file.text());
      if (manifest.format !== "legal-review-bundle-v1" || manifest.iterations !== 310000) throw new Error("load");
      const ciphertext = decode(manifest.ciphertext);
      if (hex(await crypto.subtle.digest("SHA-256", ciphertext)) !== manifest.ciphertextSha256) throw new Error("load");
      const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: decode(manifest.salt), iterations: manifest.iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      const compressed = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(manifest.iv) }, key, ciphertext);
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
      const data: Bundle = JSON.parse(await new Response(stream).text());
      if (!data.comparisonHtml || !data.translationHtml || !data.archiveBase64) throw new Error("load");
      setBundle(data); setPassword("");
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "load" ? "자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : "열람 암호가 맞는지 확인해 주세요. 최신 브라우저에서 다시 시도할 수 있습니다.");
    } finally { setBusy(false); }
  }

  function download() {
    if (!bundle) return;
    const url = URL.createObjectURL(new Blob([decode(bundle.archiveBase64)], { type: "application/zip" }));
    const link = document.createElement("a"); link.href = url; link.download = "legal-comparison-drafts-20261014.zip"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/">← 제출물 검수로 돌아가기</a>
      <h1>최신 법제 비교와 GDPR 번역 초안</h1>
      <p>2026년 10월 14일 · 7법제 × 17기준 비교 119셀 · GDPR 99조와 고려사항 173개</p>
      <p>공동 작업 검토용 초안입니다. 사람 검수는 미착수이며, 미확인 판본·조건은 자료에 표시되어 있습니다.</p>
    </header>
    {!bundle ? <form onSubmit={unlock} className={styles.unlock}>
      <label htmlFor="draft-file">전달받은 초안 파일</label>
      <input id="draft-file" type="file" accept=".json" required disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <label htmlFor="draft-password">열람 암호</label>
      <input id="draft-password" type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
      <button disabled={busy}>{busy ? "자료를 여는 중…" : "초안 열기"}</button>
      <p>비공개로 전달받은 초안 파일과 열람 암호를 사용해 주세요. 선택한 파일과 암호는 서버로 전송하지 않습니다.</p>
      {error && <p role="alert">{error}</p>}
    </form> : <>
      <nav className={styles.controls} aria-label="초안 선택">
        <button aria-pressed={view === "comparison"} onClick={() => setView("comparison")}>전체 119셀 비교표</button>
        <button aria-pressed={view === "translation"} onClick={() => setView("translation")}>GDPR 번역 전문</button>
        <button onClick={download}>전체 파일 다운로드</button>
        <button onClick={() => { setBundle(null); setView("comparison"); }}>열람 종료</button>
      </nav>
      <iframe className={styles.document} title={view === "comparison" ? "전체 법제 비교 초안" : "GDPR 한국어 번역 초안"} srcDoc={source} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
    </>}
  </main>;
}
