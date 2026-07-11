export type IndexNavItem = {
  href: string;
  label: string;
  descriptor: string;
};

/**
 * Flat list of governance-evidence and related research pages.
 *
 * Methodology pages are NOT listed here — they live under the
 * top-level /methodology nav link (the methodology hub at
 * `src/app/(reader)/methodology/page.tsx` indexes every methodology
 * document on the site, including the Civica Index methodology).
 *
 * If you're tempted to re-add methodology entries to this dropdown,
 * remember the duplication problem: the methodology hub is the single
 * source of truth for methodology navigation. The Index dropdown is
 * for non-methodology Index sub-pages only.
 */
export const INDEX_NAV_ITEMS: IndexNavItem[] = [
  { href: "/governance-evidence", label: "Evidence Dashboard", descriptor: "Source-native observations" },
  { href: "/civica-index", label: "Research Status", descriptor: "Disposition and evidence" },
  {
    href: "/civica-index/pulse-changelog",
    label: "Pulse Changelog",
    descriptor: "Experimental event ledger",
  },
  {
    href: "/civica-index/replication",
    label: "Replication",
    descriptor: "Replication status",
  },
  {
    href: "/civica-index/corrections",
    label: "Corrections",
    descriptor: "Data fixes",
  },
];
