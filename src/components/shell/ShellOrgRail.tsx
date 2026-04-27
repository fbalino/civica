"use client";

import Link from "next/link";
import type { OrgGroup } from "@/components/atlas/organizations";
import { AtlasLeftModeToggle } from "./AtlasLeftModeToggle";

export interface ShellOrgRailProps {
  groups: OrgGroup[];
  /** Currently selected org slug (for the highlighted "on" row). */
  selectedSlug: string | null;
}

/**
 * Phase A.5 — Left rail used by /atlas/organizations/[slug]. Mirrors the
 * legacy AtlasCountryLeft "organizations" branch (deleted in df32da9):
 * categorized list of orgs, each row links to /atlas/organizations/<slug>.
 * Header includes the Countries ⇄ Organizations toggle.
 */
export function ShellOrgRail({ groups, selectedSlug }: ShellOrgRailProps) {
  return (
    <div className="chamber-left">
      <div className="left-side-head">
        <div className="kicker">Atlas</div>
        <div className="title">Pick an organization</div>
        <AtlasLeftModeToggle mode="organizations" />
      </div>

      <div className="left-org-list">
        {groups.length === 0 ? (
          <div
            className="atlas-mono"
            style={{
              fontSize: 11,
              color: "var(--atlas-muted)",
              padding: "30px 10px",
              textAlign: "center",
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            No data
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.type} className="type-group">
              <div className="type-label" style={{ color: g.color }}>
                {g.label}
              </div>
              {g.organizations.map((o) => {
                const initials = o.name.length <= 4 ? o.name : o.name.slice(0, 3);
                return (
                  <Link
                    key={o.id}
                    href={`/atlas/organizations/${o.slug}`}
                    className={`org-row${selectedSlug === o.slug ? " on" : ""}`}
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
          ))
        )}
      </div>
    </div>
  );
}
