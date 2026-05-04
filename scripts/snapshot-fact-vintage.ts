/**
 * Phase F.1 — Quarterly fact vintage snapshot.
 *
 * Walks every (jurisdiction, fact_key) tracked in `country_facts`,
 * runs the resolver to pick the canonical row, and writes a
 * `country_fact_vintages` row with the chosen value frozen at the
 * given vintage label. Idempotent on
 * (jurisdiction_id, fact_key, vintage_label).
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §4
 *
 * Usage:
 *   npx tsx scripts/snapshot-fact-vintage.ts --vintage="Civica Atlas 2026Q3"
 *   npx tsx scripts/snapshot-fact-vintage.ts --vintage="Civica Atlas 2026Q3" --dry-run
 *   npx tsx scripts/snapshot-fact-vintage.ts --vintage="Civica Atlas 2026Q3" --jurisdiction=nigeria
 *
 * The vintage label is the citation handle (`vintage_label`
 * column on country_fact_vintages) — readers cite "Civica Atlas
 * 2026Q3" and that's the slice they get back.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import {
  countryFacts,
  countryFactVintages,
  jurisdictions,
} from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { resolveFromRows } from "../src/lib/factbook/reconcile/resolver";
import { getFactKey } from "../src/lib/factbook/reconcile/fact-keys";
import type { FactRow } from "../src/lib/factbook/reconcile/types";

interface CliArgs {
  vintage: string;
  dryRun: boolean;
  jurisdictionSlug?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let vintage = "";
  let dryRun = false;
  let jurisdictionSlug: string | undefined;

  for (const a of args) {
    if (a.startsWith("--vintage=")) vintage = a.slice("--vintage=".length);
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--jurisdiction=")) {
      jurisdictionSlug = a.slice("--jurisdiction=".length);
    }
  }

  if (!vintage) {
    console.error(
      'Missing --vintage= argument. Example: --vintage="Civica Atlas 2026Q3"'
    );
    process.exit(2);
  }

  return { vintage, dryRun, jurisdictionSlug };
}

interface FactRowDb {
  id: string;
  jurisdictionId: string;
  factKey: string;
  factGroup: string;
  category: string;
  sourceId: string;
  sourceUrl: string | null;
  wikidataQid: string | null;
  wikidataPid: string | null;
  wikidataRank: string | null;
  references: unknown;
  factValue: string | null;
  factValueNumeric: number | null;
  factUnit: string | null;
  factYear: number | null;
  valueJson: unknown;
  asOf: string | null;
  retrievedAt: Date | string;
  upstreamVintageLabel: string | null;
  methodologyVersion: string;
  status: string;
  statusReason: string | null;
  sourceNote: string | null;
  /** Bug 1 — `'measured'` (default) or `'projected'`. */
  valueType?: string | null;
}

function dbRowToFactRow(row: FactRowDb): FactRow {
  return {
    id: row.id,
    jurisdictionId: row.jurisdictionId,
    factKey: row.factKey,
    factGroup: row.factGroup as "A" | "B" | "C",
    category: row.category,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    wikidataQid: row.wikidataQid,
    wikidataPid: row.wikidataPid,
    wikidataRank:
      row.wikidataRank === "preferred" ||
      row.wikidataRank === "normal" ||
      row.wikidataRank === "deprecated"
        ? row.wikidataRank
        : null,
    references: Array.isArray(row.references)
      ? (row.references as unknown[])
      : null,
    factValue: row.factValue,
    factValueNumeric: row.factValueNumeric,
    factUnit: row.factUnit,
    factYear: row.factYear,
    valueJson: row.valueJson,
    asOf: row.asOf,
    retrievedAt:
      typeof row.retrievedAt === "string"
        ? row.retrievedAt
        : row.retrievedAt.toISOString(),
    upstreamVintageLabel: row.upstreamVintageLabel,
    methodologyVersion: row.methodologyVersion,
    status:
      row.status === "active" ||
      row.status === "rejected" ||
      row.status === "superseded"
        ? row.status
        : "active",
    statusReason: row.statusReason,
    sourceNote: row.sourceNote,
    valueType: row.valueType === "projected" ? "projected" : "measured",
  };
}

async function main() {
  const { vintage, dryRun, jurisdictionSlug } = parseArgs();

  console.log(
    `Phase F vintage snapshot — vintage="${vintage}"${dryRun ? " (DRY RUN)" : ""}${jurisdictionSlug ? ` jurisdiction=${jurisdictionSlug}` : ""}`
  );

  // 1. Fetch every (jurisdiction, fact_key) pair currently in country_facts.
  const pairs = await db
    .select({
      jurisdictionId: countryFacts.jurisdictionId,
      factKey: countryFacts.factKey,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
    })
    .from(countryFacts)
    .innerJoin(
      jurisdictions,
      eq(countryFacts.jurisdictionId, jurisdictions.id)
    )
    .where(
      jurisdictionSlug
        ? eq(jurisdictions.slug, jurisdictionSlug)
        : sql`1=1`
    )
    .groupBy(
      countryFacts.jurisdictionId,
      countryFacts.factKey,
      jurisdictions.slug,
      jurisdictions.name
    );

  console.log(`  ${pairs.length} (jurisdiction, fact_key) pairs to snapshot.`);

  let snapshotted = 0;
  let skippedNoFactKeyDef = 0;
  let skippedNoCanonical = 0;

  for (const pair of pairs) {
    const factKeyDef = getFactKey(pair.factKey);
    if (!factKeyDef) {
      // Fact-key not yet in the canonical enum. Skip — these are
      // CIA-imported keys we haven't classified yet. Resolver isn't
      // configured for them; vintaging would be premature.
      skippedNoFactKeyDef++;
      continue;
    }

    // 2. Pull all rows for this pair, resolve, snapshot the winner.
    const rowsRaw = (await db
      .select()
      .from(countryFacts)
      .where(
        sql`${countryFacts.jurisdictionId} = ${pair.jurisdictionId}
          AND ${countryFacts.factKey} = ${pair.factKey}`
      )) as unknown as FactRowDb[];

    const rows = rowsRaw.map(dbRowToFactRow);
    const result = resolveFromRows(rows, factKeyDef);

    if (!result.canonical) {
      skippedNoCanonical++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  [DRY] ${pair.slug} / ${pair.factKey} → ${result.canonical.sourceId} (${result.decisionReason})`
      );
      snapshotted++;
      continue;
    }

    await db
      .insert(countryFactVintages)
      .values({
        jurisdictionId: pair.jurisdictionId,
        factKey: pair.factKey,
        vintageLabel: vintage,
        canonicalFactId: result.canonical.id,
        valueText: result.canonical.factValue,
        valueNumeric: result.canonical.factValueNumeric,
        valueUnit: result.canonical.factUnit,
        valueJson: result.canonical.valueJson as object | null,
        asOf: result.canonical.asOf,
        sourceId: result.canonical.sourceId,
        methodologyVersion: result.canonical.methodologyVersion,
      })
      .onConflictDoUpdate({
        target: [
          countryFactVintages.jurisdictionId,
          countryFactVintages.factKey,
          countryFactVintages.vintageLabel,
        ],
        set: {
          canonicalFactId: result.canonical.id,
          valueText: result.canonical.factValue,
          valueNumeric: result.canonical.factValueNumeric,
          valueUnit: result.canonical.factUnit,
          valueJson: result.canonical.valueJson as object | null,
          asOf: result.canonical.asOf,
          sourceId: result.canonical.sourceId,
          methodologyVersion: result.canonical.methodologyVersion,
          snapshotAt: new Date(),
        },
      });

    snapshotted++;
  }

  console.log(`\nDone.`);
  console.log(`  Snapshotted: ${snapshotted}`);
  console.log(`  Skipped (fact-key not in enum yet): ${skippedNoFactKeyDef}`);
  console.log(`  Skipped (no active row): ${skippedNoCanonical}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
