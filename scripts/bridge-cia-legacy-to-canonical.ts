/**
 * Phase F.3 — bridge CIA legacy fact-keys to Phase F canonical names.
 *
 * The CIA seed populated `country_facts` with short names like
 * `population`, `life_expectancy`, `unemployment_rate` — historical
 * naming aligned with the CIA Factbook prose. Phase F's canonical
 * names are longer and more explicit:
 *
 *   population         → population_total
 *   life_expectancy    → life_expectancy_years
 *   unemployment_rate  → unemployment_rate_pct
 *
 * The Wikidata sync (F.2) writes to the canonical names. For the
 * resolver to actually pick between CIA and Wikidata rows, both
 * sources need to live under the SAME fact_key. This script
 * copies CIA legacy rows to canonical-keyed rows, keeping
 * source_id='cia_factbook' so the rows still cite the CIA.
 *
 * Idempotent: ON CONFLICT updates value fields only.
 * Reversible: legacy rows are NOT deleted; the resolver simply
 * starts seeing the canonical-keyed copies.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §3
 * Implementation plan: F.3.
 *
 * Usage:
 *   npx tsx scripts/bridge-cia-legacy-to-canonical.ts
 *   npx tsx scripts/bridge-cia-legacy-to-canonical.ts --dry-run
 *   npx tsx scripts/bridge-cia-legacy-to-canonical.ts --jurisdiction=nigeria
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { countryFacts, jurisdictions } from "../src/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { getFactKey } from "../src/lib/factbook/reconcile/fact-keys";

/**
 * The set of legacy → canonical mappings F.3 bridges. Each bridge
 * may carry an optional `numericMultiplier` to convert from CIA's
 * native unit to the canonical fact-key's expected unit (e.g.
 * GDP PPP: CIA stores absolute USD, canonical wants billions, so
 * 1e-9).
 *
 * Per OQ-A (resolved 2026-05-02 in `phase-f-open-questions.md`)
 * the top-3 demographic / macro flips are population, life
 * expectancy, and unemployment. Adding GDP PPP + areas + capital
 * + languages + currency at the same time so F.3.5's cache
 * refresh has all 7 cached columns populated (per
 * `src/lib/factbook/reconcile/cache.ts` COLUMN_TO_FACT_KEY).
 */
interface Bridge {
  legacy: string;
  canonical: string;
  /** Multiplier applied to fact_value_numeric. Default 1. */
  numericMultiplier?: number;
}

const BRIDGES: Bridge[] = [
  { legacy: "population", canonical: "population_total" },
  { legacy: "life_expectancy", canonical: "life_expectancy_years" },
  { legacy: "unemployment_rate", canonical: "unemployment_rate_pct" },
  // CIA stores GDP-PPP in absolute USD; canonical wants billions.
  { legacy: "gdp_ppp", canonical: "gdp_ppp_usd_billions", numericMultiplier: 1e-9 },
  { legacy: "gdp_per_capita_ppp", canonical: "gdp_per_capita_usd" },
  { legacy: "total_area", canonical: "area_total_km2" },
  { legacy: "land_area", canonical: "area_land_km2" },
  { legacy: "languages", canonical: "official_languages" },
  { legacy: "religions", canonical: "religion_breakdown" },
];

interface CliArgs {
  dryRun: boolean;
  jurisdictionSlug?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let dryRun = false;
  let jurisdictionSlug: string | undefined;
  for (const a of args) {
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--jurisdiction=")) {
      jurisdictionSlug = a.slice("--jurisdiction=".length);
    }
  }
  return { dryRun, jurisdictionSlug };
}

async function main() {
  const args = parseArgs();
  console.log(
    `Phase F.3 — CIA legacy → canonical bridge${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.jurisdictionSlug
        ? ` jurisdiction=${args.jurisdictionSlug}`
        : "")
  );

  let totalCopied = 0;

  for (const bridge of BRIDGES) {
    const canonicalDef = getFactKey(bridge.canonical);
    if (!canonicalDef) {
      console.error(
        `  ! Canonical fact-key '${bridge.canonical}' not in registry — skipping.`
      );
      continue;
    }

    // Pull all legacy CIA rows for this key.
    const legacyRows = await db
      .select({
        id: countryFacts.id,
        jurisdictionId: countryFacts.jurisdictionId,
        slug: jurisdictions.slug,
        category: countryFacts.category,
        factValue: countryFacts.factValue,
        factValueNumeric: countryFacts.factValueNumeric,
        factUnit: countryFacts.factUnit,
        factYear: countryFacts.factYear,
        sourceNote: countryFacts.sourceNote,
        retrievedAt: countryFacts.retrievedAt,
      })
      .from(countryFacts)
      .innerJoin(
        jurisdictions,
        eq(countryFacts.jurisdictionId, jurisdictions.id)
      )
      .where(
        args.jurisdictionSlug
          ? and(
              eq(countryFacts.factKey, bridge.legacy),
              eq(countryFacts.sourceId, "cia_factbook"),
              eq(jurisdictions.slug, args.jurisdictionSlug)
            )
          : and(
              eq(countryFacts.factKey, bridge.legacy),
              eq(countryFacts.sourceId, "cia_factbook")
            )
      );

    console.log(
      `  ${bridge.legacy} → ${bridge.canonical}: ${legacyRows.length} legacy rows found`
    );

    let copiedForBridge = 0;
    for (const row of legacyRows) {
      if (args.dryRun) {
        console.log(
          `    [DRY] ${row.slug} ${bridge.canonical} = ${row.factValue}` +
            (row.factYear ? ` (${row.factYear})` : "")
        );
        copiedForBridge++;
        continue;
      }

      // Compose the canonical row. Preserve provenance fields from
      // the legacy CIA row; just rewrite the fact_key. Apply unit
      // conversion if defined (e.g. GDP PPP USD → USD billions).
      const asOf =
        row.factYear && row.factYear >= 1900 && row.factYear <= 2100
          ? `${row.factYear}-01-01`
          : null;
      const mult = bridge.numericMultiplier ?? 1;
      const numericValue =
        row.factValueNumeric === null ? null : row.factValueNumeric * mult;

      await db
        .insert(countryFacts)
        .values({
          jurisdictionId: row.jurisdictionId,
          factKey: bridge.canonical,
          factGroup: canonicalDef.group,
          category: canonicalDef.category,
          sourceId: "cia_factbook",
          // CIA Factbook's per-country page URL pattern.
          sourceUrl: `https://www.cia.gov/the-world-factbook/countries/${row.slug}/`,
          factValue: row.factValue,
          factValueNumeric: numericValue,
          factUnit: canonicalDef.unit ?? row.factUnit,
          factYear: row.factYear,
          asOf,
          retrievedAt: row.retrievedAt ?? new Date(),
          upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
          methodologyVersion: "v0.1-beta",
          status: "active",
          statusReason: null,
          sourceNote: row.sourceNote,
        })
        .onConflictDoUpdate({
          target: [
            countryFacts.jurisdictionId,
            countryFacts.factKey,
            countryFacts.sourceId,
          ],
          set: {
            factValue: row.factValue,
            factValueNumeric: numericValue,
            factUnit: canonicalDef.unit ?? row.factUnit,
            factYear: row.factYear,
            asOf,
            sourceUrl: `https://www.cia.gov/the-world-factbook/countries/${row.slug}/`,
            upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
            updatedAt: new Date(),
          },
        });

      copiedForBridge++;
    }

    totalCopied += copiedForBridge;
    console.log(`    → ${copiedForBridge} canonical rows ${args.dryRun ? "would be" : "written"}.`);
  }

  console.log(
    `\nDone. ${totalCopied} canonical CIA rows ${args.dryRun ? "would be created" : "written"}.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
