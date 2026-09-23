import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "ats-app-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore storage access errors (private browsing, etc.)
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// The toggle now lives in the page header, so it mounts and unmounts with
// each route. Keeping the theme in one module-level store (rather than per
// component state) means every toggle reads the same value and the attribute
// is applied once, at import time, instead of after the first render.
let current: Theme = getInitialTheme();
const listeners = new Set<() => void>();

function apply(theme: Theme) {
  current = theme;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage access errors
  }
  listeners.forEach((fn) => fn());
}

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-theme", current);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );

  const toggleTheme = useCallback(() => {
    apply(current === "light" ? "dark" : "light");
  }, []);

  return { theme, toggleTheme };
}
