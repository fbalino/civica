export type EditorialNavItem = {
  href: string;
  label: string;
  descriptor: string;
};

/**
 * The two editorial destinations shown after the Methodology dropdown in
 * the desktop primary nav (`NavLinks`) and inside the mobile menu's
 * "reading room" column (`MobileNav`). Shared so the two surfaces cannot
 * drift on label, href, or order — see EXP-018.
 */
export const EDITORIAL_NAV_ITEMS: EditorialNavItem[] = [
  { href: "/blog", label: "The Record", descriptor: "Essays and dispatches" },
  {
    href: "/about",
    label: "About",
    descriptor: "Mission and editorial standards",
  },
];
