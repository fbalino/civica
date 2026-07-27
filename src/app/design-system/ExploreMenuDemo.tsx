import Link from "next/link";
import { EXPLORE_NAV_GROUPS } from "@/components/exploreNavItems";

/**
 * Static, always-open rendering of the "Explore" megamenu panel for the
 * /design-system showcase. Reuses the exact `.explore-menu` classes and the
 * shared `EXPLORE_NAV_GROUPS` source the live header consumes — so the demo
 * can never drift from the shipped component. The `.explore-menu--static`
 * modifier just unpins it from the absolute dropdown position and forces it
 * visible; every other style is inherited from globals.css.
 */
export function ExploreMenuDemo() {
  return (
    <div className="nav-dropdown-menu explore-menu explore-menu--static" role="menu" aria-label="Explore Civica Atlas">
      {EXPLORE_NAV_GROUPS.map((group) => (
        <div className="explore-col" key={group.label} role="none">
          <p className="explore-col-label">{group.label}</p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="explore-item"
            >
              <span className="explore-item__engraving" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="theme-engraving-light" src={`/engravings/spot-${item.engraving}.webp`} alt="" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="theme-engraving-dark" src={`/engravings/spot-${item.engraving}-dark.webp`} alt="" aria-hidden="true" />
              </span>
              <span className="explore-item__body">
                <span className="explore-item__name">{item.label}</span>
                <span className="explore-item__desc">{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
