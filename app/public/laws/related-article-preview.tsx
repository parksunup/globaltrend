"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import styles from "../public.module.css";

type Props = {
  citation: string;
  destination?: string;
  internal: boolean;
  text?: string;
  tooltipId: string;
};

export default function RelatedArticlePreview({ citation, destination, internal, text, tooltipId }: Props) {
  const trigger = useRef<HTMLAnchorElement | HTMLSpanElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const coarsePointer = () => window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const close = () => { cancelClose(); setPosition(null); };
  const show = () => {
    cancelClose();
    const bounds = trigger.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(380, window.innerWidth - 24);
    const maxHeight = Math.min(260, window.innerHeight - 24);
    const above = window.innerHeight - bounds.bottom < maxHeight + 16 && bounds.top > maxHeight + 16;
    setPosition({
      width,
      maxHeight,
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)),
      top: above ? undefined : Math.min(bounds.bottom + 8, window.innerHeight - maxHeight - 12),
      bottom: above ? window.innerHeight - bounds.top + 8 : undefined,
    });
  };
  const scheduleClose = () => {
    cancelClose();
    if (document.activeElement === trigger.current) return;
    closeTimer.current = setTimeout(() => setPosition(null), 150);
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  useEffect(() => {
    if (!position) return;
    const dismiss = (event?: Event) => {
      if (event?.target instanceof Element && event.target.closest('[role="tooltip"]')) return;
      setPosition(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [position]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const events = {
    onMouseEnter: show,
    onMouseLeave: scheduleClose,
    onFocus: show,
    onBlur: close,
    "aria-describedby": position ? tooltipId : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement | HTMLSpanElement>) => {
      if (!coarsePointer()) return;
      event.preventDefault(); close(); setMobileOpen(true);
    },
  };
  return <div className={styles.articleReference}>
    {destination ? internal
      ? <Link href={destination} ref={(node) => { trigger.current = node; }} {...events}>{citation}</Link>
      : <a href={destination} target="_blank" rel="noopener noreferrer" ref={(node) => { trigger.current = node; }} {...events}>{citation}</a>
      : <span tabIndex={0} ref={(node) => { trigger.current = node; }} {...events}>{citation}</span>}
    {mobileOpen && <div className={styles.articleSheetBackdrop} onClick={() => setMobileOpen(false)}>
      <div className={styles.articleSheet} role="dialog" aria-modal="true" aria-label={`${citation} 조문 미리보기`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.articleSheetHeader}><strong>{citation} · {text ? "한국어 번역 일부" : "조문 미리보기 준비 중"}</strong><button type="button" onClick={() => setMobileOpen(false)} aria-label="조문 미리보기 닫기">닫기</button></div>
        <p>{text ?? "해당 조문의 한국어 전문이 아직 등록되지 않았습니다. 공식 원문에서 확인해 주세요."}</p>
        <small>{text ? "공식 원문과 함께 확인해 주세요." : "원문을 확인해 주세요."}</small>
        {destination && <div className={styles.articleSheetActions}>{internal ? <Link href={destination} onClick={() => setMobileOpen(false)}>전문에서 보기 →</Link> : <a href={destination} target="_blank" rel="noopener noreferrer" onClick={() => setMobileOpen(false)}>공식 원문 보기 ↗</a>}</div>}
      </div>
    </div>}
    {position && <div className={styles.articleTooltip} style={position} id={tooltipId} role="tooltip"
      onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <strong>{citation} · {text ? "한국어 번역 일부" : "조문 미리보기 준비 중"}</strong>
      <p>{text ?? "해당 조문의 한국어 전문이 아직 등록되지 않았습니다. 공식 원문에서 확인해 주세요."}</p>
      <small>{text ? "클릭하면 해당 조문으로 이동" : destination ? "클릭하면 공식 원문으로 이동" : "공식 원문 링크도 확인이 필요합니다."}</small>
    </div>}
  </div>;
}
