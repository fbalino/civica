/**
 * Canonical route ledger for the browser harness. One entry per canonical
 * layout and primary reader route, used by the responsive matrix (EXP-019)
 * and reader-journey suites (QA-010).
 *
 * `layout` names the DESIGN.md layout row the route uses, so a failure can
 * be attributed to a shared shell rather than a one-off page.
 */

export type CanonicalRoute = {
  name: string;
  path: string;
  layout:
    | "home"
    | "reader-full"
    | "reader-wide"
    | "reader-narrow"
    | "methodology"
    | "country-tabs"
    | "atlas"
    | "not-found";
};

/** A country slug verified to exist with rich data (used for country tabs). */
export const SAMPLE_COUNTRY_SLUG = "switzerland";

export const CANONICAL_ROUTES: CanonicalRoute[] = [
  { name: "home", path: "/", layout: "home" },
  { name: "countries-index", path: "/country", layout: "reader-full" },
  {
    name: "country-factbook",
    path: `/country/${SAMPLE_COUNTRY_SLUG}`,
    layout: "country-tabs",
  },
  {
    name: "country-civica-data",
    path: `/country/${SAMPLE_COUNTRY_SLUG}/civica-data`,
    layout: "country-tabs",
  },
  {
    name: "country-constitution",
    path: `/country/${SAMPLE_COUNTRY_SLUG}/constitution`,
    layout: "country-tabs",
  },
  { name: "atlas", path: "/atlas", layout: "atlas" },
  { name: "compare", path: "/compare", layout: "reader-full" },
  { name: "rankings", path: "/rankings", layout: "reader-full" },
  { name: "civica-index", path: "/civica-index", layout: "reader-full" },
  {
    name: "governance-evidence",
    path: "/governance-evidence",
    layout: "reader-full",
  },
  {
    name: "civica-conditions",
    path: "/civica-conditions",
    layout: "reader-full",
  },
  { name: "methodology", path: "/methodology", layout: "methodology" },
  {
    name: "methodology-approach",
    path: "/methodology/approach",
    layout: "methodology",
  },
  { name: "elections", path: "/elections", layout: "reader-full" },
  {
    name: "electoral-systems",
    path: "/elections/systems",
    layout: "reader-full",
  },
  { name: "organizations", path: "/organizations", layout: "reader-full" },
  { name: "parties", path: "/parties", layout: "reader-full" },
  { name: "glossary", path: "/glossary", layout: "reader-full" },
  { name: "blog-index", path: "/blog", layout: "reader-full" },
  { name: "api-docs", path: "/api-docs", layout: "reader-full" },
  { name: "design-system", path: "/design-system", layout: "reader-full" },
  { name: "about", path: "/about", layout: "reader-full" },
  {
    name: "advisory-board",
    path: "/about/advisory-board",
    layout: "reader-full",
  },
  { name: "accessibility", path: "/accessibility", layout: "reader-full" },
  { name: "licensing", path: "/licensing", layout: "methodology" },
  { name: "privacy", path: "/privacy", layout: "methodology" },
  { name: "terms", path: "/terms", layout: "methodology" },
  { name: "contact", path: "/contact", layout: "reader-narrow" },
  { name: "policies", path: "/policies", layout: "methodology" },
  {
    name: "not-found",
    path: "/__civica_probe_missing_route__",
    layout: "not-found",
  },
];
