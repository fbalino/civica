import assert from "node:assert/strict";
import test from "node:test";

import {
  PAGE_FINGERPRINT_VERSION,
  SITE_PAGE_KEY,
  countryPageKey,
  countryPagePaths,
  fingerprintsToStore,
  isCountryPagePath,
  planPageRebuild,
  type CurrentFingerprints,
  type PageRebuildPlan,
  type StoredFingerprint,
} from "./page-rebuild-plan";

const JAPAN = "00000000-0000-4000-8000-000000000001";
const FRANCE = "00000000-0000-4000-8000-000000000002";

function current(
  overrides: Partial<CurrentFingerprints> & {
    japan?: string;
    france?: string;
  } = {},
): CurrentFingerprints {
  return {
    global: overrides.global ?? "g1",
    site: overrides.site ?? "s1",
    countries: overrides.countries ?? [
      { jurisdictionId: JAPAN, slug: "japan", fingerprint: overrides.japan ?? "j1" },
      { jurisdictionId: FRANCE, slug: "france", fingerprint: overrides.france ?? "f1" },
    ],
  };
}

/** The stored state after a fully successful rebuild of `state`. */
function storedAfter(state: CurrentFingerprints): Map<string, StoredFingerprint> {
  const plan = planPageRebuild(state, new Map(), { kind: "all" });
  return new Map(
    [...plan.countries, ...(plan.site ? [plan.site] : [])].map((row) => [
      row.pageKey,
      { fingerprint: row.fingerprint, fingerprintVersion: PAGE_FINGERPRINT_VERSION },
    ]),
  );
}

test("unchanged content rebuilds nothing", () => {
  const plan = planPageRebuild(current(), storedAfter(current()));
  assert.deepEqual(plan.countries, []);
  assert.equal(plan.unchangedCountries, 2);
  assert.equal(plan.site, null);
});

test("one changed country rebuilds only that country and the non-country pages", () => {
  const plan = planPageRebuild(current({ france: "f2" }), storedAfter(current()));
  assert.deepEqual(
    plan.countries.map(({ slug, reason }) => [slug, reason]),
    [["france", "changed"]],
  );
  assert.equal(plan.unchangedCountries, 1);
  assert.equal(plan.site?.reason, "changed");
});

test("a global change rebuilds every country and the non-country pages", () => {
  const plan = planPageRebuild(current({ global: "g2" }), storedAfter(current()));
  assert.deepEqual(plan.countries.map(({ slug }) => slug), ["france", "japan"]);
  assert.equal(plan.site?.reason, "changed");
});

test("a site-only change rebuilds only the non-country pages", () => {
  const plan = planPageRebuild(current({ site: "s2" }), storedAfter(current()));
  assert.deepEqual(plan.countries, []);
  assert.equal(plan.site?.pageKey, SITE_PAGE_KEY);
});

test("the first run and a new dependency map rebuild everything", () => {
  const first = planPageRebuild(current(), new Map());
  assert.deepEqual(first.countries.map(({ reason }) => reason), ["new", "new"]);
  assert.equal(first.site?.reason, "new");

  const oldVersion = new Map(
    [...storedAfter(current())].map(([key, row]) => [
      key,
      { ...row, fingerprintVersion: "page-fingerprint/v0" },
    ]),
  );
  const upgraded = planPageRebuild(current(), oldVersion);
  assert.equal(upgraded.countries.length, 2);
  assert.notEqual(upgraded.site, null);
});

test("forcing one country rebuilds it even when unchanged; unknown slugs are reported", () => {
  const plan = planPageRebuild(current(), storedAfter(current()), {
    kind: "countries",
    slugs: ["japan", "atlantis"],
  });
  assert.deepEqual(
    plan.countries.map(({ slug, reason }) => [slug, reason]),
    [["japan", "forced"]],
  );
  assert.equal(plan.site, null);
  assert.deepEqual(plan.unknownSlugs, ["atlantis"]);
});

test("forcing all rebuilds every group", () => {
  const plan = planPageRebuild(current(), storedAfter(current()), { kind: "all" });
  assert.equal(plan.countries.length, 2);
  assert.equal(plan.site?.reason, "forced");
});

function groups(plan: PageRebuildPlan): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of plan.countries) map.set(row.pageKey, countryPagePaths(row.slug));
  if (plan.site) map.set(plan.site.pageKey, ["/", "/rankings"]);
  return map;
}

test("a fingerprint is stored only for groups whose pages all refreshed", () => {
  const plan = planPageRebuild(current({ global: "g2" }), storedAfter(current()));
  const stored = fingerprintsToStore(
    plan,
    groups(plan),
    new Set(["/country/france/constitution"]),
  );
  assert.deepEqual(
    stored.map(({ pageKey }) => pageKey).sort(),
    [SITE_PAGE_KEY, countryPageKey(JAPAN)].sort(),
  );

  // The failed country is retried on the next run; the others are not.
  const next = new Map(storedAfter(current()));
  for (const row of stored) {
    next.set(row.pageKey, {
      fingerprint: row.fingerprint,
      fingerprintVersion: PAGE_FINGERPRINT_VERSION,
    });
  }
  const retry = planPageRebuild(current({ global: "g2" }), next);
  assert.deepEqual(retry.countries.map(({ slug }) => slug), ["france"]);
  assert.equal(retry.site, null);
});

test("a failed warm-up stores nothing", () => {
  const plan = planPageRebuild(current({ japan: "j2" }), storedAfter(current()));
  const all = new Set([...groups(plan).values()].flat());
  assert.deepEqual(fingerprintsToStore(plan, groups(plan), all), []);
});

test("a group with no warm targets is never stored", () => {
  const plan = planPageRebuild(current({ japan: "j2" }), storedAfter(current()));
  assert.deepEqual(fingerprintsToStore(plan, new Map(), new Set()), []);
});

test("country tab paths are recognized; country methodology is not", () => {
  assert.deepEqual(countryPagePaths("japan"), [
    "/country/japan",
    "/country/japan/civica-data",
    "/country/japan/constitution",
  ]);
  assert.equal(isCountryPagePath("/country/japan/civica-data"), true);
  assert.equal(isCountryPagePath("/country"), false);
  assert.equal(isCountryPagePath("/country/methodology/reconciliation"), false);
});
