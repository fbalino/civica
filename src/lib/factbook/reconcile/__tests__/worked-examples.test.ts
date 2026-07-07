/**
 * Worked-example contract test — v1.0 follow-up §1.4.
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/worked-examples.test.ts
 *
 * Asserts that the 8 worked examples on the R.23 reconciliation
 * methodology page resolve to their documented canonical-source +
 * value tuples, within tolerance, against the live `DATABASE_URL`.
 *
 * The test is the machine-readable contract; the methodology page is
 * the human-readable narrative. They are kept in sync by convention:
 * any PR that revises a worked example MUST update both this file
 * AND the page (`src/app/(reader)/factbook/methodology/reconciliation/page.tsx`)
 * AND `content/methodology-reconciliation.md`.
 *
 * When the test fails:
 *   1. Confirm the change is intentional (sync refresh, threshold
 *      raise, NSO override change). Check git log on `country_facts`
 *      sync orchestrators.
 *   2. Update the `WORKED_EXAMPLES` row below with the new tuple.
 *   3. Update the corresponding paragraphs on the methodology page
 *      and the markdown content file.
 *   4. Re-run this test to confirm green.
 *
 * Methodology: ~/civica/plan/v1-worked-example-test-resolution-v1.md
 *              ~/civica/plan/methodology-page-rewrite-v1.md
 *              ~/civica/plan/v1.0-followup-backlog.md §1.4
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { resolveFact } from "@/lib/factbook/reconcile/resolver";

// ────────────────────────────────────────────────────────────────
// Test plumbing (mirrors resolver.test.ts / nso-overrides.test.ts)
// ────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
let skip = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  pass  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log("    ", (err as Error).message);
    fail++;
  }
}

// ────────────────────────────────────────────────────────────────
// The 8 worked examples
// ────────────────────────────────────────────────────────────────
//
// Each row is the contract between this test and the methodology
// page. Values verified live against the production `DATABASE_URL`
// on 2026-05-06. See the resolution doc at
// `~/civica/plan/v1-worked-example-test-resolution-v1.md` §3 for
// the full table with cross-references to page paragraphs.
//
// `tolerance` is RELATIVE (fraction of expected value), not absolute.
// 0.001 = 0.1% — the master plan's documented bar. 0.05 = 5%, used
// for fact-keys whose canonical magnitude is below 1 (e.g., Germany
// GDP growth = 0.2%) where 0.1% relative tolerance becomes too tight
// in absolute terms.
//
// `disabled` is the escape hatch for sync-mid-flight cases where a
// worked example is temporarily expected to fail. Use sparingly; a
// row that stays disabled past one quarterly vintage is a bug.
//
// Update this array when the page narrative changes — and update
// the page narrative when this array changes.

interface WorkedExample {
  id: string;
  label: string;
  countrySlug: string;
  countryIso3: string;
  factKey: string;
  expectedSource: string;
  expectedValue: number;
  expectedFactYear: number;
  expectedDecisionReason: string;
  /** Relative tolerance (fraction of expected value). */
  tolerance: number;
  /** WE8 only — Marshall Islands population should be flagged disputed. */
  expectIsDisputed?: boolean;
  /** Escape hatch for sync-mid-flight rows. */
  disabled?: { reason: string };
}

const WORKED_EXAMPLES: WorkedExample[] = [
  {
    id: "we1",
    label: "Worked example 1 — Argentina inflation, hyperinflation hot-fix",
    countrySlug: "argentina",
    countryIso3: "ARG",
    factKey: "inflation_rate",
    expectedSource: "world_bank",
    expectedValue: 219.88393,
    expectedFactYear: 2024,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.001,
  },
  {
    id: "we2",
    label: "Worked example 2 — United States life expectancy, editorial canonical vs freshest",
    countrySlug: "united-states",
    countryIso3: "USA",
    factKey: "life_expectancy_years",
    expectedSource: "un_data",
    expectedValue: 77.0454,
    expectedFactYear: 2024,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.001,
  },
  {
    id: "we3",
    // Growth-methodology comparability rule (Q3). Brazil's IBGE reports a
    // four-quarter accumulated figure (2025); the World Bank reports annual
    // year-on-year (2024). IBGE is exactly 12 months fresher — not MORE than
    // 12 — so the comparable annual-YoY World Bank value wins canonical.
    // ~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md
    label: "Worked example 3 — Brazil GDP growth, annual-YoY preferred over four-quarter",
    countrySlug: "brazil",
    countryIso3: "BRA",
    factKey: "gdp_real_growth_rate",
    expectedSource: "world_bank",
    expectedValue: 3.419315,
    expectedFactYear: 2024,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.01,
  },
  {
    id: "we4",
    label: "Worked example 4 — United Kingdom inflation, NSO override",
    countrySlug: "united-kingdom",
    countryIso3: "GBR",
    factKey: "inflation_rate",
    expectedSource: "ons_uk",
    expectedValue: 3.9,
    expectedFactYear: 2025,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.001,
  },
  {
    id: "we5",
    // Methodology page just says "South Africa unemployment"; the
    // multi-source key is `unemployment_rate_pct`. The legacy
    // `unemployment_rate` key still holds a single CIA-only row.
    label: "Worked example 5 — South Africa unemployment, PDF-extraction NSO",
    countrySlug: "south-africa",
    countryIso3: "ZAF",
    factKey: "unemployment_rate_pct",
    expectedSource: "stats_sa",
    expectedValue: 31.4,
    expectedFactYear: 2025,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.001,
  },
  {
    id: "we6",
    // IMF projection partition + CIA vintage normalization (Option A).
    // The IMF 2031 projection is excluded by the measured-vs-projected
    // partition; among the measured rows, CIA's "(2025 est.)" nowcast is
    // aged to data_vintage_year=2024, so it no longer outranks the genuine
    // UN WPP 2024 measurement. UN WPP wins canonical (World Bank republishes
    // the same 45,696,160). ~/civica/plan/cia-stale-vintage-resolution-v1.md
    label: "Worked example 6 — IMF projection excluded, CIA nowcast aged, UN WPP wins (Argentina population)",
    countrySlug: "argentina",
    countryIso3: "ARG",
    factKey: "population_total",
    expectedSource: "un_data",
    expectedValue: 45_696_160,
    expectedFactYear: 2024,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.001,
  },
  {
    id: "we7",
    label: "Worked example 7 — Brazil population, six publishers, IBGE override",
    countrySlug: "brazil",
    countryIso3: "BRA",
    factKey: "population_total",
    expectedSource: "ibge_br",
    expectedValue: 213_421_040,
    expectedFactYear: 2025,
    expectedDecisionReason: "fresher_winner",
    tolerance: 0.001,
  },
  {
    id: "we8",
    // Disputes system, correctly RESOLVED. A reviewer resolved the
    // Marshall Islands material-error dispute in favour of the UN/World Bank
    // resident-population figure (37,548), rejecting the CIA's
    // diaspora-inflated 82,011. Resolution demotes ONLY the losing party —
    // the CIA row (status='demoted') — while every other source stays active
    // and visible in the alternates panel. The resolver then picks canonical
    // over the survivors: UN WPP and the World Bank both report 37,548 (2024,
    // the reviewer's value), so the incumbent UN WPP measurement holds. Not
    // disputed. (CIA is demoted out of the candidate pool, so the CIA-vintage
    // work never enters this resolution.)
    label: "Worked example 8 — Marshall Islands population, dispute resolved (only the losing row demoted)",
    countrySlug: "marshall-islands",
    countryIso3: "MHL",
    factKey: "population_total",
    expectedSource: "un_data",
    expectedValue: 37_548,
    expectedFactYear: 2024,
    expectedDecisionReason: "incumbent_held",
    tolerance: 0.001,
    expectIsDisputed: false,
  },
];

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

interface JurisdictionRow {
  id: string;
  slug: string;
  iso3: string | null;
}

async function loadJurisdictions(slugs: string[]): Promise<Map<string, JurisdictionRow>> {
  const rows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(inArray(jurisdictions.slug, slugs));

  const map = new Map<string, JurisdictionRow>();
  for (const r of rows) map.set(r.slug, r);
  return map;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return String(n);
  if (Math.abs(n) >= 1_000_000) return n.toLocaleString("en-US");
  return String(n);
}

function relDiff(actual: number, expected: number): number {
  if (expected === 0) return Math.abs(actual);
  return Math.abs((actual - expected) / expected);
}

// ────────────────────────────────────────────────────────────────
// Test runner
// ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // TODO(test-runner — 2026-06-07 deep audit, Code Quality & Tests):
  // This is a *live-DB contract test* — it resolves the 8 worked examples
  // against the real `DATABASE_URL` (production Neon), so it needs network
  // + a populated database. It is therefore skipped by the default
  // `npm test` run, which must stay deterministic, offline, and CI-safe.
  // Run it on demand with `npm run test:db` (sets RUN_DB_TESTS=1).
  // Follow-up: seed a fixture database so this can rejoin the default
  // suite without touching production.
  if (!process.env.RUN_DB_TESTS) {
    console.log(
      "Worked-example contract test SKIPPED — requires a live DATABASE_URL.\n" +
        "Run it with: npm run test:db  (RUN_DB_TESTS=1)",
    );
    return;
  }

  console.log("Worked-example contract tests — v1.0 §1.4\n");

  const slugs = Array.from(new Set(WORKED_EXAMPLES.map((e) => e.countrySlug)));
  const jurisdictionMap = await loadJurisdictions(slugs);

  // Pre-flight: confirm every slug resolved to a jurisdiction row.
  for (const slug of slugs) {
    const j = jurisdictionMap.get(slug);
    if (!j) {
      console.log(`  FAIL  pre-flight: jurisdiction not found for slug=${slug}`);
      fail++;
    }
  }

  console.log(`\nResolving ${WORKED_EXAMPLES.length} worked examples against live DATABASE_URL\n`);

  for (const example of WORKED_EXAMPLES) {
    if (example.disabled) {
      console.log(`  skip  ${example.label} — disabled: ${example.disabled.reason}`);
      skip++;
      continue;
    }

    const jurisdiction = jurisdictionMap.get(example.countrySlug);
    if (!jurisdiction) {
      // Already counted in pre-flight; do not double-count.
      continue;
    }

    await test(example.label, async () => {
      const out = await resolveFact(jurisdiction.id, example.factKey);

      // 1. canonical row must exist
      assert.ok(
        out.canonical,
        `expected a canonical row for (${example.countrySlug}, ${example.factKey}); got null. decisionReason=${out.decisionReason}`
      );

      // 2. canonical source must match
      assert.equal(
        out.canonical!.sourceId,
        example.expectedSource,
        `canonical source for (${example.countrySlug}, ${example.factKey}): expected ${example.expectedSource}, got ${out.canonical!.sourceId}`
      );

      // 3. canonical numeric value must be within tolerance
      const actualValue = out.canonical!.factValueNumeric;
      assert.ok(
        actualValue !== null && actualValue !== undefined,
        `canonical row has null factValueNumeric for (${example.countrySlug}, ${example.factKey})`
      );
      const diff = relDiff(actualValue!, example.expectedValue);
      assert.ok(
        diff <= example.tolerance,
        `canonical value drift for (${example.countrySlug}, ${example.factKey}): ` +
          `expected ${formatNumber(example.expectedValue)}, ` +
          `got ${formatNumber(actualValue)}, ` +
          `relative diff ${(diff * 100).toFixed(4)}% > tolerance ${(example.tolerance * 100).toFixed(2)}%`
      );

      // 4. fact year must match exactly
      assert.equal(
        out.canonical!.factYear,
        example.expectedFactYear,
        `canonical factYear for (${example.countrySlug}, ${example.factKey}): expected ${example.expectedFactYear}, got ${out.canonical!.factYear}`
      );

      // 5. decision reason must match exactly
      assert.equal(
        out.decisionReason,
        example.expectedDecisionReason,
        `decisionReason for (${example.countrySlug}, ${example.factKey}): expected ${example.expectedDecisionReason}, got ${out.decisionReason}`
      );

      // 6. WE8 only — disputed flag must be true
      if (example.expectIsDisputed !== undefined) {
        assert.equal(
          out.isDisputed,
          example.expectIsDisputed,
          `isDisputed for (${example.countrySlug}, ${example.factKey}): expected ${example.expectIsDisputed}, got ${out.isDisputed}`
        );
      }
    });
  }

  console.log(`\n${pass} passed, ${fail} failed${skip > 0 ? `, ${skip} skipped` : ""}`);
  if (fail > 0) {
    console.log(
      `\nWorked-example contract drift detected. Either:\n` +
        `  (a) update WORKED_EXAMPLES + the methodology page text together if intentional, or\n` +
        `  (b) investigate why the resolver pick changed before merging.\n` +
        `See docstring at top of this file for protocol.`
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
