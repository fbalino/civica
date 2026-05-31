"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function normalizeTheme(value: string | null): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

function getThemeState(): `${Theme}:light` | `${Theme}:dark` {
  const theme = normalizeTheme(window.localStorage.getItem("theme"));
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved =
    theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";
  return `${theme}:${resolved}`;
}

function getServerThemeState(): `${Theme}:light` {
  return "system:light";
}

function subscribeTheme(listener: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => listener();
  mq.addEventListener("change", notify);
  window.addEventListener("storage", notify);
  window.addEventListener("civica-theme-change", notify);
  return () => {
    mq.removeEventListener("change", notify);
    window.removeEventListener("storage", notify);
    window.removeEventListener("civica-theme-change", notify);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeState = useSyncExternalStore(
    subscribeTheme,
    getThemeState,
    getServerThemeState,
  );
  const [theme, resolved] = themeState.split(":") as [Theme, "light" | "dark"];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setTheme = (t: Theme) => {
    window.localStorage.setItem("theme", t);
    window.dispatchEvent(new Event("civica-theme-change"));
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
