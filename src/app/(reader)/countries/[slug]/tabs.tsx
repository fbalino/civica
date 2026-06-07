"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function CountryTabs({ tabs }: { tabs: Tab[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const requestedTab = searchParams.get("tab");
  const active =
    requestedTab && tabIds.has(requestedTab) ? requestedTab : tabs[0]?.id ?? "";

  function activateTab(tabId: string) {
    const params = new URLSearchParams(searchParams);
    if (tabId === tabs[0]?.id) {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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
            onClick={() => activateTab(tab.id)}
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
