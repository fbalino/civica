import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  DATA_VALUE_STATUSES,
  validateDataValueState,
} from "../src/lib/data/value-state";

config({ path: ".env.local", quiet: true });

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const errors: string[] = [];
const migration = read("drizzle/migrations/0023_data_value_states.sql");
const schema = read("src/lib/db/schema.ts");
const apiSchemas = read("src/lib/api/contract/schemas.ts");
const countryRoute = read("src/app/api/v1/countries/[code]/route.ts");
const indicatorUi = read("src/components/ci/CountryTrendSection.tsx");
const designSystem = read("src/app/design-system/page.tsx");
const dictionary = read("data/schema-data-dictionary.v1.json");

if (new Set(DATA_VALUE_STATUSES).size !== 7) errors.push("status registry must contain seven unique values");
for (const status of DATA_VALUE_STATUSES) {
  if (!migration.includes(`'${status}'`)) errors.push(`migration omits ${status}`);
  if (!apiSchemas.includes(`"${status}"`)) errors.push(`API enum omits ${status}`);
  if (!designSystem.includes(`status="${status}"`)) errors.push(`design-system rendering omits ${status}`);
}
for (const table of ["country_facts", "indicator_history", "country_metrics"]) {
  for (const suffix of ["allowed", "shape", "reason"]) {
    if (!migration.includes(`${table}_value_status_${suffix}`)) errors.push(`${table} lacks ${suffix} constraint`);
  }
}
for (const token of ["valueStatus: text(\"value_status\")", "valueStatusReason: text(\"value_status_reason\")"]) {
  if ((schema.match(new RegExp(token.replace(/[()]/g, "\\$&"), "g")) ?? []).length !== 3) errors.push(`schema does not define ${token} on all three stores`);
}
if (!countryRoute.includes("buildApiDataValueStatus") || !countryRoute.includes("valueStatus,")) errors.push("country API does not emit field-level value status");
if (!indicatorUi.includes("DataValueState") || !indicatorUi.includes("availability")) errors.push("indicator UI does not render availability states");
if (/Until DAT-015/.test(dictionary)) errors.push("data dictionary still describes DAT-015 as future work");
for (const status of DATA_VALUE_STATUSES) {
  const hasValue = status === "observed" || status === "disputed";
  const reason = status === "observed" ? null : "validator fixture";
  if (validateDataValueState({ status, hasValue, reason }).length) errors.push(`${status} fails its own canonical fixture`);
}

async function validateLive() {
  if (!process.argv.includes("--live")) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const columns = await sql`SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('country_facts', 'indicator_history', 'country_metrics')
      AND column_name IN ('value_status', 'value_status_reason')`;
  if (columns.length !== 6) errors.push(`live schema has ${columns.length}/6 value-state columns`);
  const [facts] = await sql`SELECT count(*)::int AS invalid FROM country_facts
    WHERE (value_status IN ('observed','disputed')) <> (fact_value IS NOT NULL OR fact_value_numeric IS NOT NULL OR value_json IS NOT NULL)
       OR (value_status = 'observed') <> (value_status_reason IS NULL)`;
  const [history] = await sql`SELECT count(*)::int AS invalid FROM indicator_history
    WHERE (value_status IN ('observed','disputed')) <> (value IS NOT NULL)
       OR (value_status = 'observed') <> (value_status_reason IS NULL)`;
  const [metrics] = await sql`SELECT count(*)::int AS invalid FROM country_metrics
    WHERE (value_status IN ('observed','disputed')) <> (value IS NOT NULL)
       OR (value_status = 'observed') <> (value_status_reason IS NULL)`;
  for (const [table, row] of [["country_facts", facts], ["indicator_history", history], ["country_metrics", metrics]] as const) {
    if (Number(row?.invalid ?? -1) !== 0) errors.push(`${table} has ${row?.invalid ?? "unknown"} invalid live rows`);
  }
  console.log(`Live rows: ${JSON.stringify({ country_facts: facts?.invalid, indicator_history: history?.invalid, country_metrics: metrics?.invalid })}`);
}

async function main() {
  await validateLive();
  console.log("=== DAT-015 data-value states ===\n");
  console.log(`States: ${DATA_VALUE_STATUSES.join(", ")}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log("\nPASS — storage, API, UI, export, dictionary, and fixtures preserve all states.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
