import assert from "node:assert/strict";
import test from "node:test";

import type { PageRefreshReport, PageWarmTarget } from "./page-refresh";
import {
  PAGE_FINGERPRINT_VERSION,
  countryPageKey,
  planPageRebuild,
  type CurrentFingerprints,
  type PageRebuildEntry,
  type StoredFingerprint,
} from "./page-rebuild-plan";
import { SITEMAP_PATH, parsePageRebuildForce, runPageRebuild } from "./page-rebuild";

const ORIGIN = "https://civicaatlas.org";
const JAPAN = "00000000-0000-4000-8000-000000000001";
const FRANCE = "00000000-0000-4000-8000-000000000002";

const TARGETS: PageWarmTarget[] = [
  "/",
  "/rankings",
  "/country/japan",
  "/country/japan/civica-data",
  "/country/japan/constitution",
  "/country/france",
  "/country/france/civica-data",
  "/country/france/constitution",
].map((path) => ({ url: `${ORIGIN}${path}`, path, priority: 0.5 }));

function fingerprints(france = "f1"): CurrentFingerprints {
  return {
    global: "g1",
    countries: [
      { jurisdictionId: JAPAN, slug: "japan", fingerprint: "j1" },
      { jurisdictionId: FRANCE, slug: "france", fingerprint: france },
    ],
  };
}

function storedAfter(state: CurrentFingerprints): Map<string, StoredFingerprint> {
  const plan = planPageRebuild(state, new Map(), { kind: "all" });
  return new Map(
    plan.countries.map((row) => [
      row.pageKey,
      { fingerprint: row.fingerprint, fingerprintVersion: PAGE_FINGERPRINT_VERSION },
    ]),
  );
}

function report(
  targets: readonly PageWarmTarget[],
  unrefreshed: readonly string[] = [],
): PageRefreshReport {
  return {
    targets: targets.length,
    attempted: targets.length,
    warmed: targets.length - unrefreshed.length,
    failed: unrefreshed.length,
    staleAfterRefresh: 0,
    skipped: 0,
    unverified: 0,
    durationMs: 1_000,
    failureStatuses: unrefreshed.length ? { "500": unrefreshed.length } : {},
    failedPaths: [...unrefreshed],
    unrefreshedPaths: [...unrefreshed],
  };
}

function harness(options: {
  current: CurrentFingerprints;
  stored: Map<string, StoredFingerprint>;
  unrefreshed?: string[];
}) {
  const calls = {
    revalidated: [] as string[],
    warmed: [] as string[],
    stored: [] as PageRebuildEntry[],
  };
  const deps = {
    readCurrent: async () => options.current,
    readStored: async () => options.stored,
    store: async (entries: readonly PageRebuildEntry[]) => {
      calls.stored.push(...entries);
    },
    revalidate: (path: string) => {
      calls.revalidated.push(path);
    },
    refresh: async (targets: readonly PageWarmTarget[]) => {
      calls.warmed.push(...targets.map((target) => target.path));
      return report(targets, options.unrefreshed);
    },
    log: { warn: () => {}, error: () => {} },
  };
  return { calls, deps };
}

test("unchanged fingerprints still rebuild the non-country pages every night", async () => {
  const { calls, deps } = harness({
    current: fingerprints(),
    stored: storedAfter(fingerprints()),
  });
  const run = await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: false,
    force: { kind: "none" },
    deps,
  });
  assert.equal(run.status, 200);
  assert.deepEqual(calls.warmed.sort(), ["/", "/rankings", SITEMAP_PATH].sort());
  assert.ok(!calls.warmed.some((path) => path.startsWith("/country/")));
});

test("unchanged countries are neither invalidated nor stored again", async () => {
  const { calls, deps } = harness({
    current: fingerprints(),
    stored: storedAfter(fingerprints()),
  });
  await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: false,
    force: { kind: "none" },
    deps,
  });
  assert.ok(!calls.revalidated.some((path) => path.startsWith("/country/")));
  assert.deepEqual(calls.stored, []);
});

test("one changed country rebuilds only its three tabs plus the non-country pages", async () => {
  const { calls, deps } = harness({
    current: fingerprints("f2"),
    stored: storedAfter(fingerprints()),
  });
  const run = await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: false,
    force: { kind: "none" },
    deps,
  });
  assert.equal(run.status, 200);
  assert.deepEqual(calls.revalidated.sort(), [
    "/",
    "/country/france",
    "/country/france/civica-data",
    "/country/france/constitution",
    "/rankings",
    SITEMAP_PATH,
  ].sort());
  assert.ok(!calls.warmed.some((path) => path.startsWith("/country/japan")));
  assert.deepEqual(
    calls.stored.map(({ pageKey }) => pageKey).sort(),
    [countryPageKey(FRANCE)],
  );
});

test("a dry run lists the countries to rebuild without invalidating, warming, or storing", async () => {
  const { calls, deps } = harness({
    current: fingerprints("f2"),
    stored: storedAfter(fingerprints()),
  });
  const run = await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: true,
    force: { kind: "none" },
    deps,
  });
  assert.equal(run.status, 200);
  assert.deepEqual(run.body.rebuildCountries, [{ slug: "france", reason: "changed" }]);
  assert.equal(run.body.pagesToRefresh, 6);
  assert.deepEqual(calls.revalidated, []);
  assert.deepEqual(calls.warmed, []);
  assert.deepEqual(calls.stored, []);
});

test("a failed warm-up does not store that group's fingerprint", async () => {
  const { calls, deps } = harness({
    current: fingerprints("f2"),
    stored: storedAfter(fingerprints()),
    unrefreshed: ["/country/france/civica-data"],
  });
  const run = await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: false,
    force: { kind: "none" },
    deps,
  });
  // One failed page of six exceeds the 1% failure threshold.
  assert.equal(run.status, 502);
  assert.deepEqual(calls.stored, []);
});

test("forcing one country rebuilds it; an unknown slug is rejected before any work", async () => {
  const forced = harness({
    current: fingerprints(),
    stored: storedAfter(fingerprints()),
  });
  const run = await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: false,
    force: parsePageRebuildForce("japan"),
    deps: forced.deps,
  });
  assert.equal(run.status, 200);
  assert.deepEqual(forced.calls.warmed.sort(), [
    "/country/japan",
    "/country/japan/civica-data",
    "/country/japan/constitution",
  ]);

  const unknown = harness({
    current: fingerprints(),
    stored: storedAfter(fingerprints()),
  });
  const rejected = await runPageRebuild({
    targets: TARGETS,
    origin: ORIGIN,
    dryRun: false,
    force: parsePageRebuildForce("japan,atlantis"),
    deps: unknown.deps,
  });
  assert.equal(rejected.status, 400);
  assert.deepEqual(unknown.calls.warmed, []);
});

test("a sitemap without country pages is a failed run", async () => {
  const { deps } = harness({ current: fingerprints(), stored: new Map() });
  const run = await runPageRebuild({
    targets: TARGETS.slice(0, 2),
    origin: ORIGIN,
    dryRun: false,
    force: { kind: "none" },
    deps,
  });
  assert.equal(run.status, 500);
  assert.equal(run.body.outcome, "empty_result");
});
