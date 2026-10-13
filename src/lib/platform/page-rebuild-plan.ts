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
 *   (the three tabs share one layout and are rebuilt together). These are
 *   fingerprinted, about 760 of the roughly 830 cached URLs;
 * - one `site` group: every other cached page (home, rankings, leaders,
 *   organizations, methodology, the sitemap, and so on). It is rebuilt every
 *   night without a fingerprint: those pages read many tables across the
 *   site, and an incomplete dependency list would leave one stale for up to
 *   the 30-day backstop.
 *
 * Each stored country value combines the global fingerprint (the country
 * list, source metadata, and release pointers every country page reads) with
 * that country's own fingerprint, so a global change rebuilds every country.
 */

/** Names the dependency map. Changing it rebuilds every page once. */
export const PAGE_FINGERPRINT_VERSION = "page-fingerprint/v1";

export const SITE_PAGE_KEY = "site";

const COUNTRY_PAGE_KEY_PREFIX = "country:";

/**
 * Keyed by slug, not jurisdiction id, so a slug that disappears (renamed,
 * hidden, or removed) is detectable and its old URLs can be invalidated.
 */
export function countryPageKey(slug: string): string {
  return `${COUNTRY_PAGE_KEY_PREFIX}${slug}`;
}

export interface CountryFingerprint {
  jurisdictionId: string;
  slug: string;
  /** Digest of the rows this country's three tabs render. */
  fingerprint: string;
}

export interface CurrentFingerprints {
  /** Inputs every country page reads (country list, sources, releases). */
  global: string;
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
  /**
   * The non-country pages, rebuilt on every scheduled run and `force=all`.
   * Null only for a run forced for named countries.
   */
  site: { pageKey: string; reason: "nightly" | "forced" } | null;
  /** Forced slugs that match no country. */
  unknownSlugs: string[];
  /**
   * Slugs rebuilt in an earlier run that no current country has. Their old
   * URLs are invalidated and their stored fingerprints forgotten.
   */
  retiredSlugs: string[];
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
    const pageKey = countryPageKey(row.slug);
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

  return {
    countries,
    unchangedCountries,
    site:
      force.kind === "countries"
        ? null
        : {
            pageKey: SITE_PAGE_KEY,
            reason: force.kind === "all" ? "forced" : "nightly",
          },
    unknownSlugs: [...forcedSlugs].filter((slug) => !knownSlugs.has(slug)).sort(),
    retiredSlugs: [...stored.keys()]
      .filter((key) => key.startsWith(COUNTRY_PAGE_KEY_PREFIX))
      .map((key) => key.slice(COUNTRY_PAGE_KEY_PREFIX.length))
      .filter((slug) => !knownSlugs.has(slug))
      .sort(),
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
 * Country fingerprints to store after the warm-up: a country is stored only
 * when none of its warmed paths failed, so a failed country is retried on
 * the next run. The site group has no fingerprint.
 */
export function fingerprintsToStore(
  plan: PageRebuildPlan,
  warmedPathsByGroup: ReadonlyMap<string, readonly string[]>,
  unrefreshedPaths: ReadonlySet<string>,
): PageRebuildEntry[] {
  return plan.countries
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
