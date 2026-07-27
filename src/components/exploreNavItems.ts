/**
 * The "Explore" megamenu — the single top-level browse surface in the site
 * header. Consolidates the eight destination pages a reader browses to
 * (countries/places + politics/data) under one trigger, replacing the old
 * flat Countries / Parties / Atlas / Compare / Constitutions nav links.
 *
 * Shared by the desktop megamenu (`NavLinks`) and the full-screen mobile
 * menu (`MobileNav`) so the two never drift. Each entry pairs with its own
 * destination-specific Explore illustration
 * (`public/engravings/navigation/explore-*.webp` + `-dark` variant). The
 * shared themed renderer mounts them only while navigation is open and
 * transfers only the active theme.
 *
 * Every href resolves to a real route under `src/app` (verified against the
 * routing tree). Keep this list in sync with those routes.
 */
export type ExploreNavItem = {
  href: string;
  label: string;
  description: string;
  /** Destination-specific basename: explore-{art}{-dark}.webp */
  art:
    | "countries"
    | "world-atlas"
    | "compare"
    | "constitutions"
    | "parties"
    | "elections"
    | "rankings"
    | "organizations";
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
        art: "countries",
      },
      {
        href: "/atlas",
        label: "World Atlas",
        description: "Explore governments on the map",
        art: "world-atlas",
      },
      {
        href: "/compare",
        label: "Compare",
        description: "Two countries, side by side",
        art: "compare",
      },
      {
        href: "/constitution",
        label: "Constitutions",
        description: "Read and compare founding texts",
        art: "constitutions",
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
        art: "parties",
      },
      {
        href: "/elections",
        label: "Elections",
        description: "Audited records, projections and gaps",
        art: "elections",
      },
      {
        href: "/rankings",
        label: "Rankings",
        description: "Every country, ordered by measure",
        art: "rankings",
      },
      {
        href: "/organizations",
        label: "Organizations",
        description: "Blocs, unions and memberships",
        art: "organizations",
      },
    ],
  },
];
