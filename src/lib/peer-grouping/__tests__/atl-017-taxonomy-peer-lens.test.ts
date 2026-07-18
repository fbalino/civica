/**
 * ATL-017 — verify government taxonomy and peer-lens outputs against the
 * adopted external classifications and current source vintages, using
 * source-backed fixtures that run with no database (the DAT-012
 * pure-seam pattern).
 *
 * Coverage, mapped to the task's Done-when clauses:
 *   • structural description  — `deriveStructuralTaxonomy` fixtures (§C)
 *   • V-Dem RoW               — `VDEM_ROW_META` + governance resolver (§B/§A)
 *   • BR/CGV                  — `deriveRegimeTypeCgv` + `REGIME_TYPE_META` (§C/§B)
 *   • World Bank region/income— region/income metadata + material resolver (§B/§A)
 *   • monarchy status         — `MONARCHY_STATUS_META` descriptive enum (§B)
 *   • fallbacks               — material/governance/regime fallback ladders (§A)
 *   • n-minimums              — boundary tests at `minN` (§A)
 *   • noncoverage cases       — unavailable markers for unclassified subjects (§A)
 *   • current source vintages — pinned BR/CGV reference year + dataset versions (§B)
 *   • structural_family cannot re-enter new paths — peer-lens contract guard (§D)
 *
 * Pure: no DB, no network. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MIN_N,
  PEER_GROUPING_FACT_KEYS,
  resolveMaterialPeerSet,
  resolveGovernancePeerSet,
  resolveRegimeAlternateLens,
  type JurisdictionRef,
} from "../index";
import {
  WORLD_BANK_REGION_META,
  WORLD_BANK_INCOME_GROUP_META,
  VDEM_ROW_META,
  MONARCHY_STATUS_META,
  CGV_REGIME_TYPE_META,
  PEER_LENS_DISPLAY_NAME,
  PEER_LENS_SOURCE_ID,
} from "../lens-metadata";
import {
  deriveStructuralTaxonomy,
  deriveRegimeTypeCgv,
  REGIME_TYPE_META,
  STRUCTURAL_FAMILY_META,
  BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR,
  BJORNKSKOV_RODE_DATASET_VERSION,
  BJORNKSKOV_RODE_SOURCE_DATASET_VERSION,
  DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
} from "@/lib/government-taxonomy";
import { governmentTaxonomyVersionEnvelope } from "@/lib/government-taxonomy/versioning";

const NO_PROV = { sourceId: null, retrievedAt: null };

/** Build N refs id-1..id-N so fixture universes are easy to size. */
function refs(n: number): JurisdictionRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i + 1}`,
    slug: `slug-${i + 1}`,
  }));
}

/* ══════════════════════════════════════════════════════════════════
 * §A — Peer-lens fallback ladders, minimum-n, and noncoverage
 * ══════════════════════════════════════════════════════════════════ */

test("material: region+income cohort used when n ≥ minN", () => {
  const universe = refs(4);
  // 3 share EAP+High (incl. subject), 1 is elsewhere.
  const regionByJur = {
    "id-1": "East Asia & Pacific",
    "id-2": "East Asia & Pacific",
    "id-3": "East Asia & Pacific",
    "id-4": "South Asia",
  };
  const incomeByJur = {
    "id-1": "High income",
    "id-2": "High income",
    "id-3": "High income",
    "id-4": "Low income",
  };
  const set = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur,
    incomeByJur,
    regionProvenance: { sourceId: "world_bank", retrievedAt: "2026-01-01" },
    incomeProvenance: NO_PROV,
    minN: 3,
  });
  assert.equal(set.available, true);
  assert.equal(set.lensUsed, "world_bank_region");
  assert.equal(set.cohortValue, "East Asia & Pacific+High income");
  assert.equal(set.n, 3);
  assert.deepEqual(set.fallbackChain, []);
  assert.equal(set.sourceId, "world_bank");
});

test("material: falls region+income → region-only when the pair is below minN", () => {
  const universe = refs(4);
  // Only subject is EAP+High (pair n=1), but 3 are EAP (region n=3).
  const regionByJur = {
    "id-1": "East Asia & Pacific",
    "id-2": "East Asia & Pacific",
    "id-3": "East Asia & Pacific",
    "id-4": "South Asia",
  };
  const incomeByJur = {
    "id-1": "High income",
    "id-2": "Low income",
    "id-3": "Low income",
    "id-4": "Low income",
  };
  const set = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur,
    incomeByJur,
    regionProvenance: NO_PROV,
    incomeProvenance: NO_PROV,
    minN: 3,
  });
  assert.equal(set.lensUsed, "world_bank_region");
  assert.equal(set.cohortValue, "East Asia & Pacific");
  assert.equal(set.n, 3);
  assert.deepEqual(set.fallbackChain, ["n_below_threshold"]);
});

test("material: falls through to income-only, then to global", () => {
  const universe = refs(4);
  // Subject region singleton, but income cohort large enough.
  const regionByJur = {
    "id-1": "North America",
    "id-2": "South Asia",
    "id-3": "Sub-Saharan Africa",
    "id-4": "Europe & Central Asia",
  };
  const incomeByJur = {
    "id-1": "High income",
    "id-2": "High income",
    "id-3": "High income",
    "id-4": "Low income",
  };
  const incomeSet = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur,
    incomeByJur,
    regionProvenance: NO_PROV,
    incomeProvenance: { sourceId: "world_bank", retrievedAt: "2026-02-02" },
    minN: 3,
  });
  assert.equal(incomeSet.lensUsed, "world_bank_income_group");
  assert.equal(incomeSet.cohortValue, "High income");
  assert.equal(incomeSet.n, 3);
  assert.equal(incomeSet.retrievedAt, "2026-02-02");
  assert.deepEqual(incomeSet.fallbackChain, [
    "n_below_threshold",
    "n_below_threshold",
  ]);

  // Same universe but income also singleton everywhere → global.
  const globalSet = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur,
    incomeByJur: {
      "id-1": "High income",
      "id-2": "Low income",
      "id-3": "Lower middle income",
      "id-4": "Upper middle income",
    },
    regionProvenance: NO_PROV,
    incomeProvenance: NO_PROV,
    minN: 3,
  });
  assert.equal(globalSet.lensUsed, "global");
  assert.equal(globalSet.cohortValue, null);
  assert.equal(globalSet.n, 4);
  assert.deepEqual(globalSet.fallbackChain, [
    "n_below_threshold",
    "n_below_threshold",
    "n_below_threshold",
  ]);
});

test("material: subject with only income (no region) records no_classification", () => {
  const universe = refs(3);
  const set = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur: { "id-1": null, "id-2": null, "id-3": null },
    incomeByJur: {
      "id-1": "High income",
      "id-2": "High income",
      "id-3": "High income",
    },
    regionProvenance: NO_PROV,
    incomeProvenance: NO_PROV,
    minN: 3,
  });
  assert.equal(set.lensUsed, "world_bank_income_group");
  assert.equal(set.cohortValue, "High income");
  assert.deepEqual(set.fallbackChain, ["no_classification"]);
});

test("material: subject with neither classification is an explicit noncoverage marker", () => {
  const universe = refs(3);
  const set = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur: { "id-1": null },
    incomeByJur: { "id-1": null },
    regionProvenance: { sourceId: "world_bank", retrievedAt: "2026-03-03" },
    incomeProvenance: NO_PROV,
    minN: 3,
  });
  assert.equal(set.available, false);
  assert.equal(set.lensUsed, "global");
  assert.equal(set.cohortLabel, "Unavailable");
  assert.equal(set.n, 0);
  assert.deepEqual(set.peerJurisdictionIds, []);
  assert.deepEqual(set.fallbackChain, ["non_sovereign_or_uncovered"]);
  assert.equal(set.sourceId, "world_bank");
});

test("governance: RoW tier cohort, then global fallback, then noncoverage", () => {
  const universe = refs(4);
  const vdemRowByJur = {
    "id-1": "Liberal Democracy",
    "id-2": "Liberal Democracy",
    "id-3": "Liberal Democracy",
    "id-4": "Closed Autocracy",
  };
  const tierSet = resolveGovernancePeerSet({
    subjectId: "id-1",
    refs: universe,
    vdemRowByJur,
    provenance: { sourceId: "vdem", retrievedAt: "2026-01-01" },
    minN: 3,
  });
  assert.equal(tierSet.lensUsed, "vdem_row");
  assert.equal(tierSet.vdemRowTier, "Liberal Democracy");
  assert.equal(tierSet.n, 3);
  assert.deepEqual(tierSet.fallbackChain, []);

  // Below minN → flat fallback to global (RoW has only 4 buckets).
  const globalSet = resolveGovernancePeerSet({
    subjectId: "id-4",
    refs: universe,
    vdemRowByJur,
    provenance: NO_PROV,
    minN: 3,
  });
  assert.equal(globalSet.lensUsed, "global");
  assert.equal(globalSet.vdemRowTier, "Closed Autocracy");
  assert.equal(globalSet.n, 4);
  assert.deepEqual(globalSet.fallbackChain, ["n_below_threshold"]);

  // No tier → unavailable.
  const missing = resolveGovernancePeerSet({
    subjectId: "id-1",
    refs: universe,
    vdemRowByJur: { "id-1": null },
    provenance: NO_PROV,
    minN: 3,
  });
  assert.equal(missing.available, false);
  assert.deepEqual(missing.fallbackChain, ["non_sovereign_or_uncovered"]);
});

test("regime alternate (BR/CGV): cohort, global fallback, and unavailable", () => {
  const universe = refs(4);
  const cohort = resolveRegimeAlternateLens({
    subjectId: "id-1",
    refs: universe,
    subjectCgv: "parliamentary_democracy",
    cgvPeerIds: ["id-1", "id-2", "id-3"],
    minN: 3,
  });
  assert.equal(cohort.lensUsed, "cgv_regime");
  assert.equal(cohort.cohortValue, "parliamentary_democracy");
  assert.equal(cohort.n, 3);
  assert.equal(cohort.sourceId, "bjornskov_rode");

  const global = resolveRegimeAlternateLens({
    subjectId: "id-1",
    refs: universe,
    subjectCgv: "royal_dictatorship",
    cgvPeerIds: ["id-1"],
    minN: 3,
  });
  assert.equal(global.lensUsed, "global");
  assert.equal(global.n, 4);
  assert.deepEqual(global.fallbackChain, ["n_below_threshold"]);

  const unavailable = resolveRegimeAlternateLens({
    subjectId: "id-1",
    refs: universe,
    subjectCgv: null,
    cgvPeerIds: [],
    minN: 3,
  });
  assert.equal(unavailable.available, false);
  assert.deepEqual(unavailable.fallbackChain, ["non_sovereign_or_uncovered"]);
});

test("peer cohort contract retains observed universe, attempted/final n, and upstream vintage", () => {
  const universe = refs(5);
  const set = resolveMaterialPeerSet({
    subjectId: "id-1",
    refs: universe,
    regionByJur: {
      "id-1": "East Asia & Pacific",
      "id-2": "East Asia & Pacific",
      "id-3": "East Asia & Pacific",
      "id-4": "East Asia & Pacific",
      "id-5": "South Asia",
    },
    incomeByJur: {
      "id-1": "High income",
      "id-2": "High income",
      "id-3": "Low income",
      "id-4": "Low income",
      "id-5": "Low income",
    },
    regionProvenance: {
      sourceId: "world_bank",
      retrievedAt: "2026-07-18T00:00:00.000Z",
      upstreamVintage: "World Bank Country and Lending Groups 2026",
    },
    incomeProvenance: NO_PROV,
    minN: 3,
    measure: { metricId: "hdi", metricVintage: "2024" },
  });
  // The requested region+income cohort had two observations, so the resolver
  // documented its fallback to the four observed countries in the region.
  assert.equal(set.measureDomain, "material");
  assert.equal(set.metricId, "hdi");
  assert.equal(set.metricVintage, "2024");
  assert.equal(set.eligibleN, 5);
  assert.equal(set.attemptedN, 2);
  assert.equal(set.finalN, 4);
  assert.equal(set.n, set.finalN);
  assert.equal(
    set.upstreamVintage,
    "World Bank Country and Lending Groups 2026",
  );
  assert.deepEqual(set.fallbackChain, ["n_below_threshold"]);
});

test("peer cohorts refuse a subject absent from the metric-observed universe", () => {
  const set = resolveGovernancePeerSet({
    subjectId: "id-1",
    refs: refs(3).slice(1),
    vdemRowByJur: { "id-1": "Liberal Democracy" },
    provenance: NO_PROV,
    minN: 2,
    measure: { metricId: "ci-beta-r5", metricVintage: "2024-Q4" },
  });
  assert.equal(set.available, false);
  assert.equal(set.eligibleN, 2);
  assert.equal(set.attemptedN, 0);
  assert.equal(set.finalN, 0);
  assert.deepEqual(set.fallbackChain, ["subject_not_observed"]);
});

test("minimum-n boundary: exactly minN passes, minN-1 falls back", () => {
  const universe = refs(10);
  const vdemRowByJur: Record<string, string> = {};
  universe.forEach((r, i) => {
    // First 8 are Liberal Democracy, rest Closed Autocracy.
    vdemRowByJur[r.id] = i < 8 ? "Liberal Democracy" : "Closed Autocracy";
  });
  const atThreshold = resolveGovernancePeerSet({
    subjectId: "id-1",
    refs: universe,
    vdemRowByJur,
    provenance: NO_PROV,
    minN: DEFAULT_MIN_N, // 8
  });
  assert.equal(atThreshold.n, 8);
  assert.equal(atThreshold.lensUsed, "vdem_row");

  const belowThreshold = resolveGovernancePeerSet({
    subjectId: "id-9", // Closed Autocracy cohort of 2 < 8
    refs: universe,
    vdemRowByJur,
    provenance: NO_PROV,
    minN: DEFAULT_MIN_N,
  });
  assert.equal(belowThreshold.lensUsed, "global");
  assert.deepEqual(belowThreshold.fallbackChain, ["n_below_threshold"]);
});

test("resolvers are deterministic: identical inputs → deep-equal outputs", () => {
  const universe = refs(4);
  const args = {
    subjectId: "id-1",
    refs: universe,
    regionByJur: {
      "id-1": "North America",
      "id-2": "North America",
      "id-3": "North America",
      "id-4": "South Asia",
    },
    incomeByJur: {
      "id-1": "High income",
      "id-2": "High income",
      "id-3": "High income",
      "id-4": "Low income",
    },
    regionProvenance: NO_PROV,
    incomeProvenance: NO_PROV,
    minN: 3,
  };
  assert.deepEqual(
    resolveMaterialPeerSet(args),
    resolveMaterialPeerSet({ ...args }),
  );
});

/* ══════════════════════════════════════════════════════════════════
 * §B — Adopted external classifications & current source vintages
 * ══════════════════════════════════════════════════════════════════ */

test("World Bank region metadata is exactly the seven source-native buckets", () => {
  assert.deepEqual(Object.keys(WORLD_BANK_REGION_META).sort(), [
    "East Asia & Pacific",
    "Europe & Central Asia",
    "Latin America & Caribbean",
    "Middle East, North Africa, Afghanistan & Pakistan",
    "North America",
    "South Asia",
    "Sub-Saharan Africa",
  ]);
  // Labels are preserved verbatim from the upstream publisher.
  for (const [key, meta] of Object.entries(WORLD_BANK_REGION_META)) {
    assert.equal(meta.label, key);
  }
});

test("World Bank income metadata is exactly the four source-native tiers", () => {
  assert.deepEqual(Object.keys(WORLD_BANK_INCOME_GROUP_META).sort(), [
    "High income",
    "Low income",
    "Lower middle income",
    "Upper middle income",
  ]);
});

test("V-Dem RoW metadata is exactly the four Lührmann et al. tiers", () => {
  assert.deepEqual(Object.keys(VDEM_ROW_META).sort(), [
    "Closed Autocracy",
    "Electoral Autocracy",
    "Electoral Democracy",
    "Liberal Democracy",
  ]);
});

test("BR/CGV metadata is exactly the six regime types", () => {
  const expected = [
    "civilian_dictatorship",
    "military_dictatorship",
    "parliamentary_democracy",
    "presidential_democracy",
    "royal_dictatorship",
    "semi_presidential_democracy",
  ];
  assert.deepEqual(Object.keys(REGIME_TYPE_META).sort(), expected);
  // Re-exported into the peer-lens metadata under a distinct name.
  assert.deepEqual(Object.keys(CGV_REGIME_TYPE_META).sort(), expected);
});

test("monarchy status is a six-value descriptive enum (not an analytical taxonomy)", () => {
  assert.deepEqual(Object.keys(MONARCHY_STATUS_META).sort(), [
    "absolute",
    "ceremonial",
    "constitutional",
    "elective",
    "none",
    "theocratic",
  ]);
  assert.equal(MONARCHY_STATUS_META.none.label, "No monarchy");
});

test("each peer lens declares its adopted external source", () => {
  assert.equal(PEER_LENS_SOURCE_ID.world_bank_region, "world_bank");
  assert.equal(PEER_LENS_SOURCE_ID.world_bank_income_group, "world_bank");
  assert.equal(PEER_LENS_SOURCE_ID.vdem_row, "vdem");
  assert.equal(PEER_LENS_SOURCE_ID.cgv_regime, "bjornskov_rode");
  assert.equal(PEER_LENS_SOURCE_ID.monarchy_status, "cia_factbook");
});

test("BR/CGV current source vintages are pinned to the adopted release", () => {
  // The QoG Standard Jan26 cross-section reference year is 2022 (DAT-025);
  // the dataset version and BR source-dataset version are distinct clocks.
  assert.equal(BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR, 2022);
  assert.equal(BJORNKSKOV_RODE_DATASET_VERSION, "QoG Standard Jan26");
  assert.equal(
    BJORNKSKOV_RODE_SOURCE_DATASET_VERSION,
    "Bjørnskov-Rode regime data v6.1",
  );
  assert.equal(DEFAULT_GOVERNMENT_TAXONOMY_VERSION, "2026_v1");

  // The derivation version envelope carries the taxonomy version + its
  // adopted source basket.
  const { envelope, key } = governmentTaxonomyVersionEnvelope();
  assert.ok(key.length > 0);
  assert.deepEqual(envelope.sourceIds, [
    "bjornskov_rode",
    "cia_factbook",
    "wikidata",
  ]);
});

/* ══════════════════════════════════════════════════════════════════
 * §C — Structural-description & BR/CGV derivation (source-backed)
 * ══════════════════════════════════════════════════════════════════ */

test("structural derivation maps raw CIA labels to the adopted structural families", () => {
  const cases: Array<[string, string]> = [
    ["presidential republic", "presidential_republic"],
    ["parliamentary democracy", "parliamentary_democracy"],
    ["federal parliamentary republic", "parliamentary_democracy"],
    ["semi-presidential republic", "semi_presidential"],
    ["absolute monarchy", "absolute_monarchy"],
    ["parliamentary constitutional monarchy", "constitutional_monarchy"],
    ["theocratic republic", "theocracy"],
    ["communist state", "one_party_state"],
    ["military junta", "military_rule"],
  ];
  for (const [raw, family] of cases) {
    const d = deriveStructuralTaxonomy({ governmentTypeDetail: raw });
    assert.equal(d.structuralFamily, family, `${raw} → ${family}`);
    assert.equal(
      d.structuralFamilyLabel,
      STRUCTURAL_FAMILY_META[family as keyof typeof STRUCTURAL_FAMILY_META]
        .label,
      `${raw} label`,
    );
  }
});

test("structural-family display labels are the adopted strings", () => {
  // Pin the exact labels so a silent rename is caught.
  assert.equal(
    STRUCTURAL_FAMILY_META.parliamentary_democracy.label,
    "Parliamentary democracy",
  );
  assert.equal(
    STRUCTURAL_FAMILY_META.presidential_republic.label,
    "Presidential republic",
  );
  assert.equal(STRUCTURAL_FAMILY_META.semi_presidential.label, "Semi-presidential");
  assert.equal(
    STRUCTURAL_FAMILY_META.constitutional_monarchy.label,
    "Constitutional monarchy",
  );
  assert.equal(STRUCTURAL_FAMILY_META.theocracy.label, "Theocracy");
  assert.equal(STRUCTURAL_FAMILY_META.directorial_republic.label, "Directorial republic");
  assert.equal(STRUCTURAL_FAMILY_META.other.label, "Other");
});

test("federal detection sets the isFederal primitive", () => {
  const federal = deriveStructuralTaxonomy({
    governmentTypeDetail: "federal presidential republic",
  });
  assert.equal(federal.isFederal, true);
  assert.equal(federal.structuralSubtype, "federal_presidential_republic");
});

test("a missing/unknown label degrades to 'other', never a crash", () => {
  const empty = deriveStructuralTaxonomy({ governmentTypeDetail: null });
  assert.equal(empty.structuralFamily, "other");
  assert.equal(empty.executiveStructure, "unknown");
});

test("deliberate divergence overrides win over the heuristic", () => {
  // Switzerland: structural form overridden to a directorial republic.
  const che = deriveStructuralTaxonomy({
    iso3: "CHE",
    governmentTypeDetail: "federal republic",
  });
  assert.equal(che.structuralFamily, "directorial_republic");
  assert.equal(che.isFederal, true);
  assert.ok(che.overrideNote && che.overrideNote.length > 0);

  // Vatican: theocratic elective monarchy, not a generic monarchy/republic.
  const vat = deriveStructuralTaxonomy({
    iso3: "VAT",
    governmentTypeDetail: "ecclesiastical",
  });
  assert.equal(vat.structuralFamily, "theocracy");
  assert.equal(vat.structuralSubtype, "elective_theocratic_monarchy");

  // Andorra: co-principality, not a standard constitutional monarchy.
  const and = deriveStructuralTaxonomy({
    iso3: "AND",
    governmentTypeDetail: "parliamentary democracy",
  });
  assert.equal(and.structuralFamily, "constitutional_monarchy");
  assert.equal(and.structuralSubtype, "co_principality");
});

test("BR/CGV regime coding follows the adopted signal thresholds", () => {
  const base = { governmentTypeDetail: "presidential republic" };
  // Democracy + presidential → presidential democracy.
  assert.equal(
    deriveRegimeTypeCgv({ ...base, brDem: 0.9, brPres: 0.9 }).regimeTypeCgv,
    "presidential_democracy",
  );
  // Democracy + semi-presidential structure → semi-presidential democracy.
  assert.equal(
    deriveRegimeTypeCgv({
      governmentTypeDetail: "semi-presidential republic",
      brDem: 0.9,
    }).regimeTypeCgv,
    "semi_presidential_democracy",
  );
  // Non-democracy + monarch → royal dictatorship.
  assert.equal(
    deriveRegimeTypeCgv({
      governmentTypeDetail: "absolute monarchy",
      brDem: 0.1,
      brMon: 0.9,
    }).regimeTypeCgv,
    "royal_dictatorship",
  );
  // Non-democracy + military structure → military dictatorship.
  assert.equal(
    deriveRegimeTypeCgv({
      governmentTypeDetail: "military junta",
      brDem: 0.1,
    }).regimeTypeCgv,
    "military_dictatorship",
  );
  // Non-democracy, civilian → civilian dictatorship.
  assert.equal(
    deriveRegimeTypeCgv({ ...base, brDem: 0.1 }).regimeTypeCgv,
    "civilian_dictatorship",
  );
  // No BR democracy signal → no regime coding (fails closed, not a guess).
  assert.equal(deriveRegimeTypeCgv({ ...base }).regimeTypeCgv, null);
});

test("Switzerland keeps its BR/CGV regime coding despite the structural override", () => {
  // The documented divergence: structural lens = directorial republic
  // (override), regime lens = presidential democracy from BR signals.
  const regime = deriveRegimeTypeCgv({
    iso3: "CHE",
    governmentTypeDetail: "federal republic",
    brDem: 0.9,
    brPres: 0.9,
  });
  assert.equal(regime.regimeTypeCgv, "presidential_democracy");
  assert.equal(regime.regimeDatasetVersion, BJORNKSKOV_RODE_DATASET_VERSION);
});

/* ══════════════════════════════════════════════════════════════════
 * §D — Retired `structural_family` cannot re-enter new peer paths
 * ══════════════════════════════════════════════════════════════════ */

test("the peer-lens contract has no structural_family primitive", () => {
  // The five adopted lenses, and only those.
  assert.deepEqual(Object.keys(PEER_LENS_DISPLAY_NAME).sort(), [
    "cgv_regime",
    "monarchy_status",
    "vdem_row",
    "world_bank_income_group",
    "world_bank_region",
  ]);
  for (const lens of Object.keys(PEER_LENS_DISPLAY_NAME)) {
    assert.ok(
      !/structural[_-]?family/i.test(lens),
      `peer lens ${lens} must not be structural_family`,
    );
  }
});

test("no peer-grouping fact key resurrects structural_family", () => {
  for (const value of Object.values(PEER_GROUPING_FACT_KEYS)) {
    assert.ok(
      !/structural[_-]?family/i.test(value),
      `peer-grouping fact key ${value} must not be structural_family`,
    );
  }
});
