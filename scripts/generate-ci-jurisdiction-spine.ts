import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT id::text, name, iso3 FROM jurisdictions WHERE iso3 IS NOT NULL ORDER BY iso3`;
  const canonical = JSON.stringify(rows);
  const artifact = {
    schemaVersion: "ci-jurisdiction-spine/v1",
    purpose: "Stable Civica identity join for clean-room Index reproduction; contains no publisher measurements.",
    rowCount: rows.length,
    sha256: createHash("sha256").update(canonical).digest("hex"),
    rows,
  };
  const path = "data/releases/ci-beta-r5-2024-Q4/jurisdiction-spine.v1.json";
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Wrote ${path}: ${rows.length} rows, ${artifact.sha256}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
