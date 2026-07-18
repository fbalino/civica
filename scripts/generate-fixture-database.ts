import { writeFileSync } from "node:fs";

import { fixtureSeedCounts } from "../src/lib/qa/fixture-database";
import {
  FIXTURE_DATABASE_EXPECTED_PATH,
  REPRESENTATIVE_MIGRATION_PATH,
  fixtureDatabaseSeed,
  fixtureDatabaseSha256,
} from "./fixture-database-source";

const expected = {
  schemaVersion: "civica-qa-database-expected/v1",
  fixtureSha256: fixtureDatabaseSha256(),
  rowCounts: fixtureSeedCounts(fixtureDatabaseSeed()),
  migration: {
    path: REPRESENTATIVE_MIGRATION_PATH,
    requiredRelations: [
      "cron_job_attempts",
      "cron_job_executions",
      "cron_job_leases",
    ],
  },
  credentialsUsed: [],
  networkRequests: 0,
  tolerance: "exact fixture bytes and relational row counts",
} as const;

writeFileSync(
  FIXTURE_DATABASE_EXPECTED_PATH,
  `${JSON.stringify(expected, null, 2)}\n`,
);
console.log(`Wrote ${FIXTURE_DATABASE_EXPECTED_PATH}`);
