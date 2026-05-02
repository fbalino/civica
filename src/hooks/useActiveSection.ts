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
      // Walk the ids in document order and select the first one
      // currently intersecting. Deterministic when several entries
      // overlap the rootMargin band.
      for (const id of ids) {
        if (intersecting.get(id)) {
          setActive(id);
          return;
        }
      }
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
