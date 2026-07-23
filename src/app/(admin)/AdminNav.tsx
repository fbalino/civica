"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminCounts } from "@/lib/admin/counts";

/**
 * Left nav for the admin shell. Client component so it can highlight the active
 * section against the current pathname. Counts are computed server-side in the
 * layout and passed in as props (chrome, refreshed on each server render).
 *
 * Styling is entirely in `.admin-nav*` classes (admin.css) — tokens only.
 */

interface NavSection {
  href: string;
  label: string;
  count: number;
  /** Show the accent "attention" tone when count > 0. */
  attention: boolean;
}

/** Every nav destination, including the audit log below the divider — used
 *  so a deeper route only lights up its MOST SPECIFIC nav entry. */
const NAV_HREFS = [
  "/admin/pulse-review",
  "/admin/data-disputes",
  "/admin/advisory-applications",
  "/admin/messages",
  "/admin/corrections",
  "/admin/pulse-coding",
  "/admin/data-disputes/audit",
];

function isActive(pathname: string, href: string): boolean {
  // Exact match, or a deeper route under this section (detail pages) —
  // except when the deeper route is itself another nav entry (the audit log
  // lives under /admin/data-disputes/ but has its own nav item, and both
  // lighting up at once reads as a bug).
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !NAV_HREFS.some(
    (other) => other !== href && other.length > href.length && pathname.startsWith(other)
  );
}

function CountBadge({
  count,
  attention,
}: {
  count: number;
  attention: boolean;
}) {
  const cls = [
    "admin-nav-count",
    attention && count > 0 ? "admin-nav-count--attention" : "",
    count === 0 ? "admin-nav-count--zero" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} aria-label={`${count} items`}>
      {count}
    </span>
  );
}

export function AdminNav({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname() ?? "";

  const sections: NavSection[] = [
    {
      href: "/admin/pulse-review",
      label: "Pulse review",
      count: counts.pulsePending,
      attention: true,
    },
    {
      href: "/admin/data-disputes",
      label: "Data disputes",
      count: counts.disputesOpen,
      attention: true,
    },
    {
      href: "/admin/corrections",
      label: "Atlas corrections",
      count: counts.correctionsOpen,
      attention: true,
    },
    {
      href: "/admin/advisory-applications",
      label: "Advisory applications",
      count: counts.advisoryNew,
      attention: true,
    },
    {
      href: "/admin/messages",
      label: "Messages",
      count: counts.messagesNew,
      attention: true,
    },
  ];

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      <h2 className="admin-nav-title">Queues</h2>
      <ul className="admin-nav-list">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className={`admin-nav-link${
                isActive(pathname, s.href) ? " is-active" : ""
              }`}
              aria-current={isActive(pathname, s.href) ? "page" : undefined}
            >
              <span className="admin-nav-label">{s.label}</span>
              <CountBadge count={s.count} attention={s.attention} />
            </Link>
          </li>
        ))}
      </ul>

      <div className="admin-nav-secondary">
        <h2 className="admin-nav-title">Research coding</h2>
        <ul className="admin-nav-list">
          <li>
            <Link
              href="/admin/pulse-coding"
              className={`admin-nav-link${
                isActive(pathname, "/admin/pulse-coding") ? " is-active" : ""
              }`}
            >
              <span className="admin-nav-label">Independent coding</span>
              <CountBadge count={counts.codingReady} attention />
            </Link>
          </li>
        </ul>
      </div>

      <div className="admin-nav-secondary">
        <ul className="admin-nav-list">
          <li>
            <Link
              href="/admin/data-disputes/audit"
              className={`admin-nav-link${
                isActive(pathname, "/admin/data-disputes/audit")
                  ? " is-active"
                  : ""
              }`}
            >
              <span className="admin-nav-label">Audit log</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
