"use client";

/*
 * v2 is light-only. Dark mode is deferred — see ~/.claude/plans/yes-agile-kay.md
 * for the rollout plan. This provider is a stub kept around so existing
 * `useTheme()` consumers don't break; it always reports "light" and the
 * `setTheme` setter is a no-op.
 *
 * If/when dark mode is reintroduced, restore the v1 logic from
 * `git log -- src/components/ThemeProvider.tsx`.
 */

import { createContext, useContext, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

const VALUE = {
  theme: "light" as Theme,
  resolved: "light" as "light" | "dark",
  setTheme: () => {},
};

const ThemeContext = createContext(VALUE);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
}
