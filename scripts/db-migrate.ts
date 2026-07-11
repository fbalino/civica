import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { AUTHORITATIVE_MIGRATIONS } from "../src/lib/db/authoritative-migration-manifest";
import { PUBLIC_SCHEMA_FINGERPRINT_SQL, migrationPlan, publicSchemaFingerprint, splitPostgresStatements, validateAuthoritativeManifest } from "../src/lib/db/authoritative-migrations";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for db:migrate");
  const planOnly = process.argv.includes("--plan");
  const manifestErrors = validateAuthoritativeManifest(AUTHORITATIVE_MIGRATIONS);
  if (manifestErrors.length) throw new Error(manifestErrors.join("\n"));
  const expected = JSON.parse(readFileSync("data/authoritative-schema-fingerprint.v1.json", "utf8")) as { sha256: string };
  const sql = neon(process.env.DATABASE_URL);
  const [shape] = await sql`SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS tables,
    to_regclass('civica_meta.schema_migrations')::text AS ledger`;
  const appliedRows = shape.ledger
    ? await sql`SELECT id, sha256 FROM civica_meta.schema_migrations ORDER BY id`
    : [];
  const appliedIds = appliedRows.map((row) => String(row.id));
  const { unknown, pending } = migrationPlan(AUTHORITATIVE_MIGRATIONS, appliedIds);
  if (unknown.length) throw new Error(`Database contains unknown authoritative migrations: ${unknown.join(", ")}`);
  for (const row of appliedRows) {
    const declared = AUTHORITATIVE_MIGRATIONS.find((item) => item.id === row.id);
    if (!declared || declared.sha256 !== row.sha256) throw new Error(`Applied migration hash differs from repository: ${row.id}`);
  }

  const schemaRows = await sql.query(PUBLIC_SCHEMA_FINGERPRINT_SQL, []) as unknown as Array<{ schema: unknown }>;
  const beforeFingerprint = publicSchemaFingerprint(schemaRows[0]?.schema);
  const baseline = AUTHORITATIVE_MIGRATIONS[0];
  const adoptBaseline = !appliedIds.includes(baseline.id) && Number(shape.tables) > 0;
  if (adoptBaseline && beforeFingerprint !== expected.sha256) {
    throw new Error(`Existing schema cannot adopt baseline: live ${beforeFingerprint}, expected ${expected.sha256}`);
  }
  console.log(`Authoritative migrations: applied=${appliedIds.length}, pending=${pending.length}, publicTables=${shape.tables}`);
  if (adoptBaseline) console.log(`Baseline action: adopt exact existing schema ${beforeFingerprint}`);
  else if (pending.some((row) => row.baseline)) console.log("Baseline action: create empty database schema");
  for (const row of pending.filter((item) => !item.baseline)) console.log(`Apply: ${row.id}`);
  if (planOnly) { console.log("PLAN ONLY — writes performed: 0"); return; }

  await sql.query("CREATE SCHEMA IF NOT EXISTS civica_meta", []);
  await sql.query(`CREATE TABLE IF NOT EXISTS civica_meta.schema_migrations (
    id text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz DEFAULT now() NOT NULL,
    mode text NOT NULL CHECK (mode IN ('executed','adopted'))
  )`, []);

  if (adoptBaseline) {
    await sql`INSERT INTO civica_meta.schema_migrations (id,sha256,mode) VALUES (${baseline.id},${baseline.sha256},'adopted') ON CONFLICT (id) DO NOTHING`;
  } else {
    for (const migration of pending) {
      if (migration.baseline && Number(shape.tables) > 0) continue;
      const statements = splitPostgresStatements(readFileSync(migration.path, "utf8"));
      const queries = [
        sql.query("SELECT pg_advisory_xact_lock(202607110026)", []),
        ...statements.map((statement) => sql.query(statement, [])),
        sql`INSERT INTO civica_meta.schema_migrations (id,sha256,mode) VALUES (${migration.id},${migration.sha256},'executed')`,
      ];
      await sql.transaction(queries);
      console.log(`Applied ${migration.id} (${statements.length} statements)`);
    }
  }

  const afterRows = await sql.query(PUBLIC_SCHEMA_FINGERPRINT_SQL, []) as unknown as Array<{ schema: unknown }>;
  const afterFingerprint = publicSchemaFingerprint(afterRows[0]?.schema);
  if (afterFingerprint !== expected.sha256) throw new Error(`Post-migration schema fingerprint ${afterFingerprint} differs from ${expected.sha256}`);
  console.log(`PASS — schema fingerprint ${afterFingerprint}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
