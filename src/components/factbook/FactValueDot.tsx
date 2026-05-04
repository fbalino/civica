"use client";

/**
 * Phase F.4 — Clickable / hoverable SourceDot variant.
 *
 * Renders a source dot + compact "more sources" marker next to a value.
 * On hover (desktop)
 * or click (any input), opens the alternate-values panel. The
 * panel is rendered via a React portal into `document.body` so
 * it can't be clipped by ancestor `overflow: hidden` containers
 * — important for the atlas masthead where `.cm-fact-text` uses
 * `display: -webkit-box; overflow: hidden` for line-clamping.
 *
 * Interaction model:
 *   - Hover the trigger → panel opens after small delay.
 *   - Mouse-leave trigger AND panel → panel closes after delay.
 *   - Click the trigger → panel toggles + pins (stays open until
 *     ESC, backdrop click, or click-trigger again).
 *   - ESC always closes.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §6
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FactValuePanel,
  type FactValuePanelProps,
} from "./FactValuePanel";

const FROZEN_SOURCES = new Set(["cia_factbook"]);
const HOVER_OPEN_DELAY_MS = 80;
const HOVER_CLOSE_DELAY_MS = 200;

export interface FactValueDotProps extends FactValuePanelProps {
  /** Source ID of the canonical pick — drives the visual (green
   *  for live sources, amber for frozen / CIA). */
  canonicalSourceId: string | null;
  /** ARIA label fragment, e.g. "Population, source: CIA Factbook". */
  ariaLabel?: string;
}

interface PortalPosition {
  /** CSS top in viewport coordinates (use position:fixed on panel). */
  top: number;
  /** CSS left in viewport coordinates. */
  left: number;
}

/**
 * Position the panel below the trigger, aligned to its left edge,
 * but clamped so the panel never overflows the viewport horizontally
 * or vertically. If there's not enough room below, flip above.
 */
function computePortalPosition(
  triggerRect: DOMRect,
  panelW: number,
  panelH: number,
  vw: number,
  vh: number
): PortalPosition {
  const margin = 12;
  let left = triggerRect.left;
  if (left + panelW > vw - margin) {
    left = Math.max(margin, vw - panelW - margin);
  }
  if (left < margin) left = margin;

  let top = triggerRect.bottom + 8;
  // Flip above if it would overflow the bottom.
  if (top + panelH > vh - margin) {
    const above = triggerRect.top - panelH - 8;
    if (above >= margin) top = above;
    else top = Math.max(margin, vh - panelH - margin);
  }

  return { top, left };
}

export function FactValueDot({
  factKey,
  factLabel,
  resolverOutput,
  disputed,
  canonicalSourceId,
  ariaLabel,
}: FactValueDotProps) {
  const [open, setOpen] = useState(false);
  /** Pinned = opened by click; survives mouse-leave. */
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<PortalPosition>({ top: -9999, left: -9999 });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFrozen = canonicalSourceId
    ? FROZEN_SOURCES.has(canonicalSourceId)
    : false;
  const isDisputed = disputed ?? resolverOutput.isDisputed;
  const portalRoot = typeof document === "undefined" ? null : document.body;

  // Cleanup any pending timers on unmount.
  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Position the panel after open; recalc on window resize / scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const tr = trigger.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      setPos(
        computePortalPosition(
          tr,
          pr.width || 360,
          pr.height || 200,
          window.innerWidth,
          window.innerHeight
        )
      );
    };
    update();
    // Recompute after the panel paints once (so we have its real size).
    const r = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(r);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cancelTimers = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    cancelTimers();
    openTimer.current = setTimeout(() => {
      setOpen(true);
    }, HOVER_OPEN_DELAY_MS);
  }, [cancelTimers]);

  const scheduleClose = useCallback(() => {
    if (pinned) return; // pinned by click — don't auto-close
    cancelTimers();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [pinned, cancelTimers]);

  const handleClick = useCallback(() => {
    cancelTimers();
    if (open && pinned) {
      // already pinned-open → close + unpin
      setOpen(false);
      setPinned(false);
    } else {
      setOpen(true);
      setPinned(true);
    }
  }, [open, pinned, cancelTimers]);

  const handleBackdropClick = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  const computedLabel =
    ariaLabel ??
    `${factLabel}, ${
      canonicalSourceId ? "source: " + canonicalSourceId : "no source"
    }`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fact-value-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={computedLabel}
        onClick={handleClick}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        <span
          className={
            "source-dot " +
            (isFrozen ? "source-dot--frozen" : "source-dot--live")
          }
          aria-hidden
        />
        <span className="fact-value-trigger-more" aria-hidden>
          +
        </span>
        {isDisputed && (
          <span className="fact-value-disputed-chip">disputed</span>
        )}
      </button>

      {portalRoot && open
        ? createPortal(
            <>
              {/* Backdrop only when pinned — for click-anywhere-to-close.
               *  When unpinned (hover), the panel auto-closes on
               *  mouse-leave so a backdrop would block clicks unnecessarily. */}
              {pinned && (
                <div
                  className="fact-value-panel-backdrop"
                  onClick={handleBackdropClick}
                  aria-hidden
                />
              )}
              <div
                ref={panelRef}
                className="fact-value-panel-host"
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  zIndex: 60,
                }}
                onMouseEnter={cancelTimers}
                onMouseLeave={scheduleClose}
              >
                <FactValuePanel
                  factKey={factKey}
                  factLabel={factLabel}
                  resolverOutput={resolverOutput}
                  disputed={disputed}
                />
              </div>
            </>,
            portalRoot
          )
        : null}
    </>
  );
}
