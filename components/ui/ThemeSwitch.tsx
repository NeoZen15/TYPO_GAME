"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "jdt-theme";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "dark" || value === "light";

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(stored)) return stored;

    const currentTheme = document.documentElement.dataset.theme ?? null;
    if (isThemeMode(currentTheme)) return currentTheme;

    return "dark";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  const targetLabel = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-switch"
      data-theme={theme}
      aria-label={`Switch to ${targetLabel} mode`}
      onClick={toggleTheme}
    >
      <span className="theme-switch__track" aria-hidden="true">
        <span className="theme-switch__thumb" />
      </span>
    </button>
  );
}
