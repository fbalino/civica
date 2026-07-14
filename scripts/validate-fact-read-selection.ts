import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  metadataFromResolutions,
  parseAtlasReadSelection,
} from "../src/lib/factbook/read-selection";

config({ path: ".env.local", quiet: true });
const VINTAGE = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1";

async function main() {
  const errors: string[] = [];
  const countryRoute = readFileSync(
    "src/app/api/v1/countries/[code]/route.ts",
    "utf8",
  );
  const countriesRoute = readFileSync(
    "src/app/api/v1/countries/route.ts",
    "utf8",
  );
  const exportRoute = readFileSync(
    "src/app/api/countries/[slug]/export/route.ts",
    "utf8",
  );
  const selection = readFileSync("src/lib/factbook/read-selection.ts", "utf8");
  const schemas = readFileSync("src/lib/api/contract/schemas.ts", "utf8");
  const registry = readFileSync("src/lib/api/contract/registry.ts", "utf8");
  for (const [path, source] of [
    ["country list", countriesRoute],
    ["country detail", countryRoute],
    ["country export", exportRoute],
  ] as const) {
    for (const token of [
      "parseAtlasReadSelection",
      "metadataFromResolutions",
      "UNSUPPORTED",
    ])
      if (
        !source.includes(token) &&
        !(
          token === "UNSUPPORTED" &&
          source.includes("Unsupported immutable vintage")
        )
      )
        errors.push(`${path} missing ${token}`);
    if (!/getFrozen(?:Facts|DisplayFacts)ForJurisdiction/.test(source))
      errors.push(`${path} lacks a frozen-row loader`);
  }
  if (
    !/liveFallback\s*\?\s*country\b/.test(countryRoute) ||
    !/liveFallback\s*\?\s*country\.population\b/.test(countryRoute)
  )
    errors.push("frozen country detail can still borrow live cache values");
  if (
    !countriesRoute.includes('selection.mode === "vintage"') ||
    !countriesRoute.includes(
      "capital: f?.get(LIST_FACT_FIELDS.capital)?.text ?? null",
    )
  )
    errors.push("frozen country list can still borrow live cache values");
  if (
    !selection.includes("vintage: null") ||
    !selection.includes("cutoffAt: null")
  )
    errors.push("live metadata does not explicitly exclude frozen identity");
  for (const field of [
    "mode",
    "asOf",
    "cutoffAt",
    "retrievedThrough",
    "methodologyVersions",
  ])
    if (!schemas.includes(field))
      errors.push(`API metadata schema lacks ${field}`);
  if ((registry.match(/name: "as_of"/g) ?? []).length !== 3)
    errors.push("public contract does not declare all three as_of parameters");
  if (
    parseAtlasReadSelection(null).selection ||
    parseAtlasReadSelection("2026-Q1").selection ||
    !parseAtlasReadSelection(VINTAGE).selection
  )
    errors.push("selector grammar is not fail-closed");
  const liveMeta = metadataFromResolutions({ mode: "live", asOf: "live" }, {});
  if (liveMeta.vintage !== null || liveMeta.cutoffAt !== null)
    errors.push("live metadata carries frozen state");

  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL)
      errors.push("DATABASE_URL is required for --live");
    else {
      const sql = neon(process.env.DATABASE_URL);
      const labels =
        await sql`SELECT vintage_label, count(*)::int rows, count(DISTINCT cut_at_timestamp)::int cuts FROM country_fact_vintages GROUP BY vintage_label ORDER BY vintage_label`;
      const differential =
        await sql`SELECT j.slug,v.fact_key,v.value_numeric AS frozen,cf.fact_value_numeric AS current FROM country_fact_vintages v JOIN country_facts cf ON cf.id=v.canonical_fact_id JOIN jurisdictions j ON j.id=v.jurisdiction_id WHERE v.vintage_label=${VINTAGE} AND v.value_numeric IS DISTINCT FROM cf.fact_value_numeric ORDER BY j.slug,v.fact_key LIMIT 1`;
      const target = labels.find((row) => row.vintage_label === VINTAGE);
      if (!target || Number(target.rows) !== 17506 || Number(target.cuts) !== 1)
        errors.push("named immutable vintage is absent or lacks one cut");
      if (!differential[0])
        errors.push(
          "no post-cut differential exists to prove live/frozen isolation",
        );
      console.log(
        `Live vintage: ${target?.rows} rows, ${target?.cuts} cut; differential ${differential[0]?.slug}/${differential[0]?.fact_key}: ${differential[0]?.current} live vs ${differential[0]?.frozen} frozen`,
      );
    }
  }
  console.log("=== DAT-031 explicit fact read selection ===\n");
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(
    "PASS — live and immutable-vintage facts have explicit selection and row-derived metadata.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
