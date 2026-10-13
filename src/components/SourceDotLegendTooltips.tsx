"use client";

import { useEffect } from "react";

const TOOLTIP_ATTRIBUTES = [
  "data-source",
  "data-state",
  "data-date",
  "data-vintage",
  "data-rights",
] as const;

let listeners = 0;

/**
 * Gives a legend-scoped `<SourceDot>` the same tooltip as a self-contained
 * dot. On the first hover, focus, or tap it copies the disclosure attributes
 * from the dot's shared description (its `aria-labelledby` target) onto the
 * dot, where the `.source-dot::after` tooltip reads them. One document-level
 * listener serves every legend on the page.
 */
function revealSharedDisclosure(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const dot = target.closest(".source-dot[aria-labelledby]");
  if (!dot || dot.hasAttribute("data-source")) return;
  const description = document.getElementById(
    dot.getAttribute("aria-labelledby") ?? "",
  );
  if (!description) return;
  for (const name of TOOLTIP_ATTRIBUTES) {
    const value = description.getAttribute(name);
    if (value != null) dot.setAttribute(name, value);
  }
}

export function SourceDotLegendTooltips() {
  useEffect(() => {
    if (listeners++ === 0) {
      document.addEventListener("pointerover", revealSharedDisclosure, true);
      document.addEventListener("focusin", revealSharedDisclosure, true);
    }
    return () => {
      if (--listeners === 0) {
        document.removeEventListener("pointerover", revealSharedDisclosure, true);
        document.removeEventListener("focusin", revealSharedDisclosure, true);
      }
    };
  }, []);
  return null;
}
