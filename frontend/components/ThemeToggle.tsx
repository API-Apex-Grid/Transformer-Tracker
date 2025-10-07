"use client";

import { useEffect, useState } from "react";

// Simple Sun/Moon icons (stroke-only) to avoid extra deps
const Sun = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const Moon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function ThemeToggle() {
  const getInitialTheme = () => {
    if (typeof window === "undefined") return false;
    if (document.documentElement.classList.contains("dark")) return true;
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  };

  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") {
        setIsDark(stored === "dark");
      } else {
        setIsDark(document.documentElement.classList.contains("dark"));
      }
    } catch {
      setIsDark(document.documentElement.classList.contains("dark"));
    } finally {
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!initialized || typeof window === "undefined") return;
    try {
      if (isDark) {
        document.documentElement.classList.add("dark");
        document.body.classList.remove("bg-white", "text-black");
        document.body.classList.add("bg-black", "text-white");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("bg-black", "text-white");
        document.body.classList.add("bg-white", "text-black");
        localStorage.setItem("theme", "light");
      }
    } catch {}
  }, [isDark, initialized]);

  return (
    <button
      onClick={() => setIsDark((v) => !v)}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md border-2 border-black text-black transition-colors hover:bg-black/5 dark:border-white dark:text-white dark:hover:bg-white/10"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
