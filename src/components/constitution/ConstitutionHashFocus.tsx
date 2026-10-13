"use client";

import { useEffect } from "react";

/**
 * Moves keyboard focus to a constitution section: makes it programmatically
 * focusable on demand (sections ship without `tabindex` to keep long texts
 * small) and focuses it without a second scroll.
 */
export function focusConstitutionSection(el: HTMLElement) {
  if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
  el.focus({ preventScroll: true });
}

/** The section a URL hash names, when it is a reading-column section. */
function hashSection(): HTMLElement | null {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return null;
  const target = document.getElementById(id);
  if (!(target instanceof HTMLElement)) return null;
  return target.parentElement?.classList.contains("constitution-reader-body")
    ? target
    : null;
}

/**
 * Client island for the server-rendered constitution body. It receives no
 * props: when the page opens on (or later changes to) a `#sec-…` hash, it
 * focuses that section so keyboard and screen-reader users continue reading
 * from the linked article.
 */
export function ConstitutionHashFocus() {
  useEffect(() => {
    const focusHashTarget = () => {
      const target = hashSection();
      if (target) focusConstitutionSection(target);
    };
    focusHashTarget();
    window.addEventListener("hashchange", focusHashTarget);
    return () => window.removeEventListener("hashchange", focusHashTarget);
  }, []);
  return null;
}
