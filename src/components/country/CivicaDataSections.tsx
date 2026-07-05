"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useActiveSection } from "@/hooks/useActiveSection";

export interface CivicaDataSectionItem {
  /** Stable section id — also the URL hash / ?section= value + scroll anchor. */
  id: string;
  label: string;
  /** Server-rendered section body (passed as a prop, never re-fetched here). */
  content: ReactNode;
}

interface CivicaDataSectionsProps {
  items: CivicaDataSectionItem[];
  /**
   * Deep-link target from the URL (`?section=` / `#hash`), resolved server-side
   * to a real, visible section id. Used only to scroll to that section on load;
   * every section is always in the DOM and visible.
   */
  defaultId: string;
}

/**
 * Factbook-style stacked scroll for the Civica Data tab.
 *
 * Owner brief (2026-07-04): "if I'm in 01) Civica Index, I should scroll down
 * to see 02) Government and so on — not click each tab." So every visible
 * section renders stacked in one scroll column — nothing is hidden, everything
 * is in the DOM and on screen (better reading flow + SEO). This mirrors the
 * Factbook tab's reader layout (sticky left TOC + one long scroll of numbered
 * sections).
 *
 * Mechanism: each section body is server-rendered in page.tsx and handed in as
 * `content` (the "server components as children of a client component"
 * pattern). This component owns NO data — it lays the sections out and drives
 * the scroll-spy nav.
 *
 * Navigation: the sticky left nav is scroll-spy anchor navigation via
 * `useActiveSection` — the active entry follows the scroll position, and a
 * click smooth-scrolls to that section (offset by the fixed header) and updates
 * the URL hash with `history.replaceState` (no history spam, no scroll-jump
 * fight). Sections carry `scroll-margin-top` so an anchor jump lands below the
 * header.
 *
 * Deep-linking: on load, a `#hash` or `?section=` naming a visible section
 * scrolls that section into view after paint (an effect, never during render,
 * so SSR and the first client paint agree and never trip a hydration mismatch).
 */
export function CivicaDataSections({
  items,
  defaultId,
}: CivicaDataSectionsProps) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveSection(ids);

  // On mount, honor a deep link. `?section=` is resolved server-side into
  // `defaultId`; a `#hash` is client-only (never reaches the server), so read it
  // here too. An EXPLICIT target — a real `#hash` OR a server-resolved
  // `?section=` (`defaultId` differs from the first section only when the URL
  // carried one) — always scrolls, first section included: the masthead links
  // to `/country/{slug}/civica-data#civica-index`, and Civica Index is the first
  // section but sits below a tall hero, so that link must still land on it.
  // Only a plain load with no explicit target skips the scroll. Scroll AFTER
  // paint so SSR + first client paint agree and never trip a hydration mismatch.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    // An explicit target exists when the hash names a visible section, or when
    // `defaultId` names a section other than the first (a plain load resolves
    // `defaultId` to the first section; anything else came from `?section=`).
    const explicitTarget = ids.includes(hash)
      ? hash
      : defaultId && defaultId !== ids[0]
        ? defaultId
        : null;
    if (!explicitTarget) return;
    const scrollToTarget = (): number | null => {
      const el = document.getElementById(explicitTarget);
      if (!el) return null;
      const top = el.getBoundingClientRect().top + window.scrollY - (56 + 16);
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

  function handleNavClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) {
    // Only intercept a plain left-click. Modifier/middle clicks (open-in-new-
    // tab, new-window, download) must keep their native behavior.
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (56 + 16);
    window.scrollTo({ top, behavior: "smooth" });
    // Reflect the section in the URL without a scroll jump or history spam.
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="civica-data-shell">
      <nav className="civica-data-nav" aria-label="Civica Data sections">
        <p className="civica-data-nav-eyebrow">On this page</p>
        {/* The "jump to country" search lives ABOVE this shell via
         *  <CountryJumpSearch> — a normal-flow field that scrolls away and
         *  hands off to the sticky top bar. Keeping it out of this STICKY nav
         *  is what prevents two search bars showing at once. */}
        <ol className="civica-data-nav-list">
          {items.map((item, idx) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={`civica-data-nav-link${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={(e) => handleNavClick(e, item.id)}
                >
                  <span aria-hidden className="civica-data-nav-num">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="civica-data-nav-text">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="civica-data-pane">
        {items.map((item, idx) => (
          <section
            key={item.id}
            id={item.id}
            className="civica-data-section"
          >
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
      </div>
    </div>
  );
}
