import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { asc } from "drizzle-orm";
import { db } from "../src/lib/db";
import { jurisdictions } from "../src/lib/db/schema";
import {
  classifyJurisdictionStatus,
  JURISDICTION_STATUS_REVIEWED_AT,
} from "../src/lib/jurisdictions/status-taxonomy";

async function main() {
  const rows = await db
    .select({
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
      type: jurisdictions.type,
      statusSourceIds: jurisdictions.statusSourceIds,
      statusReviewedAt: jurisdictions.statusReviewedAt,
      administeringJurisdictionIso3:
        jurisdictions.administeringJurisdictionIso3,
      statusDisputed: jurisdictions.statusDisputed,
    })
    .from(jurisdictions)
    .orderBy(asc(jurisdictions.slug));

  const errors: string[] = [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const expected = classifyJurisdictionStatus(row);
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
    if (row.type !== expected.type) {
      errors.push(`${row.slug}: type=${row.type}, expected ${expected.type}`);
    }
    if (row.statusReviewedAt !== JURISDICTION_STATUS_REVIEWED_AT) {
      errors.push(`${row.slug}: status review date drifted`);
    }
    if (
      row.administeringJurisdictionIso3 !==
      expected.administeringJurisdictionIso3
    ) {
      errors.push(`${row.slug}: administering relationship drifted`);
    }
    if (row.statusDisputed !== expected.disputed) {
      errors.push(`${row.slug}: dispute flag drifted`);
    }
    if (
      JSON.stringify(row.statusSourceIds) !== JSON.stringify(expected.sourceIds)
    ) {
      errors.push(`${row.slug}: status source ids drifted`);
    }
  }

  if (rows.length !== 253)
    errors.push(`live catalog has ${rows.length} rows, expected 253`);

  console.log("=== DAT-004 live jurisdiction-status audit ===\n");
  for (const [type, count] of [...counts].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`${type}: ${count}`);
  }

  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }

  console.log("\nPASS — all 253 live rows match jurisdiction-status/v1.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
