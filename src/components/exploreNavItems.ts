/**
 * The "Explore" dropdown — the single top-level browse surface in the site
 * header. Consolidates the eight destination pages a reader browses to
 * (countries/places + research tools) under one trigger, replacing the old
 * flat Countries / Parties / Atlas / Compare / Constitutions nav links.
 *
 * Shared by the desktop dropdown (`NavLinks` via `ExploreMenuPanel`) and the
 * full-screen mobile menu (`MobileNav`) so the two never drift. The desktop
 * dropdown renders labels only; the mobile menu also shows each entry's
 * one-line description.
 *
 * Every href resolves to a real route under `src/app` (verified against the
 * routing tree). Keep this list in sync with those routes.
 */
export type ExploreNavItem = {
  href: string;
  label: string;
  description: string;
};

export type ExploreNavGroup = {
  label: string;
  items: ExploreNavItem[];
};

export const EXPLORE_NAV_GROUPS: ExploreNavGroup[] = [
  {
    label: "Start with a place",
    items: [
      {
        href: "/country",
        label: "Countries",
        description: "Every country, profiled in full",
      },
      {
        href: "/atlas",
        label: "World Atlas",
        description: "Explore governments on the map",
      },
      {
        href: "/compare",
        label: "Compare",
        description: "Two countries, side by side",
      },
      {
        href: "/constitution",
        label: "Constitutions",
        description: "Read and compare founding texts",
      },
    ],
  },
  {
    label: "Research tools",
    items: [
      {
        href: "/parties",
        label: "Parties",
        description: "Ideology, seats and coalitions",
      },
      {
        href: "/elections",
        label: "Elections",
        description: "Audited records, projections and gaps",
      },
      {
        href: "/rankings",
        label: "Rankings",
        description: "Every country, ordered by measure",
      },
      {
        href: "/organizations",
        label: "Organizations",
        description: "Blocs, unions and memberships",
      },
    ],
  },
];
