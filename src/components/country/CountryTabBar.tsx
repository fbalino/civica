"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface CountryTabBarProps {
  slug: string;
}

// Three-tab strip for the unified /country/[slug] page (Factbook ·
// Civica Data · Constitution). Rendered under the masthead via the
// FactbookHeaderStrip post-hero `nav` prop. Uses the canonical `.tab-nav` /
// `.tab-nav--active` pattern (mixed-case Inter + accent underline) —
// matches the global header NavLinks. Layout (horizontal row + bottom
// hairline rule) lives in `.country-tabbar` in factbook.css.
export function CountryTabBar({ slug }: CountryTabBarProps) {
  const pathname = usePathname();

  const factbookHref = `/country/${slug}`;
  const civicaDataHref = `/country/${slug}/civica-data`;
  const constitutionHref = `/country/${slug}/constitution`;

  // Factbook is the index tab — exact match only, so the sub-tab routes
  // don't also light it up. The others match a prefix so any deeper
  // sub-route stays highlighted.
  const tabs: Array<{ href: string; label: string; active: boolean }> = [
    {
      href: factbookHref,
      label: "Factbook",
      active: pathname === factbookHref,
    },
    {
      href: civicaDataHref,
      label: "Civica Data",
      active: pathname === civicaDataHref || pathname.startsWith(civicaDataHref + "/"),
    },
    {
      href: constitutionHref,
      label: "Constitution",
      active:
        pathname === constitutionHref ||
        pathname.startsWith(constitutionHref + "/"),
    },
  ];

  return (
    <nav aria-label="Country sections" className="country-tabbar">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`tab-nav ${tab.active ? "tab-nav--active" : ""}`}
          aria-current={tab.active ? "page" : undefined}
          style={{ textDecoration: "none" }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
