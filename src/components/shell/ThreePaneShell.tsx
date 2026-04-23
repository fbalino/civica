"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useShell } from "./ShellContext";

interface ThreePaneShellProps {
  leftSlot: ReactNode;
  rightSlot: ReactNode;
  children: ReactNode;
  /** Compare mode uses a 1fr 1fr layout instead of leftW 1fr. */
  compareMode?: boolean;
  /** Force the right pane hidden (e.g. on the map-only /atlas root view). */
  hideRight?: boolean;
  /** Force the left pane hidden (e.g. on the landing page). */
  hideLeft?: boolean;
}

/**
 * Three-pane site shell. Provides the grid, resizer handles, and mobile
 * overlay toggle bar. It is a pure layout wrapper — content goes into the
 * three slots (leftSlot, children, rightSlot) which are populated per-route
 * by Next.js parallel routes (@left and @right under (shell)/*).
 */
export function ThreePaneShell({
  leftSlot,
  rightSlot,
  children,
  compareMode = false,
  hideRight = false,
  hideLeft = false,
}: ThreePaneShellProps) {
  const {
    leftW,
    rightW,
    setLeftW,
    setRightW,
    isMobile,
    mobilePanel,
    setMobilePanel,
    rightCollapsed,
  } = useShell();

  const resizerRef = useRef<{
    side: "left" | "right";
    startX: number;
    startW: number;
  } | null>(null);

  // Global resize listeners — matches the pattern from AtlasApp.tsx:666-687.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizerRef.current;
      if (!r) return;
      if (r.side === "left") {
        setLeftW(r.startW + (e.clientX - r.startX));
      } else {
        setRightW(r.startW - (e.clientX - r.startX));
      }
    };
    const onUp = () => {
      if (resizerRef.current) {
        resizerRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setLeftW, setRightW]);

  function startResize(side: "left" | "right", e: React.MouseEvent) {
    e.preventDefault();
    resizerRef.current = {
      side,
      startX: e.clientX,
      startW: side === "left" ? leftW : rightW,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  // Effective right width — 0 when collapsed (desktop only).
  const effectiveRightW = rightCollapsed || hideRight ? 0 : rightW;
  const effectiveLeftW = hideLeft ? 0 : leftW;

  // Grid template varies by mode + collapse state.
  const gridTemplate = compareMode
    ? `1fr 6px 1fr 6px ${effectiveRightW}px`
    : hideLeft
      ? `1fr 6px ${effectiveRightW}px`
      : `${effectiveLeftW}px 6px 1fr 6px ${effectiveRightW}px`;

  return (
    <div
      className="atlas-root"
      style={
        {
          "--atlas-leftW": `${effectiveLeftW}px`,
          "--atlas-rightW": `${effectiveRightW}px`,
        } as React.CSSProperties
      }
    >
      {isMobile && (
        <div className="mobile-panel-bar" role="tablist" aria-label="Panels">
          <button
            role="tab"
            aria-selected={mobilePanel === "countries"}
            className={mobilePanel === "countries" ? "on" : ""}
            onClick={() =>
              setMobilePanel(mobilePanel === "countries" ? "center" : "countries")
            }
          >
            Nav
          </button>
          <button
            role="tab"
            aria-selected={mobilePanel === "center"}
            className={mobilePanel === "center" ? "on" : ""}
            onClick={() => setMobilePanel("center")}
          >
            Content
          </button>
          <button
            role="tab"
            aria-selected={mobilePanel === "chat"}
            className={mobilePanel === "chat" ? "on" : ""}
            onClick={() =>
              setMobilePanel(mobilePanel === "chat" ? "center" : "chat")
            }
          >
            Ask AI
          </button>
        </div>
      )}

      <div
        className={`chamber-grid${compareMode ? " compare-mode" : ""}`}
        style={{
          gridTemplateColumns: gridTemplate,
          height: isMobile ? undefined : "calc(100vh - 56px)",
        }}
      >
        {!hideLeft && (
          <aside
            className={`chamber-left${
              isMobile && mobilePanel === "countries" ? " mobile-visible" : ""
            }`}
            role="navigation"
            aria-label="Context navigation"
          >
            {leftSlot}
          </aside>
        )}

        {!hideLeft && (
          <div
            className="atlas-resizer"
            onMouseDown={(e) => startResize("left", e)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left pane"
          />
        )}

        <section
          className="chamber-center"
          role="main"
          id="shell-center"
          tabIndex={-1}
        >
          {children}
        </section>

        {!hideRight && (
          <div
            className="atlas-resizer"
            onMouseDown={(e) => startResize("right", e)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right pane"
          />
        )}

        {!hideRight && (
          <aside
            className={`chamber-right${
              isMobile && mobilePanel === "chat" ? " mobile-visible" : ""
            }`}
            role="complementary"
            aria-label="Ask Civica AI assistant"
          >
            {rightSlot}
          </aside>
        )}
      </div>
    </div>
  );
}
