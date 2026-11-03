"use client";

import { useEffect, useState } from "react";
import styles from "./public.module.css";

type Counts = { today: number; total: number; day: string };

export default function HomeVisitorCounts() {
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/visitors", { method: "POST", cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Counts> : null)
      .then((value) => { if (value) setCounts(value); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <div className={styles.visitorCounts} aria-label="방문자 수" aria-live="polite">
    <span>오늘 방문자 <strong>{counts?.today.toLocaleString("ko-KR") ?? "—"}</strong></span>
    <span>전체 방문자 <strong>{counts?.total.toLocaleString("ko-KR") ?? "—"}</strong></span>
    <small>브라우저 기준 · 한국시간 · 집계 시작 이후</small>
  </div>;
}
