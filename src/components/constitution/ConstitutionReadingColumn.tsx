"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveSection } from "@/hooks/useActiveSection";
import { SourceDot } from "@/components/SourceDot";
import {
  buildArticleNav,
  type RenderableSection,
} from "@/lib/constitution/article-nav";
import type { ConstitutionDetail } from "@/lib/db/queries-constitution";

interface ConstitutionReadingColumnProps {
  constitution: ConstitutionDetail;
  /** Constitute source last_sync_at, for the provenance dot. */
  sourceRetrievedAt: string | null;
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
  onActiveTopicsChange,
}: ConstitutionReadingColumnProps) {
  const { sections, groups } = useMemo(
    () => buildArticleNav(constitution.articles),
    [constitution.articles],
  );

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

  useEffect(() => {
    if (!onActiveTopicsChange) return;
    onActiveTopicsChange(topicsByDomId.get(active) ?? []);
  }, [active, topicsByDomId, onActiveTopicsChange]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (56 + 16);
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
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
      </div>

      <div className="constitution-reader-layout">
        {/* In-column article nav — grouped by part where headings allow. */}
        <nav
          className="constitution-reader-nav"
          aria-label={`${constitution.name} constitution outline`}
        >
          <div className="constitution-reader-nav-title">Outline</div>
          <ol className="constitution-reader-nav-list">
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
                    onClick={() => {
                      if (!isSingleGroup) toggleGroup(group.id);
                      scrollTo(group.entries[0]?.id ?? group.id);
                    }}
                  >
                    {group.label}
                  </button>
                  {expanded && group.entries.length > 0 ? (
                    <ol className="constitution-reader-nav-articles">
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
              className={`constitution-section${
                section.partId ? " constitution-section--part" : ""
              }`}
              // Section HTML is sourced from our own DB (parsed Constitute
              // text at ingest time), not user input — safe to render.
              dangerouslySetInnerHTML={{ __html: section.html }}
            />
          ))}
        </article>
      </div>
    </div>
  );
}
