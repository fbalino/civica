"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaneHandleProps {
  /** Which side of the screen this handle lives on. */
  side: "left" | "right";
  /** Is the corresponding pane currently collapsed (handle is "expand" mode)
   * or expanded (handle is "collapse" mode)? */
  collapsed: boolean;
  /** Toggle the pane. */
  onToggle: () => void;
}

/**
 * Phase D — thin (24px) vertical handle pinned to the edge of the shell.
 * When the corresponding pane is collapsed it shows an arrow pointing
 * inward (expand). When the pane is expanded it shows an arrow pointing
 * outward (collapse). Clicking toggles via the shared shell context.
 *
 * Two distinct render modes:
 *   - collapsed=true  → fixed to the viewport edge as a re-open affordance
 *                       (the pane itself is width 0, so without this the
 *                       pane would be unreachable).
 *   - collapsed=false → tucked inside the shell at the seam between the
 *                       pane and its resizer, so users can collapse from
 *                       wherever they currently are.
 */
export function PaneHandle({ side, collapsed, onToggle }: PaneHandleProps) {
  const collapseLabel =
    side === "left" ? "Collapse left pane" : "Collapse right pane";
  const expandLabel =
    side === "left" ? "Expand left pane" : "Expand right pane";

  // Direction of the chevron:
  //   left side, collapsed  → ▶  (open: pane is hidden offscreen-left)
  //   left side, expanded   → ◀  (close: tuck back to the left)
  //   right side, collapsed → ◀
  //   right side, expanded  → ▶
  const Arrow =
    side === "left"
      ? collapsed
        ? ChevronRight
        : ChevronLeft
      : collapsed
        ? ChevronLeft
        : ChevronRight;

  return (
    <button
      type="button"
      className={`pane-handle pane-handle--${side} ${collapsed ? "pane-handle--collapsed" : "pane-handle--expanded"}`}
      onClick={onToggle}
      aria-label={collapsed ? expandLabel : collapseLabel}
      title={collapsed ? expandLabel : collapseLabel}
    >
      <Arrow size={14} aria-hidden="true" />
    </button>
  );
}
