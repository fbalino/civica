import assert from "node:assert/strict";
import test from "node:test";

import {
  createFixtureDatabase,
  fixtureDatabaseCounts,
  fixtureDatabaseSeedErrors,
  fixtureSeedCounts,
} from "./fixture-database";
import {
  fixtureDatabaseExpected,
  fixtureDatabaseSeed,
  fixtureDatabaseSha256,
  representativeMigrationSql,
} from "../../../scripts/fixture-database-source";

test("the synthetic fixture is shareable, complete, and deterministic", async () => {
  const seed = fixtureDatabaseSeed();
  const expected = fixtureDatabaseExpected();
  assert.deepEqual(fixtureDatabaseSeedErrors(seed), []);
  assert.equal(fixtureDatabaseSha256(), expected.fixtureSha256);
  assert.deepEqual(fixtureSeedCounts(seed), expected.rowCounts);

  const first = await createFixtureDatabase(seed);
  const second = await createFixtureDatabase(seed);
  try {
    assert.deepEqual(await fixtureDatabaseCounts(first), expected.rowCounts);
    assert.deepEqual(await fixtureDatabaseCounts(second), expected.rowCounts);
    const states = await first.query<{ value_status: string }>(
      "SELECT value_status FROM fixture_facts ORDER BY value_status",
    );
    assert.deepEqual(
      states.rows.map(({ value_status }) => value_status),
      ["disputed", "missing", "not_observed", "observed", "observed"],
    );
    const stale = await first.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM fixture_sources WHERE last_sync_at < '2025-07-18T00:00:00.000Z'::timestamptz",
    );
    assert.equal(Number(stale.rows[0]!.count), 1);
  } finally {
    await first.close();
    await second.close();
  }
});

test("the fixture database applies a representative authoritative migration without credentials", async () => {
  const database = await createFixtureDatabase(fixtureDatabaseSeed());
  try {
    await database.exec(representativeMigrationSql());
    const expected = fixtureDatabaseExpected();
    const relations = await database.query<{ relation: string | null }>(
      `SELECT to_regclass('public.cron_job_attempts')::text AS relation
       UNION ALL SELECT to_regclass('public.cron_job_executions')::text
       UNION ALL SELECT to_regclass('public.cron_job_leases')::text
       ORDER BY relation`,
    );
    assert.deepEqual(
      relations.rows.map(({ relation }) => relation),
      [...expected.migration.requiredRelations].sort(),
    );
  } finally {
    await database.close();
  }
});

test("the fixture rejects a non-shareable or incomplete seed before database creation", () => {
  const seed = fixtureDatabaseSeed();
  const damaged = {
    ...seed,
    rights: { ...seed.rights, license: "restricted" },
    pulseClusters: [],
  } as unknown as typeof seed;
  const errors = fixtureDatabaseSeedErrors(damaged);
  assert.ok(errors.some((error) => error.includes("CC0 synthetic")));
  assert.ok(errors.includes("fixture lacks a Pulse cluster"));
});
