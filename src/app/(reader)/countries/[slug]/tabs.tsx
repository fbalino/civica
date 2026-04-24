"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function CountryTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--color-divider)",
          margin: "28px 0 32px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`tab-nav ${tab.id === active ? "tab-nav--active" : ""}`}
            role="tab"
            aria-selected={tab.id === active}
            aria-controls={`tabpanel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tabpanel-${active}`}>
        {activeTab?.content}
      </div>
    </div>
  );
}
