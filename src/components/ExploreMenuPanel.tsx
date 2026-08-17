"use client";

import Link from "next/link";

import {
  EXPLORE_NAV_GROUPS,
  type ExploreNavGroup,
} from "@/components/exploreNavItems";

/**
 * The Explore dropdown body: a plain grouped link list, matching the
 * Governance Evidence / Methodology dropdowns. The two canonical groups
 * ("Start with a place" / "Research tools") come from exploreNavItems.ts and
 * are shared with the mobile menu, so the destination set can never fork.
 */
export function ExploreMenuPanel({
  isActiveHref = () => false,
  onNavigate,
  idPrefix = "explore-menu",
  groups = EXPLORE_NAV_GROUPS,
}: {
  isActiveHref?: (href: string) => boolean;
  onNavigate?: () => void;
  idPrefix?: string;
  groups?: readonly ExploreNavGroup[];
}) {
  return (
    <>
      {groups.map((group, groupIndex) => {
        const labelId = `${idPrefix}-group-${groupIndex}`;
        return (
          <div
            className="nav-dropdown-group"
            role="group"
            aria-labelledby={labelId}
            key={group.label}
          >
            <p className="nav-dropdown-group-label" id={labelId}>
              {group.label}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-dropdown-item explore-item ${
                  isActiveHref(item.href) ? "explore-item--active" : ""
                }`}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
