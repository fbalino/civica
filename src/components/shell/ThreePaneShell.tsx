"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useShell } from "./ShellContext";
import { PaneHandle } from "./PaneHandle";

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
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
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

  // Collapse only applies on desktop. Mobile uses the panel-bar tabs;
  // honouring leftCollapsed there would leave the user with no Nav tab
  // content even after they tap "Nav".
  const leftCollapsedDesktop = !isMobile && leftCollapsed;
  const rightCollapsedDesktop = !isMobile && rightCollapsed;
  // Effective widths — 0 when collapsed (desktop only) or hidden by route.
  const effectiveRightW = rightCollapsedDesktop || hideRight ? 0 : rightW;
  const effectiveLeftW = leftCollapsedDesktop || hideLeft ? 0 : leftW;
  // Hide the resizer along with the pane itself so collapsed gives 0px.
  const showLeftResizer = !hideLeft && !leftCollapsedDesktop;
  const showRightResizer = !hideRight && !rightCollapsedDesktop;

  // Grid template varies by mode + collapse state. Resizer columns get 0px
  // when their pane is collapsed/hidden so the seam disappears too.
  const leftResizerCol = showLeftResizer ? "6px" : "0px";
  const rightResizerCol = showRightResizer ? "6px" : "0px";
  const gridTemplate = compareMode
    ? `1fr ${rightResizerCol} 1fr ${rightResizerCol} ${effectiveRightW}px`
    : hideLeft
      ? `1fr ${rightResizerCol} ${effectiveRightW}px`
      : `${effectiveLeftW}px ${leftResizerCol} 1fr ${rightResizerCol} ${effectiveRightW}px`;

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
          // Skip grid-template-columns on mobile so the CSS flex
          // override is the only thing controlling layout.
          ...(isMobile ? {} : { gridTemplateColumns: gridTemplate }),
          // Mobile height comes from the CSS @media block (calc(100dvh - 100px)).
          // Desktop fills viewport minus the 56px sticky header.
          height: isMobile ? undefined : "calc(100vh - 56px)",
        }}
      >
        {/* IMPORTANT: render the resizer slots unconditionally — even when
            collapsed they hold the column. CSS display:none on a grid
            item *removes* it from the layout, which would shift later
            children and dump the center pane into a 0-px column.
            pointer-events:none + visibility:hidden keeps the slot but
            silences interaction. */}
        {!hideLeft && (
          <aside
            className={`chamber-left${
              isMobile && mobilePanel === "countries" ? " mobile-visible" : ""
            }${leftCollapsedDesktop ? " is-collapsed" : ""}`}
            role="navigation"
            aria-label="Context navigation"
          >
            {!leftCollapsedDesktop && leftSlot}
            {!leftCollapsedDesktop && !isMobile && (
              <PaneHandle
                side="left"
                collapsed={false}
                onToggle={() => setLeftCollapsed(true)}
              />
            )}
          </aside>
        )}

        {!hideLeft && (
          <div
            className="atlas-resizer"
            onMouseDown={
              showLeftResizer ? (e) => startResize("left", e) : undefined
            }
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left pane"
            style={
              showLeftResizer
                ? undefined
                : { pointerEvents: "none", visibility: "hidden" }
            }
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
            onMouseDown={
              showRightResizer ? (e) => startResize("right", e) : undefined
            }
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right pane"
            style={
              showRightResizer
                ? undefined
                : { pointerEvents: "none", visibility: "hidden" }
            }
          />
        )}

        {!hideRight && (
          <aside
            className={`chamber-right${
              isMobile && mobilePanel === "chat" ? " mobile-visible" : ""
            }${rightCollapsedDesktop ? " is-collapsed" : ""}`}
            role="complementary"
            aria-label="Ask Civica AI assistant"
          >
            {!rightCollapsedDesktop && rightSlot}
            {!rightCollapsedDesktop && !isMobile && (
              <PaneHandle
                side="right"
                collapsed={false}
                onToggle={() => setRightCollapsed(true)}
              />
            )}
          </aside>
        )}
      </div>

      {/* Edge handles to re-open a collapsed pane. Pinned to the
          viewport edge via CSS so they stay reachable even though the
          pane itself is width 0. Desktop only — mobile uses the panel-
          bar tabs instead. */}
      {!hideLeft && leftCollapsedDesktop && (
        <PaneHandle
          side="left"
          collapsed
          onToggle={() => setLeftCollapsed(false)}
        />
      )}
      {!hideRight && rightCollapsedDesktop && (
        <PaneHandle
          side="right"
          collapsed
          onToggle={() => setRightCollapsed(false)}
        />
      )}
    </div>
  );
}
