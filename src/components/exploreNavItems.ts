/**
 * The "Explore" megamenu — the single top-level browse surface in the site
 * header. Consolidates the eight destination pages a reader browses to
 * (countries/places + politics/data) under one trigger, replacing the old
 * flat Countries / Parties / Atlas / Compare / Constitutions nav links.
 *
 * Shared by the desktop megamenu (`NavLinks`) and the mobile accordion
 * (`MobileNav`) so the two never drift. Each entry pairs with a spot
 * engraving (`public/engravings/navigation/spot-*.webp` + `-dark` variant)
 * chosen to evoke the destination. They are compact 96px derived assets;
 * the shared themed renderer transfers only the active variant.
 *
 * Every href resolves to a real route under `src/app` (verified against the
 * routing tree). Keep this list in sync with those routes.
 */
export type ExploreNavItem = {
  href: string;
  label: string;
  description: string;
  /** Compact navigation-engraving basename: spot-{engraving}{-dark}.webp */
  engraving: "laurel" | "globe" | "compass" | "column" | "ship" | "mountains";
};

export type ExploreNavGroup = {
  label: string;
  items: ExploreNavItem[];
};

export const EXPLORE_NAV_GROUPS: ExploreNavGroup[] = [
  {
    label: "Countries & Places",
    items: [
      {
        href: "/country",
        label: "Countries",
        description: "Every country, profiled in full",
        engraving: "laurel",
      },
      {
        href: "/atlas",
        label: "World Atlas",
        description: "Explore governments on the map",
        engraving: "globe",
      },
      {
        href: "/compare",
        label: "Compare",
        description: "Two countries, side by side",
        engraving: "compass",
      },
      {
        href: "/constitution",
        label: "Constitutions",
        description: "Read and compare founding texts",
        engraving: "column",
      },
    ],
  },
  {
    label: "Politics & Data",
    items: [
      {
        href: "/parties",
        label: "Parties",
        description: "Ideology, seats and coalitions",
        engraving: "ship",
      },
      {
        href: "/elections",
        label: "Elections",
        description: "Audited records, projections and gaps",
        engraving: "compass",
      },
      {
        href: "/rankings",
        label: "Rankings",
        description: "Every country, ordered by measure",
        engraving: "mountains",
      },
      {
        href: "/organizations",
        label: "Organizations",
        description: "Blocs, unions and memberships",
        engraving: "globe",
      },
    ],
  },
];
