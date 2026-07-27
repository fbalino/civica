export type MethodologyNavItem = {
  href: string;
  label: string;
  descriptor: string;
};

/**
 * Flat list of methodology pages shown in the "Methodology" dropdown
 * in the top nav (and the mobile nav drawer).
 *
 * The /methodology hub is the single source of truth for methodology
 * navigation — this list mirrors the entries the hub renders, with
 * one short label per page for the compact dropdown surface.
 *
 * If you add a new methodology page, add an entry here AND a card on
 * the /methodology hub at `src/app/(reader)/methodology/page.tsx`.
 * Keep them in sync.
 */
export const METHODOLOGY_NAV_ITEMS: MethodologyNavItem[] = [
  {
    href: "/methodology/approach",
    label: "Approach",
    descriptor: "Plain-English intro",
  },
  {
    href: "/country/methodology/reconciliation",
    label: "Reconciliation",
    descriptor: "Multi-source resolver",
  },
  {
    href: "/methodology/case-studies",
    label: "Case Studies",
    descriptor: "Frozen API reproductions",
  },
  {
    href: "/methodology/provenance-coverage",
    label: "Provenance Coverage",
    descriptor: "Fact-level audit",
  },
  {
    href: "/methodology/source-coverage",
    label: "Source Coverage",
    descriptor: "Domain-level audit",
  },
  {
    href: "/civica-index/methodology",
    label: "Civica Index",
    descriptor: "Composite scoring",
  },
  {
    href: "/civica-index/methodology/pca-appendix",
    label: "PCA Appendix",
    descriptor: "Weighting math",
  },
  {
    href: "/civica-index/methodology/pulse",
    label: "Pulse",
    descriptor: "Event classification",
  },
  {
    href: "/civica-index/methodology/pulse/backtest",
    label: "Pulse Backtest",
    descriptor: "Validation",
  },
  {
    href: "/civica-index/methodology/peer-grouping",
    label: "Peer Grouping",
    descriptor: "Comparison sets",
  },
];
