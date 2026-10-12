"use client";
import Link from "next/link";
import { useState } from "react";
import styles from "./public.module.css";
import { usePublicTheme } from "./public-theme";

const entries = [["/public", "동향"], ["/public/weekly", "주간호"], ["/public/search", "동향 검색"], ["/public/laws", "국가별 법제"], ["/feedback", "피드백"]];
export function PublicHeader({ active }: { active: string }) {
  const { theme, toggleTheme } = usePublicTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className={styles.header}>
    <Link className={styles.brand} href="/public" aria-label="GlobalTrend 홈" onClick={() => setMenuOpen(false)}><span className={styles.brandText}>Global<span>Trend</span></span><small className={styles.brandTagline}>세계의 개인정보 보호 동향을 한눈에</small></Link>
    <div className={styles.mobileHeaderActions}>
      <Link href="/public/search" aria-label="동향 검색" className={styles.mobileSearch}>검색</Link>
      <button type="button" className={styles.mobileMenuButton} aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? "닫기" : "메뉴"}</button>
    </div>
    <nav id="public-navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} aria-label="주요 메뉴">{entries.map(([href, label]) => <Link key={href} href={href} className={active === href ? styles.navActive : ""} aria-current={active === href ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>)}</nav>
    <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={theme === "dark" ? "밝은 테마로 전환" : "어두운 테마로 전환"} aria-pressed={theme === "light"}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>{theme === "dark" ? "밝게" : "어둡게"}
    </button>
  </header>;
}
export function PublicFooter() {
  return <footer className={styles.footer}><Link href="/public">GlobalTrend</Link><p>글로벌 개인정보 보호 동향과 법제</p><Link href="/work">작업자용 페이지</Link><Link href="/team">검수 자료 보기</Link><Link href="/feedback">저장된 피드백</Link></footer>;
}
