import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../src/lib/db/schema";
import { derivationVersionErrors } from "../src/lib/research/derivation-version";
import { PRODUCT_RIGHTS, RELEASE_ARTIFACT_RIGHTS } from "../src/lib/rights/manifest";

const REQUIRED_TABLES = [
  "country_fact_vintages",
  "government_taxonomies",
  "ci_dimension_scores",
  "ci_composite_scores",
  "pulse_events_v2",
  "pulse_dimensional_deltas",
] as const;

const WRITERS = [
  "src/lib/factbook/reconcile/snapshot-vintage.ts",
  "scripts/derive-government-taxonomy.ts",
  "scripts/ingest-government-taxonomy-br.ts",
  "src/lib/government-taxonomy/writer.ts",
  "src/lib/ci/ingest.ts",
  "src/lib/ci/calculate.ts",
  "src/lib/ci/calculate-v2.ts",
  "src/lib/pulse/v2/classify.ts",
  "src/lib/pulse/v2/score.ts",
] as const;

const TABLE_EXPORTS = [
  "countryFactVintages",
  "governmentTaxonomies",
  "ciDimensionScores",
  "ciCompositeScores",
  "pulseEventsV2",
  "pulseDimensionalDeltas",
] as const;

function productionTypeScriptFiles(directory: string): string[] {
  const absolute = resolve(process.cwd(), directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return productionTypeScriptFiles(relative);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [relative]
      : [];
  });
}

const errors: string[] = [];
const tableConfigs = Object.values(schema).flatMap((value) => {
  try {
    const config = getTableConfig(value as never);
    return config.columns.length ? [config] : [];
  } catch {
    return [];
  }
});

for (const name of REQUIRED_TABLES) {
  const table = tableConfigs.find((config) => config.name === name);
  if (!table) {
    errors.push(`missing required derived table ${name}`);
    continue;
  }
  const columns = new Set(table.columns.map((column) => column.name));
  for (const column of ["derivation_version_key", "derivation_versions"]) {
    if (!columns.has(column)) errors.push(`${name} is missing ${column}`);
  }
}

for (const writer of WRITERS) {
  const source = readFileSync(resolve(process.cwd(), writer), "utf8");
  if (!source.includes("derivationVersionKey") || !source.includes("derivationVersions")) {
    errors.push(`${writer} does not persist both derivation-version fields`);
  }
}

const declaredWriters = new Set<string>(WRITERS);
for (const file of [...productionTypeScriptFiles("src"), ...productionTypeScriptFiles("scripts")]) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  const writesDerivedTable = TABLE_EXPORTS.some(
    (table) =>
      new RegExp(`\\.insert\\(\\s*${table}\\s*\\)`).test(source) ||
      new RegExp(`INSERT\\s+INTO\\s+[\"']?${table}[\"']?`, "i").test(source),
  );
  if (writesDerivedTable && !declaredWriters.has(file)) {
    errors.push(`unregistered derived-table writer: ${file}`);
  }
}

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0021_derivation_version_envelopes.sql"),
  "utf8",
);
for (const table of REQUIRED_TABLES) {
  if (!migration.includes(`ALTER TABLE "${table}" ADD COLUMN "derivation_version_key"`) || !migration.includes(`Existing ${table} row predates DAT-010`)) {
    errors.push(`migration does not add and honestly backfill ${table}`);
  }
}

for (const product of PRODUCT_RIGHTS) {
  if (!product.requiresDerivationVersions) errors.push(`${product.productId} does not require derivation versions on future export`);
}
for (const artifact of RELEASE_ARTIFACT_RIGHTS) {
  for (const error of derivationVersionErrors(artifact.derivationVersions)) {
    errors.push(`${artifact.releaseId}: ${error}`);
  }
}

console.log("=== DAT-010 derivation-version validation ===\n");
console.log(`Versioned derived tables: ${REQUIRED_TABLES.length}`);
console.log(`Checked production writers: ${WRITERS.length}`);
console.log(`Versioned release artifacts: ${RELEASE_ARTIFACT_RIGHTS.length}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("\nPASS — derived rows and release contracts retain explicit version envelopes.");
