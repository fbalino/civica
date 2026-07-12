"use client";

import { useEffect, useMemo, useState } from "react";
import { SourceDot } from "@/components/SourceDot";

export interface SubsectionEntry {
  /** DOM id of the subsection heading. */
  id: string;
  label: string;
}

export interface SourceEntry {
  name: string;
  date: string;
  /**
   * Optional canonical source id (e.g. "vdem", "wikidata"). When present a
   * provenance `<SourceDot>` renders beside the name, reading green (live)
   * or amber (frozen vintage) exactly as it does everywhere else. The `date`
   * column stays as the human-readable sync/vintage label.
   */
  sourceId?: string;
}

interface FactbookRightRailProps {
  /** Map of section id -> ordered subsection entries inside that section. */
  subsectionsBySection: Record<string, SubsectionEntry[]>;
  sources: SourceEntry[];
}

// Adaptive right rail: re-renders to show subsections of the
// currently-visible section, highlighting the active subsection.
//
// Uses a SINGLE IntersectionObserver across all section + subsection
// elements. Tracks last-known intersecting state per id and picks the
// topmost intersecting one in document order — deterministic when
// multiple ids overlap the band, and self-corrects when the user
// scrolls back to the top.
export function FactbookRightRail({
  subsectionsBySection,
  sources,
}: FactbookRightRailProps) {
  const sectionIds = useMemo(
    () => Object.keys(subsectionsBySection),
    [subsectionsBySection]
  );
  const allSubIds = useMemo(
    () =>
      Object.values(subsectionsBySection)
        .flat()
        .map((s) => s.id),
    [subsectionsBySection]
  );

  const [activeSection, setActiveSection] = useState<string>(
    sectionIds[0] ?? ""
  );
  const [activeSub, setActiveSub] = useState<string>("");

  // Section observer (wide band).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (sectionIds.length === 0) return;
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const intersecting = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target.id, entry.isIntersecting);
        }
        for (const id of sectionIds) {
          if (intersecting.get(id)) {
            setActiveSection(id);
            return;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  // Subsection observer (narrower band so the active sub matches
  // visual mid-viewport).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (allSubIds.length === 0) return;
    const els = allSubIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const intersecting = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target.id, entry.isIntersecting);
        }
        for (const id of allSubIds) {
          if (intersecting.get(id)) {
            setActiveSub(id);
            return;
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [allSubIds]);

  const subs = subsectionsBySection[activeSection] ?? [];

  function jumpTo(id: string) {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - (56 + 16);
      window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
      history.replaceState(null, "", `#${id}`);
    };
  }

  return (
    <aside
      aria-label="Section contents and sources"
      className="factbook-rail"
    >
      <div>
        <h4
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-wider)",
            color: "var(--color-text-40)",
            margin: "0 0 var(--space-4)",
            fontWeight: 400,
          }}
        >
          In this section
        </h4>
        {subs.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {subs.map((s) => {
              const isActive = s.id === activeSub;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={jumpTo(s.id)}
                    style={{
                      display: "block",
                      padding: "var(--space-2) var(--space-3)",
                      fontSize: "var(--text-13)",
                      color: isActive
                        ? "var(--color-text-primary)"
                        : "var(--color-text-60)",
                      borderLeft: `2px solid ${
                        isActive ? "var(--color-text-primary)" : "transparent"
                      }`,
                      background: isActive
                        ? "color-mix(in oklab, var(--color-text-primary) 4%, transparent)"
                        : "transparent",
                      borderBottom: "1px solid var(--color-stat-border)",
                      textDecoration: "none",
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p
            style={{
              fontSize: "var(--text-13)",
              color: "var(--color-text-40)",
              margin: 0,
            }}
          >
            No subsections.
          </p>
        )}
      </div>

      <div>
        <h4
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-wider)",
            color: "var(--color-text-40)",
            margin: "0 0 var(--space-4)",
            fontWeight: 400,
          }}
        >
          Sources on this page
        </h4>
        <div
          style={{
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-hard)",
            padding: "var(--space-5)",
          }}
        >
          {sources.map((src, i) => (
            <div
              key={src.name}
              className={`factbook-source-row${
                i === sources.length - 1 ? " factbook-source-row--last" : ""
              }`}
            >
              <span className="factbook-source-row__name">
                {src.name}
                {src.sourceId ? (
                  <SourceDot source={src.sourceId} retrievedAt={src.date} />
                ) : null}
              </span>
              <span className="factbook-source-row__date">{src.date}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
