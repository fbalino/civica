import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
async function main() {
const snapshotSource = readFileSync("src/lib/factbook/reconcile/snapshot-vintage.ts", "utf8");
const indexSource = readFileSync("src/lib/ci/calculate-v2.ts", "utf8");
const migration = readFileSync("drizzle/migrations/0025_immutable_frozen_vintages.sql", "utf8");
const errors: string[] = [];
if (/insert\(countryFactVintages\)[\s\S]*?onConflictDoUpdate/.test(snapshotSource)) errors.push("Atlas frozen writer still mutates conflicts");
if (!snapshotSource.includes("Frozen vintage conflict")) errors.push("Atlas writer lacks conflict failure");
if (!indexSource.includes("Frozen Civica Index conflict")) errors.push("Index writer lacks conflict failure");
for (const required of ["supersedes_vintage_label", "civica_reject_frozen_vintage_mutation", "civica_validate_frozen_vintage_insert"]) if (!migration.includes(required)) errors.push(`migration lacks ${required}`);

if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required to validate live frozen-vintage invariants");
else {
  const sql = neon(process.env.DATABASE_URL);
  const [atlas] = await sql`SELECT count(*)::int total, count(*) FILTER (WHERE methodology_version <> (regexp_match(vintage_label, '^Civica Atlas Reconciled (v[^[:space:]]+) — vintage ([0-9]{4}-Q[1-4])$'))[1])::int version_mismatches, count(*) FILTER (WHERE content_hash IS NULL)::int null_hashes, count(*) FILTER (WHERE content_hash <> encode(digest(source_id || '|' || coalesce(value_text, '') || '|' || coalesce(value_numeric::text, '') || '|' || coalesce(as_of::text, '') || '|' || methodology_version, 'sha256'), 'hex'))::int hash_mismatches FROM country_fact_vintages`;
  const [index] = await sql`SELECT count(*)::int total, count(*) FILTER (WHERE content_hash IS NULL)::int null_hashes, count(*) FILTER (WHERE lower(methodology_version) <> lower((regexp_match(vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \\(([^)]+)\\)$'))[3]))::int version_mismatches, count(*) FILTER (WHERE quarter <> (regexp_match(vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \\(([^)]+)\\)$'))[1] || '-Q' || (regexp_match(vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \\(([^)]+)\\)$'))[2])::int period_mismatches, count(*) FILTER (WHERE content_hash <> encode(digest(score::text || '|' || coalesce(score_lower::text, '') || '|' || coalesce(score_upper::text, '') || '|' || coalesce(completeness_flag, '') || '|' || coalesce(rank::text, '') || '|' || coalesce(total_ranked::text, '') || '|' || is_partial::text || '|' || dimensions_available::text || '|' || coalesce(array_to_string((select array_agg(x order by x) from unnest(missing_dimensions) x), ','), '') || '|' || methodology_version || '|' || derivation_version_key, 'sha256'), 'hex'))::int hash_mismatches FROM ci_composite_scores WHERE vintage_label IS NOT NULL`;
  const [triggers] = await sql`SELECT count(*)::int n FROM pg_trigger WHERE tgname IN ('dat_023_immutable_vintage','dat_023_validate_vintage') AND NOT tgisinternal`;
  for (const [surface, row] of [["Atlas", atlas], ["Index", index]] as const) for (const [key, value] of Object.entries(row)) if (key !== "total" && Number(value) !== 0) errors.push(`${surface} ${key}: ${value}`);
  if (Number(triggers.n) !== 4) errors.push(`expected 4 live immutable-vintage triggers, found ${triggers.n}`);
  console.log(`Atlas frozen rows: ${atlas.total}; Index frozen rows: ${index.total}; triggers: ${triggers.n}/4`);
}
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log("PASS — named vintages are version-consistent, hashed, append-only, and supersession-gated.");
}

main().catch((error) => { console.error(error); process.exit(1); });
