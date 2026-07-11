import { readFileSync, readdirSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { AUTHORITATIVE_MIGRATIONS } from "../src/lib/db/authoritative-migration-manifest";
import { PUBLIC_SCHEMA_FINGERPRINT_SQL, publicSchemaFingerprint, splitPostgresStatements, validateAuthoritativeManifest } from "../src/lib/db/authoritative-migrations";

config({ path: ".env.local" });
async function main() {
const errors = validateAuthoritativeManifest(AUTHORITATIVE_MIGRATIONS);
const baseline = AUTHORITATIVE_MIGRATIONS[0];
const sqlFiles = readdirSync("drizzle/authoritative").filter((name) => name.endsWith(".sql")).sort();
const journal = JSON.parse(readFileSync("drizzle/authoritative/meta/_journal.json", "utf8")) as { entries: Array<{ tag: string }> };
const declaredIds = AUTHORITATIVE_MIGRATIONS.map((row) => row.id);
if (JSON.stringify(sqlFiles) !== JSON.stringify(declaredIds.map((id) => `${id}.sql`))) errors.push("authoritative SQL inventory differs from manifest");
if (JSON.stringify(journal.entries.map((row) => row.tag)) !== JSON.stringify(declaredIds)) errors.push("authoritative Drizzle journal differs from manifest");
const source = readFileSync(baseline.path, "utf8");
const statements = splitPostgresStatements(source);
const tables = (source.match(/CREATE TABLE public\./g) ?? []).length;
for (const required of ["CREATE EXTENSION IF NOT EXISTS pgcrypto", "CREATE VIEW public.pulse_evaluation_evidence", "CREATE VIEW public.reconciliation_evaluation_evidence", "dat_023_immutable_vintage", "country_fact_vintages_publication_matches_label", "government_taxonomies_regime_temporal_complete"]) if (!source.includes(required)) errors.push(`baseline missing ${required}`);
if (tables !== 50) errors.push(`baseline creates ${tables} public tables, expected 50`);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const drizzleConfig = readFileSync("drizzle.config.ts", "utf8");
if (!drizzleConfig.includes('out: "./drizzle/authoritative"')) errors.push("Drizzle output is not the authoritative directory");
if (pkg.scripts?.["db:migrate"] !== "tsx scripts/db-migrate.ts") errors.push("db:migrate is absent or redirected");
if (!String(pkg.scripts?.["vercel-build"] ?? "").startsWith("npm run db:migrate &&")) errors.push("Vercel does not migrate before build");
if (process.argv.includes("--live")) {
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required for --live");
  else {
    const sql = neon(process.env.DATABASE_URL);
    const applied = await sql`SELECT id,sha256,mode FROM civica_meta.schema_migrations ORDER BY id`;
    if (JSON.stringify(applied.map((row) => ({ id: row.id, sha256: row.sha256 }))) !== JSON.stringify(AUTHORITATIVE_MIGRATIONS.map(({ id, sha256 }) => ({ id, sha256 })))) errors.push("live authoritative ledger differs from ordered manifest");
    const rows = await sql.query(PUBLIC_SCHEMA_FINGERPRINT_SQL, []) as unknown as Array<{ schema: unknown }>;
    const actual = publicSchemaFingerprint(rows[0]?.schema);
    const expected = JSON.parse(readFileSync("data/authoritative-schema-fingerprint.v1.json", "utf8")) as { sha256: string };
    if (actual !== expected.sha256) errors.push(`live schema fingerprint ${actual} differs from ${expected.sha256}`);
    console.log(`Live ledger: ${applied.length}/${AUTHORITATIVE_MIGRATIONS.length}; baseline mode: ${applied[0]?.mode}; fingerprint: ${actual}`);
  }
}
console.log("=== DAT-026 authoritative migration path ===\n");
console.log(`Baseline tables: ${tables}; statements: ${statements.length}; ordered migrations: ${AUTHORITATIVE_MIGRATIONS.length}`);
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log("PASS — baseline, manifest, runner, deploy ordering, and schema contracts are closed.");
}
main().catch((error) => { console.error(error); process.exit(1); });
