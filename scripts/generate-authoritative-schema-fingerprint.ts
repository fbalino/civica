import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { PUBLIC_SCHEMA_FINGERPRINT_SQL, publicSchemaFingerprint } from "../src/lib/db/authoritative-migrations";

config({ path: ".env.local" });
async function main() {
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const postgresUrlArg = process.argv.find((arg) => arg.startsWith("--postgres-url="))?.slice("--postgres-url=".length);
let schema: unknown;
if (postgresUrlArg) {
  const psql = process.env.PSQL ?? "/opt/homebrew/Cellar/postgresql@17/17.9/bin/psql";
  schema = JSON.parse(execFileSync(psql, [postgresUrlArg, "-At", "-v", "ON_ERROR_STOP=1", "-c", PUBLIC_SCHEMA_FINGERPRINT_SQL], { encoding: "utf8", maxBuffer: 10_000_000 }).trim());
} else {
  const rows = await sql.query(PUBLIC_SCHEMA_FINGERPRINT_SQL, []);
  schema = (rows as unknown as Array<{ schema: unknown }>)[0]?.schema;
}
const payload = { schemaVersion: "authoritative-schema-fingerprint/v1", generatedAt: new Date().toISOString(), sha256: publicSchemaFingerprint(schema), schema };
writeFileSync("data/authoritative-schema-fingerprint.v1.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote schema fingerprint ${payload.sha256}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
