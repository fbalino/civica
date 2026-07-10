/**
 * Phase 1.3 — site-stats.ts validation harness.
 *
 *   Run with:  npx tsx scripts/validate-site-stats.ts
 *   Adopted via: ~/civica/plan/site-stale-content-audit-v1.md (Phase 1)
 *
 * Calls `getSiteStats()` once, prints the full object for visual
 * inspection, and asserts a small set of sanity thresholds. Exits
 * 0 on success, 1 on any threshold breach.
 *
 * The thresholds are deliberately loose — they catch the
 * "everything is zero / something disconnected the DB" failure mode
 * without locking in specific live values that drift weekly. Tighter
 * threshold checks belong in the per-site smoke test once Phase 2
 * lands a proof migration.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getSiteStats } from "../src/lib/content/site-stats";
import * as state from "../src/lib/content/site-state";

interface Check {
  label: string;
  pass: boolean;
  detail?: string;
}

async function main() {
  console.log("=== Civica site-stats validation ===\n");

  let stats: Awaited<ReturnType<typeof getSiteStats>>;
  try {
    stats = await getSiteStats();
  } catch (err) {
    console.error("getSiteStats() threw:", err);
    process.exit(1);
  }

  console.log("getSiteStats() returned:");
  console.log(
    JSON.stringify(
      {
        ...stats,
        sourcesByVolume: stats.sourcesByVolume.slice(0, 8).concat(
          stats.sourcesByVolume.length > 8
            ? [
                {
                  sourceId: `... + ${stats.sourcesByVolume.length - 8} more`,
                  factCount: 0,
                },
              ]
            : [],
        ),
        fiveSourceFactKeyNames: stats.fiveSourceFactKeyNames,
      },
      null,
      2,
    ),
  );
  console.log("");

  // ── Sanity thresholds ─────────────────────────────────────────
  const checks: Check[] = [
    {
      label: "activeSources >= 14 (the post-Tier-1 floor; was 14 at handoff, now should be ≥ that)",
      pass: stats.activeSources >= 14,
      detail: `live: ${stats.activeSources}`,
    },
    {
      label: "totalFacts >= 20,000 (the v1 target ceiling is 30k; halfway-or-better is the floor)",
      pass: stats.totalFacts >= 20_000,
      detail: `live: ${stats.totalFacts}`,
    },
    {
      label: "distinctFactKeys >= 80 (registry post-R.7.5 declared 88; allow some unpopulated)",
      pass: stats.distinctFactKeys >= 80,
      detail: `live: ${stats.distinctFactKeys}`,
    },
    {
      label: "multiSourcedFactKeys >= 20 (handoff snapshot was 20+ in March; now should be ≥)",
      pass: stats.multiSourcedFactKeys >= 20,
      detail: `live: ${stats.multiSourcedFactKeys}`,
    },
    {
      label: "fiveSourceFactKeys >= 3 (handoff snapshot floor was 3)",
      pass: stats.fiveSourceFactKeys >= 3,
      detail: `live: ${stats.fiveSourceFactKeys}`,
    },
    {
      label: "totalJurisdictions >= 200 (UN 193 + observers + territories; floor 200)",
      pass: stats.totalJurisdictions >= 200,
      detail: `live: ${stats.totalJurisdictions}`,
    },
    {
      label: "jurisdictionsWithIso3 between 190 and 200 (UN 193 + observers + Kosovo ≈ 197)",
      pass:
        stats.jurisdictionsWithIso3 >= 190 &&
        stats.jurisdictionsWithIso3 <= 200,
      detail: `live: ${stats.jurisdictionsWithIso3}`,
    },
    {
      label: "currentScoredJurisdictions is bounded by ISO3 coverage",
      pass:
        stats.currentScoredJurisdictions >= 0 &&
        stats.currentScoredJurisdictions <= stats.jurisdictionsWithIso3,
      detail: `scored: ${stats.currentScoredJurisdictions}, ISO3: ${stats.jurisdictionsWithIso3}`,
    },
    {
      label: "totalSourcesInRegistry > activeSources (registry includes non-factbook sources)",
      pass: stats.totalSourcesInRegistry > stats.activeSources,
      detail: `total: ${stats.totalSourcesInRegistry}, active: ${stats.activeSources}`,
    },
    {
      label: "singleSourcedFactKeys = distinctFactKeys − multiSourcedFactKeys (computed correctly)",
      pass:
        stats.singleSourcedFactKeys ===
        stats.distinctFactKeys - stats.multiSourcedFactKeys,
      detail: `single: ${stats.singleSourcedFactKeys}, distinct: ${stats.distinctFactKeys}, multi: ${stats.multiSourcedFactKeys}`,
    },
    {
      label: "sourcesByVolume non-empty",
      pass: stats.sourcesByVolume.length > 0,
      detail: `len: ${stats.sourcesByVolume.length}`,
    },
    {
      label: "fiveSourceFactKeyNames length matches fiveSourceFactKeys count",
      pass: stats.fiveSourceFactKeyNames.length === stats.fiveSourceFactKeys,
      detail: `names: ${stats.fiveSourceFactKeyNames.length}, count: ${stats.fiveSourceFactKeys}`,
    },
  ];

  // ── State-file shape sanity (no DB hits, just shape checks) ───
  const stateChecks: Check[] = [
    {
      label: "site-state: civicaIndex.dimensions.length === civicaIndex.dimensionCount",
      pass: state.civicaIndex.dimensions.length === state.civicaIndex.dimensionCount,
      detail: `dimensions: ${state.civicaIndex.dimensions.length}, count: ${state.civicaIndex.dimensionCount}`,
    },
    {
      label: "site-state: civicaIndex weights sum to ~1.00",
      pass:
        Math.abs(
          state.civicaIndex.dimensions.reduce(
            (s, d) => s + d.weight,
            0,
          ) - 1.0,
        ) < 0.001,
      detail: `sum: ${state.civicaIndex.dimensions.reduce((s, d) => s + d.weight, 0).toFixed(4)}`,
    },
    {
      label: "site-state: pulse.taxonomy.categoryCount equals sum of categoriesPerDimension",
      pass:
        state.pulse.taxonomy.categoryCount ===
        Object.values(state.pulse.taxonomy.categoriesPerDimension).reduce(
          (s, n) => s + n,
          0,
        ),
      detail: `count: ${state.pulse.taxonomy.categoryCount}, sum: ${Object.values(state.pulse.taxonomy.categoriesPerDimension).reduce((s, n) => s + n, 0)}`,
    },
    {
      label: "site-state: pulse.backtest.cases.length === 10 (spec §5.3 named cases)",
      pass: state.pulse.backtest.cases.length === 10,
      detail: `len: ${state.pulse.backtest.cases.length}`,
    },
    {
      label: "site-state: tier1Publishers has exactly 11 shipped (12 minus IEA scrapped)",
      pass:
        state.tier1Publishers.filter((p) => p.shipped).length === 11 &&
        state.tier1Publishers.filter((p) => p.scrapped).length === 1,
      detail: `shipped: ${state.tier1Publishers.filter((p) => p.shipped).length}, scrapped: ${state.tier1Publishers.filter((p) => p.scrapped).length}`,
    },
    {
      label: "site-state: nsoWave1 has exactly 1 permanently-deferred (NBS-Nigeria)",
      pass:
        state.nsoWave1.filter((n) => n.status === "deferred-permanently")
          .length === 1,
      detail: `deferred-permanently: ${state.nsoWave1.filter((n) => n.status === "deferred-permanently").length}`,
    },
  ];

  const all = [...checks, ...stateChecks];
  console.log("Sanity thresholds:");
  for (const c of all) {
    const mark = c.pass ? "✓" : "✗";
    console.log(`  ${mark} ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log("");

  const failed = all.filter((c) => !c.pass);
  if (failed.length === 0) {
    console.log(`✓ All ${all.length} checks passed.`);
    process.exit(0);
  } else {
    console.error(`✗ ${failed.length} of ${all.length} checks failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Validation harness threw:", err);
  process.exit(1);
});
