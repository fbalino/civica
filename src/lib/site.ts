/**
 * Single source of truth for the public site's canonical origin and the
 * stable (non-request-time) release date used for sitemap entries that
 * carry no per-row timestamp (static routes, organization pages).
 *
 * CLM-013 (plan/MASTER-CHECKLIST.md): core metadata emitters — root layout,
 * sitemap, robots, OG helpers, and JSON-LD — import `SITE_URL`/`absoluteUrl`
 * from here. Remaining page-level absolute canonicals are checked by the
 * source validator and the all-sitemap live crawler, so a stale/preview host
 * cannot pass the metadata contract.
 *
 * `SITE_URL` is intentionally a hardcoded literal, not env-driven
 * (`NEXT_PUBLIC_SITE_URL`/`VERCEL_URL`). This is a single-domain product;
 * a preview-host fallback would reintroduce the stale-canonical risk this
 * module exists to eliminate.
 */
export const SITE_URL = "https://civicaatlas.org";

/**
 * Resolve a root-relative path (e.g. "/country/france") to an absolute
 * apex URL. "/" and "" both resolve to the bare origin, matching how Next
 * resolves a relative `alternates.canonical`/`openGraph.url` against
 * `metadataBase`.
 */
export function absoluteUrl(path: string): string {
  if (path === "" || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Checked-in release date for `sitemap.ts` `lastModified` on routes with no
 * real per-row timestamp to derive from (static pages, organization pages,
 * and either leg of a country-comparison pair whose jurisdiction rows carry
 * no `updatedAt`/`createdAt`). Bump this by hand when that static/org
 * content actually changes — never derive it from the request-time clock.
 * `sitemap.ts` must contain no argument-less `new Date()`; see
 * `scripts/validate-metadata.ts`.
 */
export const METADATA_CONTENT_RELEASE_DATE = "2026-07-10";
