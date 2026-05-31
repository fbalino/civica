"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const nextTheme = resolved === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--radius-md)",
        color: "var(--color-text-40)",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {resolved === "dark" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="3.5" />
          <path d="M8 1.5v1M8 13.5v1M2.4 2.4l.7.7M12.9 12.9l.7.7M1.5 8h1M13.5 8h1M2.4 13.6l.7-.7M12.9 3.1l.7-.7" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13.5 8.9A5.5 5.5 0 0 1 7.1 2.5a5.5 5.5 0 1 0 6.4 6.4Z" />
        </svg>
      )}
    </button>
  );
}
