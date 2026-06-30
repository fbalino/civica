"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  FactbookCountrySearch,
  type FactbookCountryOption,
} from "@/components/factbook/FactbookCountrySearch";

export interface CivicaDataSectionItem {
  /** Stable section id — also the URL hash / ?section= value. */
  id: string;
  label: string;
  /** Server-rendered section body (passed as a prop, never re-fetched here). */
  content: ReactNode;
}

interface CivicaDataSectionsProps {
  items: CivicaDataSectionItem[];
  /** Section shown on first paint (SSR) — usually "civica-index". */
  defaultId: string;
  /**
   * Country list for the "Jump to country…" search at the top of the section
   * nav. Selecting a country navigates to that country's page (`/country/<slug>`).
   * Optional — when omitted/empty the search is hidden.
   */
  countries?: ReadonlyArray<FactbookCountryOption>;
}

/**
 * Master–detail / vertical-tabs shell for the Civica Data tab.
 *
 * The owner's brief: the old single-scroll (left sidebar + narrow main +
 * right rail, ~20,000px tall) is replaced by a real left navigation. Clicking
 * a section shows ONLY that section, full-width, with the right rail gone.
 *
 * Mechanism: every section body is server-rendered in page.tsx and passed in
 * as `content` (the "server components as children of a client component"
 * pattern). This component owns NO data — it only toggles which body is
 * visible via CSS `display`, so all sections stay in the DOM (SEO + instant
 * switch + working in-page anchors) while one is shown at a time.
 *
 * Deep-linking: the initial section comes from the URL (`#hash` or
 * `?section=`) when it names a real section, else `defaultId`. Switching
 * updates the hash (so links + the browser back button work). SSR always
 * paints `defaultId`, so no-JS readers and crawlers get the default body.
 */
export function CivicaDataSections({
  items,
  defaultId,
  countries,
}: CivicaDataSectionsProps) {
  const validIds = items.map((i) => i.id);
  const initialId = validIds.includes(defaultId) ? defaultId : validIds[0];
  const [activeId, setActiveId] = useState<string>(initialId);

  // After hydration, honor a deep link (?section= or #hash). Done in an
  // effect (not during render) so SSR + first client paint agree on
  // `defaultId` and never trip a hydration mismatch.
  useEffect(() => {
    const fromUrl = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && validIds.includes(hash)) return hash;
      const qs = new URLSearchParams(window.location.search).get("section");
      if (qs && validIds.includes(qs)) return qs;
      return null;
    };
    const target = fromUrl();
    if (target && target !== activeId) setActiveId(target);

    // Keep in sync with back/forward navigation.
    const onPop = () => {
      const next = fromUrl();
      if (next) setActiveId(next);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    // Reflect the choice in the URL without a scroll jump or history spam.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.pushState(null, "", url.toString());
    }
    // Bring the content pane back into view on narrow screens where the
    // nav stacks above the body.
    const pane = document.getElementById("civica-data-pane");
    if (pane && window.matchMedia("(max-width: 900px)").matches) {
      pane.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    }
  }

  return (
    <div className="civica-data-shell">
      <nav className="civica-data-nav" aria-label="Civica Data sections">
        <p className="civica-data-nav-eyebrow">Civica Data</p>
        {countries && countries.length > 0 ? (
          <div className="civica-data-nav-search">
            <FactbookCountrySearch
              countries={countries}
              countryPathPrefix="/country"
              placeholder="Jump to country..."
              ariaLabel="Jump to a country"
              compact
            />
          </div>
        ) : null}
        <ol className="civica-data-nav-list">
          {items.map((item, idx) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`civica-data-nav-link${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => select(item.id)}
                >
                  <span aria-hidden className="civica-data-nav-num">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="civica-data-nav-text">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div id="civica-data-pane" className="civica-data-pane">
        {items.map((item) => (
          <section
            key={item.id}
            id={item.id}
            className="civica-data-panel"
            hidden={item.id !== activeId}
          >
            {item.content}
          </section>
        ))}
      </div>
    </div>
  );
}
