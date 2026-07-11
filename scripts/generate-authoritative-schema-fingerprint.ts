import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { PUBLIC_SCHEMA_FINGERPRINT_SQL, publicSchemaFingerprint } from "../src/lib/db/authoritative-migrations";

config({ path: ".env.local" });
async function main() {
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query(PUBLIC_SCHEMA_FINGERPRINT_SQL, []);
const schema = (rows as unknown as Array<{ schema: unknown }>)[0]?.schema;
const payload = { schemaVersion: "authoritative-schema-fingerprint/v1", generatedAt: new Date().toISOString(), sha256: publicSchemaFingerprint(schema), schema };
writeFileSync("data/authoritative-schema-fingerprint.v1.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote schema fingerprint ${payload.sha256}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
