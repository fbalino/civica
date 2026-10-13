import { createHash } from "node:crypto";

/**
 * APR-D179 — decide which cached pages `operations.refresh-pages` rebuilds.
 *
 * Every night the job fingerprints the database content each page group
 * renders and compares it with the fingerprint stored when that group was
 * last rebuilt successfully. Only changed groups are invalidated and warmed,
 * so an unchanged page is never rewritten into the page cache.
 *
 * Page groups:
 * - one per country: `/country/<slug>`, `/civica-data`, and `/constitution`
 *   (the three tabs share one layout and are rebuilt together);
 * - one `site` group: every other cached page (home, rankings, leaders,
 *   organizations, methodology, the sitemap, and so on).
 *
 * Each stored country value combines the global fingerprint (the country
 * list, source metadata, and release pointers every country page reads) with
 * that country's own fingerprint, so a global change rebuilds every country.
 * The site value combines the global fingerprint, every country's
 * fingerprint, and the site-only inputs, so any change anywhere rebuilds the
 * non-country pages.
 */

/** Names the dependency map. Changing it rebuilds every page once. */
export const PAGE_FINGERPRINT_VERSION = "page-fingerprint/v1";

export const SITE_PAGE_KEY = "site";

export function countryPageKey(jurisdictionId: string): string {
  return `country:${jurisdictionId}`;
}

export interface CountryFingerprint {
  jurisdictionId: string;
  slug: string;
  /** Digest of the rows this country's three tabs render. */
  fingerprint: string;
}

export interface CurrentFingerprints {
  /** Inputs every page reads (country list, sources, release pointers). */
  global: string;
  /** Inputs only non-country pages read. */
  site: string;
  countries: readonly CountryFingerprint[];
}

export interface StoredFingerprint {
  fingerprint: string;
  fingerprintVersion: string;
}

export type PageRebuildForce =
  | { kind: "none" }
  | { kind: "all" }
  | { kind: "countries"; slugs: readonly string[] };

export interface PageRebuildEntry {
  pageKey: string;
  fingerprint: string;
}

export interface CountryRebuild extends PageRebuildEntry {
  slug: string;
  reason: "new" | "changed" | "forced";
}

export interface PageRebuildPlan {
  countries: CountryRebuild[];
  unchangedCountries: number;
  /** Null when the non-country pages are unchanged. */
  site: (PageRebuildEntry & { reason: "new" | "changed" | "forced" }) | null;
  /** Forced slugs that match no country. */
  unknownSlugs: string[];
}

function sha256(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\n");
  }
  return hash.digest("hex");
}

/** Stored value for one country: version + global + the country's own. */
export function combinedCountryFingerprint(
  global: string,
  country: string,
): string {
  return sha256([PAGE_FINGERPRINT_VERSION, "country", global, country]);
}

/** Stored value for the non-country pages. */
export function combinedSiteFingerprint(current: CurrentFingerprints): string {
  const countries = [...current.countries]
    .sort((left, right) =>
      left.jurisdictionId.localeCompare(right.jurisdictionId),
    )
    .map((row) => `${row.jurisdictionId}=${row.fingerprint}`);
  return sha256([
    PAGE_FINGERPRINT_VERSION,
    "site",
    current.global,
    current.site,
    ...countries,
  ]);
}

function changeReason(
  stored: StoredFingerprint | undefined,
  fingerprint: string,
): "new" | "changed" | null {
  if (!stored) return "new";
  if (
    stored.fingerprintVersion !== PAGE_FINGERPRINT_VERSION ||
    stored.fingerprint !== fingerprint
  ) {
    return "changed";
  }
  return null;
}

/**
 * Compare the current fingerprints with the stored ones. Unchanged groups
 * are left alone; a forced rebuild ignores the stored value for its scope.
 */
export function planPageRebuild(
  current: CurrentFingerprints,
  stored: ReadonlyMap<string, StoredFingerprint>,
  force: PageRebuildForce = { kind: "none" },
): PageRebuildPlan {
  const forcedSlugs = new Set(force.kind === "countries" ? force.slugs : []);
  const knownSlugs = new Set(current.countries.map((row) => row.slug));
  const countries: CountryRebuild[] = [];
  let unchangedCountries = 0;
  for (const row of [...current.countries].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  )) {
    const pageKey = countryPageKey(row.jurisdictionId);
    const fingerprint = combinedCountryFingerprint(
      current.global,
      row.fingerprint,
    );
    const reason =
      force.kind === "all" || forcedSlugs.has(row.slug)
        ? "forced"
        : changeReason(stored.get(pageKey), fingerprint);
    if (reason) countries.push({ pageKey, fingerprint, slug: row.slug, reason });
    else unchangedCountries += 1;
  }

  const siteFingerprint = combinedSiteFingerprint(current);
  const siteReason =
    force.kind === "all"
      ? "forced"
      : changeReason(stored.get(SITE_PAGE_KEY), siteFingerprint);

  return {
    countries,
    unchangedCountries,
    site: siteReason
      ? { pageKey: SITE_PAGE_KEY, fingerprint: siteFingerprint, reason: siteReason }
      : null,
    unknownSlugs: [...forcedSlugs].filter((slug) => !knownSlugs.has(slug)).sort(),
  };
}

/** The three country tab paths rebuilt together for one country. */
export function countryPagePaths(slug: string): string[] {
  return [
    `/country/${slug}`,
    `/country/${slug}/civica-data`,
    `/country/${slug}/constitution`,
  ];
}

/** True for a path that belongs to a country page group. */
export function isCountryPagePath(path: string): boolean {
  return /^\/country\/[^/]+(?:\/civica-data|\/constitution)?$/.test(path) &&
    !path.startsWith("/country/methodology");
}

/**
 * Fingerprints to store after the warm-up: a group is stored only when none
 * of its warmed paths failed, so a failed group is retried on the next run.
 */
export function fingerprintsToStore(
  plan: PageRebuildPlan,
  warmedPathsByGroup: ReadonlyMap<string, readonly string[]>,
  unrefreshedPaths: ReadonlySet<string>,
): PageRebuildEntry[] {
  const groups: PageRebuildEntry[] = [
    ...plan.countries,
    ...(plan.site ? [plan.site] : []),
  ];
  return groups
    .filter((group) => {
      const paths = warmedPathsByGroup.get(group.pageKey);
      // A group with no warm targets (for example, a country absent from the
      // sitemap) was never rebuilt, so its fingerprint is not stored.
      return (
        paths !== undefined &&
        paths.length > 0 &&
        paths.every((path) => !unrefreshedPaths.has(path))
      );
    })
    .map(({ pageKey, fingerprint }) => ({ pageKey, fingerprint }));
}
