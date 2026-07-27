import { existsSync, readFileSync } from "node:fs";

import {
  FIXTURE_DATABASE_SCHEMA_VERSION,
  fixtureDatabaseSeedErrors,
  fixtureSeedCounts,
} from "../src/lib/qa/fixture-database";
import {
  FIXTURE_DATABASE_EXPECTED_PATH,
  FIXTURE_DATABASE_PATH,
  REPRESENTATIVE_MIGRATION_PATH,
  fixtureDatabaseExpected,
  fixtureDatabaseSeed,
  fixtureDatabaseSha256,
} from "./fixture-database-source";

const errors = fixtureDatabaseSeedErrors(fixtureDatabaseSeed());
const expected = fixtureDatabaseExpected();
if (expected.schemaVersion !== "civica-qa-database-expected/v1") {
  errors.push("fixture expected-artifact schema version drifted");
}
if (expected.fixtureSha256 !== fixtureDatabaseSha256()) {
  errors.push("fixture expected-artifact hash drifted; run npm run generate:fixture-database");
}
if (JSON.stringify(expected.rowCounts) !== JSON.stringify(fixtureSeedCounts(fixtureDatabaseSeed()))) {
  errors.push("fixture expected-artifact row counts drifted; run npm run generate:fixture-database");
}
if (expected.migration.path !== REPRESENTATIVE_MIGRATION_PATH || !existsSync(REPRESENTATIVE_MIGRATION_PATH)) {
  errors.push("representative authoritative migration is missing or changed");
}
for (const relation of expected.migration.requiredRelations) {
  if (!readFileSync(REPRESENTATIVE_MIGRATION_PATH, "utf8").includes(`"${relation}"`)) {
    errors.push(`representative migration omits ${relation}`);
  }
}
for (const [path, fragments] of Object.entries({
  "data/TEST-FIXTURE-DATABASE.md": [
    FIXTURE_DATABASE_SCHEMA_VERSION,
    "PGlite",
    "synthetic",
    "0034_superb_the_fallen",
  ],
  "data/LIVE-DB-TEST-POLICY.md": [
    "civica-qa-database-fixture/v1",
    "PGlite",
  ],
  "package.json": [
    '"validate:fixture-database"',
    '"generate:fixture-database"',
  ],
})) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path} lacks ${fragment}`);
  }
}
if (!existsSync(FIXTURE_DATABASE_PATH) || !existsSync(FIXTURE_DATABASE_EXPECTED_PATH)) {
  errors.push("fixture data artifacts are missing");
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `PASS — ${FIXTURE_DATABASE_SCHEMA_VERSION}: synthetic PGlite fixture, exact bytes, 11 relational groups, and representative migration are closed.`,
);
