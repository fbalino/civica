"use client";

import { useEffect, useMemo, type ReactNode } from "react";

export interface CivicaDataSectionItem {
  /** Stable section id — also the URL hash / ?section= value + scroll anchor. */
  id: string;
  label: string;
  /** Server-rendered section body (passed as a prop, never re-fetched here). */
  content: ReactNode;
}

interface CivicaDataSectionsProps {
  items: CivicaDataSectionItem[];
  footer?: ReactNode;
  /**
   * Deep-link target from the URL (`?section=` / `#hash`), resolved server-side
   * to a real, visible section id. Used only to scroll to that section on load;
   * every section is always in the DOM and visible.
   */
  defaultId: string;
}

/**
 * The Civica Data tab's stacked scroll column — the MAIN column only.
 *
 * Owner brief (2026-07-04): every visible section renders stacked in one
 * scroll, numbered 01–07, exactly like the Factbook tab. The sticky
 * "On this page" navigation is NOT rendered here: the page composes the same
 * `<FactbookSidebar>` (the canonical `ReaderSidebar` primitive) the Factbook
 * tab uses, inside the same grid — one sidebar component across both tabs, by
 * owner mandate (2026-07-05, after the two tabs drifted apart visually).
 *
 * Mechanism: each section body is server-rendered in page.tsx and handed in
 * as `content` (server components as children of a client component). This
 * component owns NO data and NO nav — it lays out the numbered sections and
 * handles URL deep-linking.
 *
 * Deep-linking: on load, a `#hash` or `?section=` naming a visible section
 * scrolls that section into view after paint (an effect, never during render,
 * so SSR and the first client paint agree and never trip a hydration
 * mismatch), then re-anchors once heavy section bodies finish loading.
 */
export function CivicaDataSections({
  items,
  footer,
  defaultId,
}: CivicaDataSectionsProps) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  // On mount, honor a deep link. `?section=` is resolved server-side into
  // `defaultId`; a `#hash` is client-only (never reaches the server), so read
  // it here too. An EXPLICIT target — a real `#hash` OR a server-resolved
  // `?section=` (`defaultId` differs from the first section only when the URL
  // carried one) — always scrolls, first section included: the masthead links
  // to `/country/{slug}/civica-data#civica-index`, and Civica Index is the
  // first section but sits below a tall hero, so that link must still land on
  // it. Only a plain load with no explicit target skips the scroll.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const explicitTarget = ids.includes(hash)
      ? hash
      : defaultId && defaultId !== ids[0]
        ? defaultId
        : null;
    if (!explicitTarget) return;
    const scrollToTarget = (): number | null => {
      const el = document.getElementById(explicitTarget);
      if (!el) return null;
      const top =
        el.getBoundingClientRect().top + window.scrollY - (56 + 16);
      window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
      return top;
    };
    let setTop = scrollToTarget();
    if (setTop === null) return;
    // Heavy section bodies (charts, images) above the target keep loading
    // after hydration and shift the layout, drifting the target off the spot
    // we scrolled to. Re-anchor once everything has loaded — but only if the
    // reader hasn't scrolled away in the meantime (stay hands-off the moment
    // they take over).
    const reanchor = () => {
      if (setTop !== null && Math.abs(window.scrollY - setTop) < 200) {
        setTop = scrollToTarget();
      }
    };
    if (document.readyState === "complete") return;
    window.addEventListener("load", reanchor, { once: true });
    return () => window.removeEventListener("load", reanchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="civica-data-main">
      {items.map((item, idx) => (
        <section key={item.id} id={item.id} className="civica-data-section">
          <header className="civica-data-section-header">
            <p className="civica-data-section-eyebrow">
              <span className="civica-data-section-num">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span aria-hidden> · </span>
              {item.label}
            </p>
            <h2 className="civica-data-section-title">{item.label}</h2>
          </header>
          {item.content}
        </section>
      ))}
      {footer}
    </div>
  );
}
