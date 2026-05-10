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
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // Hydrate overrides on first paint, regardless of whether the panel
  // has been opened. This makes localStorage the source of truth even
  // for users who set tokens, closed the panel, then reload.
  useEffect(() => {
    const o = readOverrides();
    Object.entries(o).forEach(([k, v]) => {
      // Only re-apply tokens we know about — guards against stale keys.
      if (k in DEV_TOKEN_BY_VAR) {
        document.documentElement.style.setProperty(k, v);
      }
    });
    // URL param opens the panel on first paint.
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("dev") === "1") {
        setOpen(true);
        setHasOpened(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Keyboard shortcut: ⌘/Ctrl + Shift + D.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((prev) => !prev);
        setHasOpened(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Floating tag — only appears once user has invoked the panel
          this session, so production end-users don't see it unless
          they intentionally toggle it on. */}
      {hasOpened && !open && (
        <button
          type="button"
          className="dev-pill"
          onClick={() => setOpen(true)}
          aria-label="Open design system editor"
          title="Design (⌘⇧D)"
        >
          Design
        </button>
      )}

      {/* Lazy-mount the panel on first open so first paint stays clean. */}
      {hasOpened && (
        <Suspense fallback={null}>
          <DevDesignPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
