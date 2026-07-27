/**
 * BRD-012 legacy raw-IP minimization.
 *
 * The default command is read-only and reports aggregate counts only:
 *   npm run plan:legacy-private-identifiers
 *
 * Production mutation requires both flags:
 *   npm run plan:legacy-private-identifiers -- \
 *     --apply --confirm=purge-legacy-private-identifiers
 *
 * Never print IDs, IP values, names, email addresses, or message content.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";

const APPLY_CONFIRMATION = "purge-legacy-private-identifiers";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmed = args.has(`--confirm=${APPLY_CONFIRMATION}`);

interface CountRow {
  contact_with_ip: number;
  advisory_with_ip: number;
}

async function counts(): Promise<CountRow> {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int
         FROM contact_submissions
        WHERE ip_address IS NOT NULL) AS contact_with_ip,
      (SELECT COUNT(*)::int
         FROM advisory_applications
        WHERE ip_address IS NOT NULL) AS advisory_with_ip
  `);
  return result.rows[0] as unknown as CountRow;
}

async function main() {
  if (apply !== confirmed) {
    throw new Error(
      `mutation requires both --apply and --confirm=${APPLY_CONFIRMATION}`,
    );
  }

  const before = await counts();
  console.log(
    JSON.stringify(
      {
        contract: "civica-legacy-private-identifier-purge/v1",
        mode: apply ? "apply" : "plan",
        checkedAt: new Date().toISOString(),
        before,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      `PLAN ONLY — rerun with --apply --confirm=${APPLY_CONFIRMATION} after owner authorization.`,
    );
    return;
  }

  const result = await db.execute(sql`
    WITH contact_purge AS (
      UPDATE contact_submissions
         SET ip_address = NULL
       WHERE ip_address IS NOT NULL
       RETURNING 1
    ),
    advisory_purge AS (
      UPDATE advisory_applications
         SET ip_address = NULL
       WHERE ip_address IS NOT NULL
       RETURNING 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM contact_purge) AS contact_purged,
      (SELECT COUNT(*)::int FROM advisory_purge) AS advisory_purged
  `);
  const after = await counts();
  console.log(
    JSON.stringify(
      {
        mode: "applied",
        purged: result.rows[0],
        after,
      },
      null,
      2,
    ),
  );
  if (after.contact_with_ip !== 0 || after.advisory_with_ip !== 0) {
    throw new Error("legacy raw-IP purge did not reach a zero-row state");
  }
}

main().catch(() => {
  console.error("[privacy-retention] operation_failed");
  process.exit(1);
});
