export type IndexNavItem = {
  href: string;
  label: string;
  descriptor: string;
};

export type IndexNavGroup = {
  label: string;
  items: IndexNavItem[];
};

export const INDEX_NAV_GROUPS: IndexNavGroup[] = [
  {
    label: "Index",
    items: [
      { href: "/civica-index", label: "Overview", descriptor: "Index home" },
      {
        href: "/civica-index/government-types",
        label: "Government Types",
        descriptor: "Taxonomy",
      },
      {
        href: "/civica-index/pulse-changelog",
        label: "Pulse Changelog",
        descriptor: "Daily changes",
      },
    ],
  },
  {
    label: "Methodology",
    items: [
      {
        href: "/civica-index/methodology",
        label: "Methodology",
        descriptor: "Scoring model",
      },
      {
        href: "/civica-index/methodology/peer-grouping",
        label: "Peer Grouping",
        descriptor: "Comparison sets",
      },
      {
        href: "/civica-index/methodology/pulse",
        label: "Pulse Methodology",
        descriptor: "Event scoring",
      },
      {
        href: "/civica-index/methodology/pca-appendix",
        label: "PCA Appendix",
        descriptor: "Factor analysis",
      },
      {
        href: "/civica-index/methodology/pulse/backtest",
        label: "Pulse Backtest",
        descriptor: "Validation",
      },
      {
        href: "/civica-index/methodology/peer-grouping/migration",
        label: "Migration Table",
        descriptor: "Peer fields",
      },
    ],
  },
  {
    label: "Use / Verify",
    items: [
      {
        href: "/civica-index/replication",
        label: "Replication",
        descriptor: "Academic use",
      },
      { href: "/civica-index/widget", label: "Widgets", descriptor: "Embeds" },
      {
        href: "/civica-index/corrections",
        label: "Corrections",
        descriptor: "Data fixes",
      },
    ],
  },
];
