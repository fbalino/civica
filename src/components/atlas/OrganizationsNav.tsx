"use client";

import Link from "next/link";
import type { OrgGroup } from "./organizations";

export interface OrganizationsNavProps {
  groups: OrgGroup[];
  /** Currently selected org slug (for the highlighted "on" row). */
  selectedSlug: string | null;
}

/**
 * Standalone /organizations picker (Option B, Phase 2). Categorized list of
 * international organizations; each row links to /organizations/<slug>.
 * Replaces the shell's ShellOrgRail left rail — no shell mode toggle, no
 * ShellContext. Layout lives in atlas.css under `.org-standalone`.
 */
export function OrganizationsNav({ groups, selectedSlug }: OrganizationsNavProps) {
  return (
    <nav className="org-standalone-nav" aria-label="International organizations">
      {groups.map((g) => (
        <div key={g.type} className="type-group">
          <div className="type-label" style={{ color: g.color }}>
            {g.label}
          </div>
          {g.organizations.map((o) => {
            const initials = o.name.length <= 4 ? o.name : o.name.slice(0, 3);
            return (
              <Link
                key={o.id}
                href={`/organizations/${o.slug}`}
                className={`org-row${selectedSlug === o.slug ? " on" : ""}`}
                aria-current={selectedSlug === o.slug ? "page" : undefined}
              >
                <span className="initials" style={{ background: g.color }}>
                  {initials}
                </span>
                <span className="nm">{o.name}</span>
                <span className="count">{o.memberCount}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
