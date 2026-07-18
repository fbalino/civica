import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { FixtureDatabaseSeed } from "../src/lib/qa/fixture-database";

export const FIXTURE_DATABASE_PATH = "data/fixtures/qa-database/fixture.v1.json";
export const FIXTURE_DATABASE_EXPECTED_PATH = "data/fixtures/qa-database/expected.v1.json";
export const REPRESENTATIVE_MIGRATION_PATH =
  "drizzle/authoritative/0034_superb_the_fallen.sql";

export type FixtureDatabaseExpected = {
  schemaVersion: "civica-qa-database-expected/v1";
  fixtureSha256: string;
  rowCounts: Record<string, number>;
  migration: {
    path: string;
    requiredRelations: string[];
  };
  credentialsUsed: [];
  networkRequests: 0;
  tolerance: "exact fixture bytes and relational row counts";
};

export function fixtureBytes() {
  return readFileSync(FIXTURE_DATABASE_PATH);
}

export function fixtureDatabaseSeed(): FixtureDatabaseSeed {
  return JSON.parse(fixtureBytes().toString("utf8")) as FixtureDatabaseSeed;
}

export function fixtureDatabaseSha256() {
  return createHash("sha256").update(fixtureBytes()).digest("hex");
}

export function fixtureDatabaseExpected(): FixtureDatabaseExpected {
  return JSON.parse(
    readFileSync(FIXTURE_DATABASE_EXPECTED_PATH, "utf8"),
  ) as FixtureDatabaseExpected;
}

export function representativeMigrationSql() {
  return readFileSync(REPRESENTATIVE_MIGRATION_PATH, "utf8").replaceAll(
    "--> statement-breakpoint",
    "",
  );
}
