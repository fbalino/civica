"use client";

import { useState } from "react";

interface FactbookSectionNavProps {
  sections: string[];
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SECTION_LABELS: Record<string, string> = {
  introduction: "Overview",
  government: "Government",
  economy: "Economy",
  people_and_society: "People & Society",
  geography: "Geography",
  military_and_security: "Military",
  energy: "Energy",
  communications: "Communications",
  transportation: "Transport",
  transnational_issues: "Transnational",
  environment: "Environment",
};

function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FactbookSectionNav({
  sections,
  activeSection,
  onSectionChange,
}: FactbookSectionNavProps) {
  return (
    <nav
      className="flex gap-0.5 overflow-x-auto border-b border-[var(--color-border)] pb-px -mb-px scrollbar-none"
      role="tablist"
      aria-label="Factbook sections"
    >
      {sections.map((section) => {
        const isActive = section === activeSection;
        return (
          <button
            key={section}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSectionChange(section)}
            className={`tab-nav ${isActive ? "tab-nav--active" : ""}`}
          >
            {sectionLabel(section)}
          </button>
        );
      })}
    </nav>
  );
}

export function FactbookSectionTabs({
  sections,
  defaultSection,
  children,
}: {
  sections: string[];
  defaultSection?: string;
  children: React.ReactNode[];
}) {
  const [active, setActive] = useState(defaultSection ?? sections[0] ?? "");
  const activeIndex = sections.indexOf(active);

  return (
    <div>
      <FactbookSectionNav
        sections={sections}
        activeSection={active}
        onSectionChange={setActive}
      />
      <div className="mt-6" role="tabpanel">
        {children[activeIndex >= 0 ? activeIndex : 0]}
      </div>
    </div>
  );
}
