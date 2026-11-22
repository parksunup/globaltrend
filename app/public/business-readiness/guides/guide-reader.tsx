"use client";

import { useEffect, useMemo, useState } from "react";
import guideCatalog from "../../../../data/business-readiness/guides-content.json";
import MarkdownContent from "../markdown-content";
import styles from "./guides.module.css";

type Guide = { code: string; label: string; title: string; officialUrl: string; markdown: string; sections: Array<{ id: string; title: string; markdown: string }> };
const guides = guideCatalog as Record<string, Guide>;

export default function GuideReader() {
  const [code, setCode] = useState("JP");
  const guide = guides[code] ?? guides.JP;
  const idMap = useMemo(() => Object.fromEntries(guide.sections.map(section => [section.title.replace(/\*\*/g, "").trim(), section.id])), [guide]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("country");
    if (requested && guides[requested]) setCode(requested);
  }, []);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start", behavior: "smooth" }), 160);
  }, [code]);

  function selectGuide(next: string) {
    if (!guides[next]) return;
    setCode(next);
    window.history.replaceState(null, "", `${window.location.pathname}?country=${encodeURIComponent(next)}`);
  }

  return <>
    <nav className={styles.countryMenu} aria-label="국가별 안내서 선택">
      {Object.values(guides).map(item => <button type="button" key={item.code} className={code === item.code ? styles.countryActive : ""} aria-pressed={code === item.code} onClick={() => selectGuide(item.code)}>{item.label}</button>)}
    </nav>
    <article className={styles.guide}>
      <div className={styles.guideHeading}><div><p className={styles.kicker}>{guide.label} · BUSINESS GUIDE</p><h2>{guide.title}</h2></div><a href={guide.officialUrl} target="_blank" rel="noreferrer">공식 원문 ↗</a></div>
      <div className={styles.scopeNote}>국가별 안내서의 한국어 학습본입니다. 개인정보보호위원회나 해당 해외 감독기구의 공식 유권해석·공식 번역 또는 법률 자문이 아닙니다. 최신 원문과 실제 상황을 확인하고 이에 따른 판단과 조치를 할 책임은 이용자에게 있습니다. 적용 범위와 기준일을 본문에서 확인해 주세요.</div>
      <MarkdownContent markdown={guide.markdown} idMap={idMap} className={styles.markdown} />
    </article>
  </>;
}
