import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { parseFactbookNumeric, validateFactNumeric } from "../src/lib/factbook/numeric-validation";

config({ path: ".env.local", quiet: true });

async function main() {
  const errors: string[] = [];
  const parser = readFileSync("src/lib/factbook/numeric-validation.ts", "utf8");
  const writer = readFileSync("src/lib/factbook/atlas-seed-writer.ts", "utf8");
  const seed = readFileSync("scripts/seed-from-factbook.ts", "utf8");
  const migration = readFileSync("drizzle/authoritative/0002_quarantine_numeric_outliers.sql", "utf8");
  if (!writer.includes("validateFactNumeric") || !writer.includes('status: "rejected"')) errors.push("CIA writer does not persist numeric rejection status");
  if (!seed.includes("parseFactbookNumeric") || seed.includes("function parseNumeric(")) errors.push("CIA seed does not use the bounded parser");
  if (!migration.includes("status = 'rejected'") || !migration.includes("fact_value_numeric > 100")) errors.push("repair migration does not quarantine the corrupted active row");
  if (!parser.includes("numeric_parse_failed") || !parser.includes("plausibility_envelope")) errors.push("numeric validator lacks closed failure reasons");

  const prose = "between 2010 and 2020, 20-30% of GDP; spending ranged from $7 billion to $11 billion";
  if (parseFactbookNumeric(prose, "% of GDP").value !== null) errors.push("prose parser still combines an unrelated year and scale");
  for (const [key, value] of [
    ["population_total", 50], ["population_total", 593], ["population_total", 1000],
    ["population_total", 1815], ["population_total", 2453], ["area_total_km2", 0.44],
    ["gdp_ppp_usd_billions", 0.007711583],
  ] as const) if (!validateFactNumeric(key, value).accepted) errors.push(`valid small value rejected: ${key}=${value}`);
  if (validateFactNumeric("military_expenditure_pct_gdp", 2_010_000_000_000).accepted) errors.push("catastrophic percentage passes its envelope");

  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required for --live");
    else {
      const sql = neon(process.env.DATABASE_URL);
      const [active, rejected, edges] = await Promise.all([
        sql`SELECT count(*)::int AS count FROM country_facts WHERE status = 'active' AND fact_key = 'military_expenditure_pct_gdp' AND fact_value_numeric IS NOT NULL AND (fact_value_numeric < 0 OR fact_value_numeric > 100)`,
        sql`SELECT count(*)::int AS count,
                   count(*) FILTER (WHERE fact_value IS NOT NULL AND source_id IS NOT NULL)::int AS evidenced,
                   count(*) FILTER (WHERE EXISTS (SELECT 1 FROM research_evidence_history h WHERE h.entity_table='country_facts' AND h.entity_id=cf.id::text AND h.operation='update'))::int AS retained_history
            FROM country_facts cf JOIN jurisdictions j ON j.id=cf.jurisdiction_id
            WHERE j.slug='north-korea' AND cf.fact_key='military_expenditure_pct_gdp'
              AND cf.status='rejected' AND cf.status_reason LIKE 'plausibility_envelope:%'`,
        sql`SELECT j.slug FROM country_facts cf JOIN jurisdictions j ON j.id=cf.jurisdiction_id WHERE cf.status='active' AND ((j.slug='pitcairn-islands' AND cf.fact_key='population_total' AND cf.fact_value_numeric=50) OR (j.slug='cocos-keeling-islands' AND cf.fact_key='population_total' AND cf.fact_value_numeric=593) OR (j.slug='holy-see-vatican-city' AND cf.fact_key='area_land_km2' AND abs(cf.fact_value_numeric-0.44)<0.000001) OR (j.slug='niue' AND cf.fact_key='population_total' AND cf.fact_value_numeric=1815) OR (j.slug='tokelau' AND cf.fact_key='gdp_ppp_usd_billions' AND abs(cf.fact_value_numeric-0.007711583)<0.000001))`,
      ]);
      if (Number(active[0]?.count) !== 0) errors.push("live database retains an active catastrophic percentage");
      if (Number(rejected[0]?.count) !== 1 || Number(rejected[0]?.evidenced) !== 1 || Number(rejected[0]?.retained_history) !== 1) errors.push("North Korea quarantine does not retain one evidenced row and its prior state");
      if (edges.length !== 5) errors.push(`only ${edges.length}/5 microstate edge values remain active`);
      console.log(`Live: active violations ${active[0]?.count}; evidenced quarantine ${rejected[0]?.evidenced}; microstate fixtures ${edges.length}/5`);
    }
  }
  console.log("=== DAT-029 numeric validation and quarantine ===\n");
  if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
  console.log("PASS — small valid values survive and catastrophic parses remain outside the active resolver set.");
}
main().catch((error) => { console.error(error); process.exit(1); });
