import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM correction_log) AS correction_log_count,
      (SELECT COUNT(*) FROM advisory_board_members) AS advisory_board_count
  `;
  console.log("correction_log rows:", rows[0].correction_log_count);
  console.log("advisory_board_members rows:", rows[0].advisory_board_count);
  console.log("Both tables exist and are queryable.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
