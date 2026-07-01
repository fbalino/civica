"use client";

import { useId, useState } from "react";

/*
 * SourceCreditTooltip — a small, reusable "hover to reveal a long photo credit"
 * pattern.
 *
 * WHY THIS EXISTS
 * Photo credits ("Photo: {credit} · {license} · Wikimedia Commons") are often
 * long — too long for a fixed inline caption, which forces an ugly ellipsis and
 * hides the very attribution we're legally/ethically obliged to surface. This
 * component moves the full credit into a hover/focus tooltip on the image
 * itself, with:
 *   - a native `title` on the wrapper (always keyboard/AT/print reachable, even
 *     with no JS and no pointer), so the credit is NEVER lost, and
 *   - a styled, design-system tooltip revealed on hover/focus, with a subtle
 *     corner "source" glyph telling the reader the image is inspectable.
 *
 * REUSE
 * Drop this around ANY credited image where the credit is too long for an
 * inline caption (leader portraits today; country photo galleries, org logos,
 * etc. later). It's presentation-only — pass the already-composed credit string
 * plus the children to wrap (an <img>, an avatar span, a figure, …). Positioning
 * defaults to `top`; pass `placement="bottom"` for images near the top edge of a
 * scroll container so the bubble doesn't clip.
 *
 * Tokens only — no hardcoded colors/fonts/spacing.
 */

export function SourceCreditTooltip({
  credit,
  placement = "top",
  children,
  className,
}: {
  /** Full, human-readable credit line, e.g. "Photo: … · CC BY-SA · Wikimedia Commons". */
  credit: string;
  /** Which side the styled bubble appears on. Use "bottom" near a top edge. */
  placement?: "top" | "bottom";
  children: React.ReactNode;
  /** Extra class on the wrapper (e.g. to size it to the image). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span
      className={`source-credit${className ? ` ${className}` : ""}`}
      data-placement={placement}
      // Native title = the always-available baseline (no-JS, print, some AT).
      title={credit}
      // Keyboard/focus reachable without hijacking tab order semantics.
      tabIndex={0}
      role="img"
      aria-label={credit}
      aria-describedby={open ? tipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {/* Subtle affordance that the image carries a source on hover. */}
      <span className="source-credit-badge" aria-hidden>
        i
      </span>
      <span
        id={tipId}
        role="tooltip"
        className="source-credit-tip"
        data-open={open ? "true" : "false"}
      >
        {credit}
      </span>
    </span>
  );
}
