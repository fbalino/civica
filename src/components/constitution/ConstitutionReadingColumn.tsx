"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useActiveSection } from "@/hooks/useActiveSection";
import { SourceDot } from "@/components/SourceDot";
import {
  buildArticleNav,
  type RenderableSection,
} from "@/lib/constitution/article-nav";
import { sanitizeConstitutionHtml } from "@/lib/constitution/sanitize-html";
import type { ConstitutionDetail } from "@/lib/db/queries-constitution";

interface ConstitutionReadingColumnProps {
  constitution: ConstitutionDetail;
  /** Constitute source last_sync_at, for the provenance dot. */
  sourceRetrievedAt: string | null;
  /** Optional route back to the multi-country Constitution Explorer. */
  explorerHref?: string;
  /**
   * Reports the topic keys of the section currently in view, so the
   * cross-reference pane can surface them as one-click chips.
   */
  onActiveTopicsChange?: (topics: string[]) => void;
}

/** Human year range for the metadata line. */
function yearLine(year: number | null, yearUpdated: number | null): string {
  if (year && yearUpdated && yearUpdated !== year) {
    return `Enacted ${year} · last amended ${yearUpdated}`;
  }
  if (year) return `Enacted ${year}`;
  if (yearUpdated) return `Last amended ${yearUpdated}`;
  return "Date unknown";
}

export function ConstitutionReadingColumn({
  constitution,
  sourceRetrievedAt,
  explorerHref,
  onActiveTopicsChange,
}: ConstitutionReadingColumnProps) {
  const { sections, groups } = useMemo(
    () => buildArticleNav(constitution.articles),
    [constitution.articles],
  );

  // Sanitize each section's Constitute HTML once (allowlist — preserves ids,
  // classes and data-* the reader depends on; drops scripts/handlers). Keyed
  // by DOM id so scroll-spy stays aligned.
  const sanitizedByDomId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) m.set(s.domId, sanitizeConstitutionHtml(s.html));
    return m;
  }, [sections]);

  // Scroll-spy across every section DOM id (parts + articles).
  const sectionIds = useMemo(() => sections.map((s) => s.domId), [sections]);
  const active = useActiveSection(sectionIds);

  // Map domId → topics so we can report the in-view section's topics upward.
  const topicsByDomId = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of sections) m.set(s.domId, s.topics);
    return m;
  }, [sections]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [outlineOpen, setOutlineOpen] = useState(false);
  const outlineId = useId();

  const activeLabel = useMemo(() => {
    for (const group of groups) {
      if (active === group.id) return group.label;
      const entry = group.entries.find((candidate) => candidate.id === active);
      if (entry) return entry.label;
    }
    return "Browse sections";
  }, [active, groups]);

  useEffect(() => {
    if (!onActiveTopicsChange) return;
    onActiveTopicsChange(topicsByDomId.get(active) ?? []);
  }, [active, topicsByDomId, onActiveTopicsChange]);

  useEffect(() => {
    const focusHashTarget = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !sectionIds.includes(id)) return;
      const target = document.getElementById(id);
      if (!(target instanceof HTMLElement)) return;
      target.focus({ preventScroll: true });
    };
    focusHashTarget();
    window.addEventListener("hashchange", focusHashTarget);
    return () => window.removeEventListener("hashchange", focusHashTarget);
  }, [sectionIds]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (56 + 16);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    setOutlineOpen(false);
  };

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="constitution-reader">
      <div className="constitution-reader-header">
        <div className="constitution-reader-meta">
          <span>{yearLine(constitution.year, constitution.yearUpdated)}</span>
          <SourceDot source="constitute_project" retrievedAt={sourceRetrievedAt} />
        </div>
        <div className="constitution-reader-attribution-row">
          <p className="constitution-reader-attribution">
            Text from the{" "}
            <a
              href={
                constitution.constituteProjectId
                  ? `https://www.constituteproject.org/constitution/${encodeURIComponent(constitution.constituteProjectId)}`
                  : "https://www.constituteproject.org/"
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Constitute Project
            </a>{" "}
            (Elkins, Ginsburg &amp; Melton), CC BY-NC 3.0.
          </p>
          {explorerHref ? (
            <Link className="btn btn--secondary btn--sm" href={explorerHref}>
              Open in the Constitution Explorer
              <span className="btn__arrow" aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="constitution-reader-layout">
        {/* In-column article nav — grouped by part where headings allow. */}
        <nav
          className="constitution-reader-nav"
          aria-label={`${constitution.name} constitution outline`}
        >
          <div className="constitution-reader-nav-title">Outline</div>
          <button
            type="button"
            className="constitution-reader-nav-toggle"
            aria-expanded={outlineOpen}
            aria-controls={outlineId}
            onClick={() => setOutlineOpen((value) => !value)}
          >
            <span>Outline</span>
            <span className="constitution-reader-nav-current">
              {activeLabel}
            </span>
            <span className="constitution-reader-nav-toggle-icon" aria-hidden>
              ↓
            </span>
          </button>
          <ol
            id={outlineId}
            className="constitution-reader-nav-list"
            data-mobile-open={outlineOpen ? "true" : "false"}
          >
            {groups.map((group) => {
              const isSingleGroup = groups.length === 1;
              const expanded = isSingleGroup || openGroups.has(group.id);
              const groupActive = group.entries.some((e) => e.id === active);
              return (
                <li key={group.id} className="constitution-reader-nav-group">
                  <button
                    type="button"
                    className={`constitution-reader-nav-part${
                      active === group.id || groupActive ? " is-active" : ""
                    }`}
                    aria-expanded={expanded}
                    aria-controls={`${outlineId}-${group.id}`}
                    onClick={() => {
                      if (isSingleGroup) {
                        scrollTo(group.entries[0]?.id ?? group.id);
                      } else {
                        toggleGroup(group.id);
                      }
                    }}
                  >
                    {group.label}
                  </button>
                  {expanded && group.entries.length > 0 ? (
                    <ol
                      id={`${outlineId}-${group.id}`}
                      className="constitution-reader-nav-articles"
                    >
                      {group.entries.map((entry) => (
                        <li key={entry.id}>
                          <a
                            href={`#${entry.id}`}
                            className={`constitution-reader-nav-article${
                              entry.id === active ? " is-active" : ""
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              scrollTo(entry.id);
                            }}
                          >
                            {entry.label}
                          </a>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* The reading column. */}
        <article className="constitution-reader-body">
          {sections.map((section: RenderableSection) => (
            <section
              key={section.domId}
              id={section.domId}
              tabIndex={-1}
              className={`constitution-section${
                section.partId ? " constitution-section--part" : ""
              }`}
              // Section HTML is Constitute-derived (parsed at ingest), passed
              // through an allowlist sanitizer at this render seam as a
              // defense-in-depth measure against stored HTML that could later
              // carry markup we don't trust.
              dangerouslySetInnerHTML={{
                __html: sanitizedByDomId.get(section.domId) ?? "",
              }}
            />
          ))}
        </article>
      </div>
    </div>
  );
}
