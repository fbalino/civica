import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { markExternalSourceSyncedAfterAggregateSuccess } from "../_sync-common";

const EXPECTED_EXTERNAL_SYNC_CORES = [
  "sync-eurostat.ts",
  "sync-fao-faostat.ts",
  "sync-ibge-br.ts",
  "sync-ilo-ilostat.ts",
  "sync-imf-weo.ts",
  "sync-insee-fr.ts",
  "sync-oecd-stat.ts",
  "sync-ons-uk.ts",
  "sync-statcan-ca.ts",
  "sync-stats-sa.ts",
  "sync-un-data.ts",
  "sync-undp-hdi.ts",
  "sync-unesco-uis.ts",
  "sync-us-census.ts",
  "sync-wdi.ts",
  "sync-who-gho.ts",
  "sync-wto-stats.ts",
  "wikidata-sync.ts",
] as const;

const reconcileDirectory = path.join(
  process.cwd(),
  "src/lib/factbook/reconcile",
);

test("every external reconcile core gates freshness after dispute persistence", () => {
  const sourceByFile = new Map(
    readdirSync(reconcileDirectory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => [
        file,
        readFileSync(path.join(reconcileDirectory, file), "utf8"),
      ]),
  );
  const affectedFiles = [...sourceByFile]
    .filter(
      ([, source]) =>
        source.includes("persistProposedDisputes") &&
        source.includes("markSourcesSynced"),
    )
    .map(([file]) => file)
    .sort();

  assert.deepEqual(affectedFiles, [...EXPECTED_EXTERNAL_SYNC_CORES].sort());

  for (const file of affectedFiles) {
    const source = sourceByFile.get(file)!;
    const persistenceIndex = source.indexOf(
      "await (options.persistDisputes ?? persistProposedDisputes)",
    );
    const returnedErrorsIndex = source.indexOf(
      "disputes.errors",
      persistenceIndex,
    );
    const freshnessGateIndex = source.indexOf(
      "await markExternalSourceSyncedAfterAggregateSuccess",
    );

    assert.ok(
      persistenceIndex >= 0,
      `${file}: dispute persistence call missing`,
    );
    assert.ok(
      returnedErrorsIndex > persistenceIndex,
      `${file}: returned dispute errors are not aggregated`,
    );
    assert.ok(
      freshnessGateIndex > returnedErrorsIndex,
      `${file}: freshness gate must follow dispute persistence and error folding`,
    );
    assert.equal(
      source.match(/await markExternalSourceSyncedAfterAggregateSuccess/g)
        ?.length,
      1,
      `${file}: expected exactly one final freshness gate`,
    );
    assert.equal(
      source.includes("await (options.markSynced ?? markSourcesSynced)"),
      false,
      `${file}: direct freshness call bypasses the aggregate-success gate`,
    );
  }
});

test("aggregate errors skip the freshness callback entirely", async () => {
  let calls = 0;

  const stamped = await markExternalSourceSyncedAfterAggregateSuccess({
    sourceIds: "fixture_source",
    rowsWritten: 3,
    dryRun: false,
    executor: {} as never,
    errors: ["dispute persistence failed"],
    markSynced: (async () => {
      calls++;
      return ["fixture_source"];
    }) as never,
  });

  assert.deepEqual(stamped, []);
  assert.equal(calls, 0);
});

test("aggregate success forwards row and dry-run state exactly once", async () => {
  const executor = {} as never;
  const calls: Array<{
    sourceIds: unknown;
    rowsWritten: number;
    dryRun: boolean | undefined;
    executor: unknown;
  }> = [];

  const stamped = await markExternalSourceSyncedAfterAggregateSuccess({
    sourceIds: "fixture_source",
    rowsWritten: 7,
    dryRun: true,
    executor,
    errors: [],
    markSynced: (async (
      sourceIds: unknown,
      options: {
        rowsWritten: number;
        dryRun?: boolean;
        executor?: unknown;
      },
    ) => {
      calls.push({
        sourceIds,
        rowsWritten: options.rowsWritten,
        dryRun: options.dryRun,
        executor: options.executor,
      });
      return [];
    }) as never,
  });

  assert.deepEqual(stamped, []);
  assert.deepEqual(calls, [
    {
      sourceIds: "fixture_source",
      rowsWritten: 7,
      dryRun: true,
      executor,
    },
  ]);
});
