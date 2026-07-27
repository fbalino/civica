/**
 * Shared "is this nav trigger currently active" predicates for the primary
 * site nav. Desktop (`NavLinks`) highlights the Governance Evidence,
 * Methodology, and Explore triggers whenever the reader is anywhere inside
 * their respective sections, not just on an exact dropdown-item href.
 * Mobile (`MobileNav`) reuses the same predicates for its "Governance
 * Evidence" / "Methodology" group-title links so both surfaces highlight
 * identically — see EXP-018.
 */

/** Methodology pages physically live under /methodology, plus two nested
 * mounts: /civica-index/methodology* and /country/methodology*. */
export function isMethodologyGroupActive(pathname: string): boolean {
  return (
    pathname === "/methodology" ||
    pathname.startsWith("/methodology/") ||
    pathname.startsWith("/civica-index/methodology") ||
    pathname.startsWith("/country/methodology")
  );
}

/** Governance Evidence covers its own hub plus the whole /civica-index
 * research-status tree. This intentionally overlaps with
 * `/civica-index/methodology*`, so a reader on a Governance Evidence
 * methodology sub-page sees both the Governance Evidence and Methodology
 * triggers highlighted — a preserved characteristic of the existing nav,
 * not something callers need to work around. */
export function isGovernanceEvidenceGroupActive(pathname: string): boolean {
  return (
    pathname === "/governance-evidence" ||
    pathname === "/civica-index" ||
    pathname.startsWith("/civica-index/")
  );
}

function isHrefActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

/** The Explore trigger lights up when the reader is on any Explore
 * destination, except when Methodology also claims the path (their
 * `/country` prefixes overlap) — Methodology wins that overlap since the
 * reader is reading methodology, not browsing a country. */
export function isExploreGroupActive(
  pathname: string,
  exploreHrefs: readonly string[],
): boolean {
  return (
    !isMethodologyGroupActive(pathname) &&
    exploreHrefs.some((href) => isHrefActive(pathname, href))
  );
}
