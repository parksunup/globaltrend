"use client";

import { createContext, useContext, useEffect, useState } from "react";
import styles from "./public.module.css";

type Theme = "dark" | "light";
const STORAGE_KEY = "globaltrend-public-theme";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export function PublicThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "light") setTheme("light");
    } catch {
      // The theme still works for this visit when storage is unavailable.
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Storage is optional. */ }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>
    <div className={`${styles.themeRoot} ${theme === "light" ? styles.themeLight : ""}`}>{children}</div>
  </ThemeContext.Provider>;
}

export function usePublicTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("PublicThemeProvider is missing");
  return value;
}
