"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// SSR-safe mount signal. The first client render deliberately matches the
// server's `false`, then enables the portal after hydration; a client-only
// snapshot during hydration would change the trigger tree and cause a mismatch.
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/*
 * Tooltip — the canonical Civica tooltip primitive.
 *
 * A beautiful, INSTANT tooltip: it appears the moment the pointer enters the
 * trigger (or the trigger takes keyboard focus) — no native `title` delay. The
 * surface is INVERTED (ink navy in light mode, ivory in dark) with a fine-press
 * fade-and-rise entrance, so a data point can be inspected without a jarring
 * browser bubble.
 *
 * WHY A PORTAL
 * The bubble is portalled to <body> so it escapes any `overflow: hidden` /
 * `overflow: auto` ancestor (cards, tables, scroll panes) that would otherwise
 * clip it. Position is computed from the trigger's getBoundingClientRect each
 * time it opens (and on scroll/resize while open): centred above the trigger by
 * default, flipped below when the top would clip the viewport, and horizontally
 * clamped so it never runs off-screen.
 *
 * SSR-SAFE
 * The trigger renders identically on the server and the client. The portalled
 * bubble is only created after mount (`mounted` gate), so there is no hydration
 * mismatch and no `document` access during SSR.
 *
 * A11y
 * role="tooltip" on the bubble; aria-describedby is wired only while the tooltip
 * is open, onto WHATEVER element actually receives focus. The wrapper begins as
 * a passive span on both the server and the first client render. After hydration
 * it detects a focusable child (a <button>, <a href>, <input>, or tab-indexed
 * control): that child remains the focus target; otherwise the wrapper becomes
 * the keyboard target. This post-hydration decision avoids inspecting an RSC
 * child during render, which can produce different server/client trees. Escape
 * closes it. On touch/coarse pointers a tap toggles it (the <InfoTip> trigger is
 * a real <button> so it is keyboard- and touch-operable).
 *
 * Styling lives entirely in editorial.css under `.editorial-tooltip` — tokens
 * only, no hardcoded colors/fonts/spacing here.
 */

type TooltipPlacement = "top" | "bottom";

const VIEWPORT_MARGIN = 8; // px gutter kept between the bubble and the viewport edge
const TRIGGER_GAP = 8; // px between the trigger and the bubble

const FOCUSABLE_DESCENDANT = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

interface TooltipCoords {
  left: number;
  top: number;
  placement: TooltipPlacement;
}

interface TooltipProps {
  /** The tooltip body. Kept short — the surface caps at 280px and wraps. */
  content: ReactNode;
  /** The element the tooltip describes. A single focusable/hoverable node. */
  children: ReactNode;
  /** Preferred side; flips automatically when it would clip. Default "top". */
  placement?: TooltipPlacement;
  /** Extra class on the trigger wrapper. */
  className?: string;
  /**
   * Inline styles for the trigger WRAPPER span. Needed when the trigger must
   * carry geometry the wrapper itself owns — e.g. an absolutely-positioned
   * hover column laid over an SVG chart, where the measurable box has to be
   * the wrapper (the Tooltip positions against `triggerRef.getBoundingClientRect()`).
   */
  triggerStyle?: CSSProperties;
  /** Accessible label for a non-native tooltip trigger. */
  ariaLabel?: string;
  /** Semantic role for a non-native trigger. Data-only hover regions use img. */
  triggerRole?: "button" | "img";
}

export function Tooltip({
  content,
  children,
  placement = "top",
  className,
  triggerStyle,
  ariaLabel,
  triggerRole = "button",
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const [wrapperIsFocusable, setWrapperIsFocusable] = useState(false);
  const [focusTarget, setFocusTarget] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const tipId = useId();
  const mounted = useMounted();

  // An RSC child is not guaranteed to be a React element on the first client
  // render. Resolve its actual DOM shape only after hydration so the wrapper
  // never changes from a server <span> into a client child node.
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const descendant = trigger.querySelector<HTMLElement>(FOCUSABLE_DESCENDANT);
    setFocusTarget(descendant);
    setWrapperIsFocusable(descendant === null);
  }, []);

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Flip below when there isn't room above the trigger.
    let resolved: TooltipPlacement = placement;
    if (placement === "top" && t.top - b.height - TRIGGER_GAP < VIEWPORT_MARGIN) {
      resolved = "bottom";
    } else if (
      placement === "bottom" &&
      t.bottom + b.height + TRIGGER_GAP > vh - VIEWPORT_MARGIN
    ) {
      resolved = "top";
    }

    const top =
      resolved === "top"
        ? t.top - b.height - TRIGGER_GAP
        : t.bottom + TRIGGER_GAP;

    // Centre horizontally over the trigger, then clamp into the viewport.
    let left = t.left + t.width / 2 - b.width / 2;
    const maxLeft = vw - b.width - VIEWPORT_MARGIN;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, Math.max(VIEWPORT_MARGIN, maxLeft)));

    setCoords({
      left: Math.round(left),
      top: Math.round(top),
      placement: resolved,
    });
  }, [placement]);

  // While open: measure once the bubble is in the DOM, then re-measure on
  // scroll/resize. Nothing runs while closed (the bubble isn't rendered).
  useLayoutEffect(() => {
    if (!open) return;
    position();
    const onScroll = () => position();
    const onResize = () => position();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, position]);

  // Escape closes the tooltip while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Keep the relationship on the element that receives focus. This must happen
  // after hydration because RSC children cannot safely be cloned during render.
  useEffect(() => {
    if (!focusTarget) return;
    const previous = focusTarget.getAttribute("aria-describedby");
    if (open) {
      const ids = new Set((previous ?? "").split(/\s+/).filter(Boolean));
      ids.add(tipId);
      focusTarget.setAttribute("aria-describedby", [...ids].join(" "));
    }
    return () => {
      if (previous === null) focusTarget.removeAttribute("aria-describedby");
      else focusTarget.setAttribute("aria-describedby", previous);
    };
  }, [focusTarget, open, tipId]);

  const show = useCallback(() => setOpen(true), []);
  // Reset coords on hide (in the handler, not an effect) so the next open
  // measures fresh — no stale position flashes for a frame before re-measure.
  const hide = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  // The pointerType of the most recent pointerdown, so click can tell a real
  // mouse click apart from a touch/pen tap. (A synthetic click's own fields
  // don't reliably distinguish the two across browsers.)
  const lastPointerType = useRef<string>("");
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    lastPointerType.current = e.pointerType;
  }, []);
  // A2: on a MOUSE, hovering already showed the tooltip via onMouseEnter — a
  // click must NOT toggle it shut (that made every desktop click on a hovered
  // trigger, worst on the InfoTip <button>, instantly dismiss it). Only
  // touch/pen taps (coarse pointers with no hover) toggle, since they never
  // fire the hover show. An empty pointerType (keyboard-activated click) is
  // treated as non-mouse so Space/Enter on the focusable wrapper still toggles.
  const onClick = useCallback(() => {
    if (lastPointerType.current === "mouse") return;
    if (open) hide();
    else show();
  }, [open, hide, show]);

  const onTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (!wrapperIsFocusable) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick();
    },
    [wrapperIsFocusable, onClick],
  );

  const wrapperClass = ["editorial-tooltip-trigger", className]
    .filter(Boolean)
    .join(" ");

  const bubble =
    mounted && open ? (
      createPortal(
        <div
          ref={bubbleRef}
          id={tipId}
          role="tooltip"
          className="editorial-tooltip"
          data-placement={coords?.placement ?? placement}
          // Rendered off-screen for the first measuring frame (coords null),
          // then snapped to the computed position — no flash at 0,0.
          style={
            {
              left: coords ? `${coords.left}px` : "-9999px",
              top: coords ? `${coords.top}px` : "-9999px",
              visibility: coords ? "visible" : "hidden",
            } as CSSProperties
          }
        >
          {content}
        </div>,
        document.body
      )
    ) : null;

  // A1: describe whichever node actually receives focus. A focusable descendant
  // receives the relationship in the effect above; otherwise this wrapper is the
  // focus target after hydration.
  const describedBy = open ? tipId : undefined;

  return (
    <span
      ref={triggerRef}
      className={wrapperClass}
      style={triggerStyle}
      {...(wrapperIsFocusable
        ? {
            tabIndex: 0,
            role: triggerRole,
            "aria-label": ariaLabel,
            "aria-describedby": describedBy,
          }
        : {})}
      onPointerDown={onPointerDown}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={onClick}
      onKeyDown={onTriggerKeyDown}
    >
      {children}
      {bubble}
    </span>
  );
}

interface InfoTipProps {
  /** The tooltip body — typically a one-line note on a Civica-derived estimate. */
  content: ReactNode;
  /** Accessible name for the button (defaults to "More information"). */
  label?: string;
  /** Preferred side; flips automatically when it would clip. Default "top". */
  placement?: TooltipPlacement;
  /** Extra class on the icon button. */
  className?: string;
}

/*
 * InfoTip — a small circled-i icon button that carries a Tooltip. Used to mark
 * Civica-derived estimates and other "what is this?" affordances inline. The
 * trigger is a real <button> so it is keyboard-focusable and tap-operable on
 * touch (where hover does not exist).
 */
export function InfoTip({
  content,
  label = "More information",
  placement = "top",
  className,
}: InfoTipProps) {
  const buttonClass = ["editorial-infotip", className].filter(Boolean).join(" ");
  return (
    <Tooltip content={content} placement={placement}>
      <button type="button" className={buttonClass} aria-label={label}>
        <span className="editorial-infotip-glyph" aria-hidden>
          i
        </span>
      </button>
    </Tooltip>
  );
}
