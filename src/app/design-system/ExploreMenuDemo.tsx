import { ExploreMenuPanel } from "@/components/ExploreMenuPanel";

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
    <div
      className="nav-dropdown-menu explore-menu explore-menu--static"
      aria-label="Explore Civica Atlas"
    >
      <ExploreMenuPanel
        shouldLoadArt
        idPrefix="design-system-explore-menu"
      />
    </div>
  );
}
