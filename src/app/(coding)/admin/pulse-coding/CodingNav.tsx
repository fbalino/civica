"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PulseCodingRole } from "@/lib/pulse/v2/coding-workspace";

const ROLE_LINKS: Record<PulseCodingRole, Array<{ href: string; label: string }>> = {
  coder: [{ href: "/admin/pulse-coding", label: "My assignments" }],
  adjudicator: [
    { href: "/admin/pulse-coding", label: "Adjudication" },
    { href: "/admin/pulse-coding/exports", label: "Exports" },
  ],
  study_admin: [
    { href: "/admin/pulse-coding", label: "Study status" },
    { href: "/admin/pulse-coding/participants", label: "Access" },
    { href: "/admin/pulse-coding/exports", label: "Exports" },
  ],
};

export function CodingNav({ role }: { role: PulseCodingRole }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="admin-nav" aria-label="Independent coding sections">
      <h2 className="admin-nav-title">Research coding</h2>
      <ul className="admin-nav-list">
        {ROLE_LINKS[role].map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin/pulse-coding" &&
              pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`admin-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="admin-nav-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="admin-nav-secondary">
        <p className="admin-nav-context">
          Production review and model output are outside this workspace.
        </p>
      </div>
    </nav>
  );
}
