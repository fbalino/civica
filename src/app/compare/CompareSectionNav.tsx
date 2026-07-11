"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "governance-evidence", label: "Evidence" },
  { id: "chambers", label: "Chambers" },
  { id: "elections", label: "Elections" },
  { id: "international", label: "International" },
];

interface CompareSectionNavProps {
  countryLabels: string[];
}

export function CompareSectionNav({ countryLabels }: CompareSectionNavProps) {
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const handlers: Record<string, (entry: IntersectionObserverEntry) => void> = {};

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (!el) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActive(section.id);
            }
          }
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
      handlers[section.id] = () => {};
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <nav className="compare-section-nav" aria-label="Compare sections">
      <div className="compare-section-nav-inner">
        <div className="compare-section-nav-countries" aria-hidden="true">
          {countryLabels.length === 0 ? (
            <span style={{ color: "var(--color-text-25)" }}>Select countries</span>
          ) : (
            countryLabels.join(" · ")
          )}
        </div>
        <div className="compare-section-nav-links">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`compare-section-nav-link${active === section.id ? " is-active" : ""}`}
            >
              {section.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
