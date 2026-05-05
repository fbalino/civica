"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  "api-docs": "API docs",
  approach: "How we approach data",
  backtest: "Backtest report",
  "civica-index": "Civica Index",
  factbook: "Factbook",
  methodology: "Methodology",
  migration: "Migration table",
  "pca-appendix": "PCA appendix",
  "peer-grouping": "Peer grouping",
  pulse: "Pulse methodology",
  reconciliation: "Reconciliation",
  disputes: "Disputes",
};

function labelForSegment(segment: string): string {
  const knownLabel = ROUTE_LABELS[segment];
  if (knownLabel) return knownLabel;

  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SmartBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isCurrent = index === segments.length - 1;

    return {
      href,
      isCurrent,
      label: labelForSegment(segment),
    };
  });

  return (
    <nav className="editorial-breadcrumbs" aria-label="Breadcrumb">
      <ol className="editorial-breadcrumbs-list">
        {crumbs.map((crumb) => (
          <li className="editorial-breadcrumbs-item" key={crumb.href}>
            {crumb.isCurrent ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link href={crumb.href}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
