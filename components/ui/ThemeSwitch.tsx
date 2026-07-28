"use client";

import { useEffect, useSyncExternalStore } from "react";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "jdt-theme";
const DEFAULT_THEME: ThemeMode = "dark";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "dark" || value === "light";

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

// The theme is read as an external store, not from a useState initialiser. The
// naive version read window.localStorage while building the first state, so the
// server rendered "dark" while a visitor with a light theme stored rendered
// "light" at the same hydration instant, on this button's data-theme and on its
// aria-label. suppressHydrationWarning sits on <html> (app/layout.tsx) and does
// not cover this button, and putting it here would hide the defect instead of
// fixing it. Same pattern and same reason as the reduced motion preference in
// features/profile/components/ProgressBoard.tsx: getServerSnapshot answers during
// server render and during hydration, then the client snapshot is read.
//
// localStorage is not observable inside the tab that writes to it, the storage
// event only fires in the other tabs, so the toggle notifies the listeners
// itself. The cached value keeps the store as the single source of truth instead
// of a second copy of the theme in local state.
const listeners = new Set<() => void>();

let currentTheme: ThemeMode | null = null;

const readTheme = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // Storage can throw in a locked down browser. The applied theme still wins.
  }

  const applied = document.documentElement.dataset.theme ?? null;
  return isThemeMode(applied) ? applied : DEFAULT_THEME;
};

const subscribeTheme = (onStoreChange: () => void) => {
  const onStorage = () => {
    currentTheme = readTheme();
    onStoreChange();
  };

  listeners.add(onStoreChange);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
};

const getThemeSnapshot = (): ThemeMode => {
  currentTheme ??= readTheme();
  return currentTheme;
};

const getThemeServerSnapshot = (): ThemeMode => DEFAULT_THEME;

const setTheme = (theme: ThemeMode) => {
  currentTheme = theme;

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice still applies to this page view, it just is not remembered.
  }

  listeners.forEach((listener) => listener());
};

export default function ThemeSwitch() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  useEffect(() => {
    // During hydration the store deliberately answers with the server snapshot,
    // so writing it to the document here would flip a light page to dark for one
    // frame. The bootstrap script of app/layout.tsx has already applied the
    // stored theme, so only a value that matches the live store is written back.
    if (getThemeSnapshot() !== theme) return;

    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
