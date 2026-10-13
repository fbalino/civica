import {
  pageRefreshOutcome,
  type PageRefreshReport,
  type PageWarmTarget,
} from "@/lib/platform/page-refresh";
import {
  countryPageKey,
  countryPagePaths,
  fingerprintsToStore,
  isCountryPagePath,
  planPageRebuild,
  type CurrentFingerprints,
  type PageRebuildEntry,
  type PageRebuildForce,
  type StoredFingerprint,
} from "@/lib/platform/page-rebuild-plan";

/** The sitemap route is cached too; it is rebuilt with the non-country pages. */
export const SITEMAP_PATH = "/sitemap.xml";

/** Parse `?force=all` or `?force=<slug>[,<slug>]`. */
export function parsePageRebuildForce(value: string | null): PageRebuildForce {
  if (value === null) return { kind: "none" };
  if (value === "all") return { kind: "all" };
  return { kind: "countries", slugs: value.split(",") };
}

export interface PageRebuildDeps {
  readCurrent: () => Promise<CurrentFingerprints>;
  readStored: () => Promise<Map<string, StoredFingerprint>>;
  store: (entries: readonly PageRebuildEntry[]) => Promise<void>;
  /** Drop stored fingerprints for page groups that no longer exist. */
  forget: (pageKeys: readonly string[]) => Promise<void>;
  revalidate: (path: string) => void;
  refresh: (targets: readonly PageWarmTarget[]) => Promise<PageRefreshReport>;
  now?: () => number;
  log?: Pick<Console, "warn" | "error">;
}

export interface PageRebuildRun {
  status: number;
  body: Record<string, unknown>;
}

/**
 * APR-D179 — one run of `operations.refresh-pages`: fingerprint, compare,
 * invalidate and warm only the changed page groups, then store the
 * fingerprints of the groups whose pages all refreshed.
 */
export async function runPageRebuild(input: {
  /** Cacheable sitemap targets (`pageWarmTargets(await sitemap())`). */
  targets: readonly PageWarmTarget[];
  origin: string;
  dryRun: boolean;
  force: PageRebuildForce;
  deps: PageRebuildDeps;
}): Promise<PageRebuildRun> {
  const { targets, dryRun, force, deps } = input;
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? console;
  const step = "operations.refresh-pages";

  const countryTargets = targets.filter((target) =>
    isCountryPagePath(target.path),
  ).length;
  if (countryTargets === 0) {
    // The sitemap had no country pages: a failed run, not a partial one.
    return {
      status: 500,
      body: { ok: false, outcome: "empty_result", step, dryRun, rowsRead: targets.length },
    };
  }

  const fingerprintStartedAt = now();
  const [current, stored] = await Promise.all([
    deps.readCurrent(),
    deps.readStored(),
  ]);
  const fingerprintMs = now() - fingerprintStartedAt;
  const plan = planPageRebuild(current, stored, force);

  // Warm targets per rebuilt group. Country paths come from the sitemap so
  // only published pages are requested.
  const knownPaths = new Set(targets.map((target) => target.path));
  const pathsByGroup = new Map<string, string[]>();
  for (const country of plan.countries) {
    pathsByGroup.set(
      country.pageKey,
      countryPagePaths(country.slug).filter((path) => knownPaths.has(path)),
    );
  }
  if (plan.site) {
    pathsByGroup.set(plan.site.pageKey, [
      ...targets
        .filter((target) => !isCountryPagePath(target.path))
        .map((target) => target.path),
      SITEMAP_PATH,
    ]);
  }
  const selectedPaths = new Set([...pathsByGroup.values()].flat());
  const selected: PageWarmTarget[] = [
    ...targets.filter((target) => selectedPaths.has(target.path)),
    ...(selectedPaths.has(SITEMAP_PATH)
      ? [{ url: `${input.origin}${SITEMAP_PATH}`, path: SITEMAP_PATH, priority: 0 }]
      : []),
  ];

  const summary = {
    step,
    dryRun,
    force: force.kind,
    countryTargets,
    countriesChanged: plan.countries.length,
    countriesUnchanged: plan.unchangedCountries,
    sitePagesRebuilt: plan.site !== null,
    fingerprintMs,
  };

  if (plan.unknownSlugs.length > 0) {
    return {
      status: 400,
      body: {
        ok: false,
        outcome: "unknown_country",
        ...summary,
        rowsRead: targets.length,
        unknownForcedSlugs: plan.unknownSlugs,
      },
    };
  }
  if (dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        ...summary,
        rowsRead: targets.length,
        rebuildCountries: plan.countries.map(({ slug, reason }) => ({ slug, reason })),
        retiredCountries: plan.retiredSlugs,
        sitePagesReason: plan.site?.reason ?? null,
        pagesToRefresh: selected.length,
      },
    };
  }
  // A slug that no longer exists keeps serving its old cached pages until
  // invalidated; the next visit then renders the current 404 or redirect.
  if (plan.retiredSlugs.length > 0) {
    for (const slug of plan.retiredSlugs) {
      for (const path of countryPagePaths(slug)) deps.revalidate(path);
    }
    await deps.forget(plan.retiredSlugs.map(countryPageKey));
  }

  if (selected.length === 0) {
    return {
      status: 200,
      body: {
        ok: true,
        ...summary,
        invalidated: "none",
        rowsRead: targets.length,
        rowsWritten: 0,
        rowsRejected: 0,
        fingerprintsStored: 0,
      },
    };
  }

  // Literal paths invalidate exactly these pages; unchanged pages keep their
  // cached copy.
  for (const path of selectedPaths) deps.revalidate(path);
  const result = await deps.refresh(selected);
  const outcome = pageRefreshOutcome(result);
  const toStore = fingerprintsToStore(
    plan,
    pathsByGroup,
    new Set(result.unrefreshedPaths),
  );
  await deps.store(toStore);

  if (result.skipped > 0) {
    log.warn(
      "[refresh-pages] warm-up budget reached " +
        JSON.stringify({ skipped: result.skipped, attempted: result.attempted }),
    );
  }
  if (outcome.pagesFailed > 0) {
    // Public URLs only; a failed page keeps serving its previous good copy.
    log.error(
      "[refresh-pages] pages not refreshed " +
        JSON.stringify({
          pagesFailed: outcome.pagesFailed,
          failureStatuses: result.failureStatuses,
          failedPaths: result.failedPaths,
        }),
    );
  }
  return {
    status: outcome.httpStatus,
    body: {
      ok: outcome.ok,
      outcome: outcome.ok ? undefined : outcome.outcome,
      ...summary,
      invalidated: "changed-pages",
      rowsRead: result.targets,
      rowsWritten: result.warmed,
      rowsRejected: outcome.pagesFailed,
      fingerprintsStored: toStore.length,
      pagesStaleAfterRefresh: result.staleAfterRefresh,
      pagesSkipped: result.skipped,
      pagesUnverified: result.unverified,
      failureStatuses: result.failureStatuses,
      failedPaths: result.failedPaths,
      durationSec: Math.round(result.durationMs / 1000),
    },
  };
}
