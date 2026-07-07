"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which of a list of in-page sections is currently in view.
 *
 *   const active = useActiveSection(["overview", "geography", "government"]);
 *
 * Returns the id of the section whose top edge is in the central scroll
 * band defined by `rootMargin`. Falls back to the first id when nothing
 * matches yet (e.g. on initial mount before scroll fires).
 *
 * Uses a SINGLE IntersectionObserver across all elements (not one
 * observer per id) so 12+ section pages don't pay 12+ allocations on
 * every re-mount, and entries are picked deterministically.
 */
export function useActiveSection(
  ids: ReadonlyArray<string>,
  rootMargin: string = "-20% 0px -70% 0px"
): string {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (ids.length === 0) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    // Snapshot last-known intersection state per id so we can pick the
    // topmost intersecting element on every notify, not just the most
    // recently-fired entry.
    const intersecting = new Map<string, boolean>();

    const pickActive = () => {
      const activeIds = ids.filter((id) => intersecting.get(id));
      if (activeIds.length === 0) return;

      // Prefer the DEEPEST intersecting section — one that does not itself
      // contain another intersecting section. A page can nest sections
      // (e.g. /api-docs puts every endpoint sub-section inside one big
      // `#endpoints` section); the ancestor's element spans the whole
      // region, so it stays intersecting the entire time and, under a
      // naive "first in document order" pick, would keep winning while the
      // reader scrolls past ten nested items. Skipping any section that
      // contains another active one lets the child win.
      //
      // For flat pages (no nesting) no section contains another, so this
      // resolves to the first intersecting id in document order — identical
      // to the previous behavior. Deterministic either way.
      for (const id of activeIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const containsAnotherActive = activeIds.some((otherId) => {
          if (otherId === id) return false;
          const other = document.getElementById(otherId);
          return other != null && el.contains(other);
        });
        if (!containsAnotherActive) {
          setActive(id);
          return;
        }
      }
      // Fallback: every candidate contained another (shouldn't happen) —
      // keep document order.
      setActive(activeIds[0]);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target.id, entry.isIntersecting);
        }
        pickActive();
      },
      { rootMargin, threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, rootMargin]);

  return active;
}
