"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { DEV_TOKEN_BY_VAR, DEV_TOKEN_STORAGE_KEY } from "./dev-tokens";

/*
 * DevDesignMount — root-level mount point for the dev-design panel.
 *
 * Responsibilities:
 *   - Listen for the toggle keyboard shortcut (⌘/Ctrl + Shift + D).
 *   - Open the panel automatically when the URL has `?dev=1`.
 *   - Hydrate localStorage overrides on first paint, even if the
 *     panel never opens — so changes persist across reloads.
 *   - Lazy-load the panel UI so it adds zero JS to first paint when
 *     the user hasn't opened it.
 *
 * The panel itself lives in DevDesignPanel.tsx. This component owns
 * only the visibility state and the global side-effects.
 */

const DevDesignPanel = lazy(() =>
  import("./DevDesignPanel").then((m) => ({ default: m.DevDesignPanel })),
);

type Overrides = Record<string, string>;

function readOverrides(): Overrides {
  try {
    const raw = window.localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

export function DevDesignMount() {
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1";
    const localTimer = window.setTimeout(() => setIsLocalhost(local), 0);
    return () => window.clearTimeout(localTimer);
  }, []);

  // Hydrate overrides only in local development. This keeps the live site
  // from showing or applying the token editor.
  useEffect(() => {
    if (!isLocalhost) return;
    let openTimer: number | undefined;
    const o = readOverrides();
    Object.entries(o).forEach(([k, v]) => {
      if (k in DEV_TOKEN_BY_VAR) {
        document.documentElement.style.setProperty(k, v);
      }
    });
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("dev") === "1") {
        openTimer = window.setTimeout(() => setOpen(true), 0);
      }
    } catch {
      /* ignore */
    }
    return () => {
      if (openTimer !== undefined) window.clearTimeout(openTimer);
    };
  }, [isLocalhost]);

  // Keyboard shortcut: ⌘/Ctrl + Shift + D toggles, Esc closes.
  useEffect(() => {
    if (!isLocalhost) return;
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLocalhost, open]);

  if (!isLocalhost) return null;

  return (
    <>
      {/* Floating "Design" pill — always visible bottom-right when the
          panel is closed. Click to open the live token editor. */}
      {!open && (
        <button
          type="button"
          className="dev-pill"
          onClick={() => setOpen(true)}
          aria-label="Open design system editor"
          title="Design (⌘⇧D)"
        >
          ✦ Design
        </button>
      )}

      <Suspense fallback={null}>
        <DevDesignPanel open={open} onClose={() => setOpen(false)} />
      </Suspense>
    </>
  );
}
