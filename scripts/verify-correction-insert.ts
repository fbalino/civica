import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const res = await sql`
    INSERT INTO correction_log (category, description, is_public)
    VALUES ('other', 'Test submission — Phase 5.1 verification.', false)
    RETURNING id, status
  `;
  console.log("Inserted row:", res[0]);

  const count = await sql`SELECT COUNT(*) FROM correction_log`;
  console.log("Total rows in correction_log:", count[0].count);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
