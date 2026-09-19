import assert from "node:assert/strict";
import test from "node:test";

import {
  createCiaCabinetHandler,
  resolveCiaCabinetShard,
} from "@/app/api/cron/factbook/sync-cia-cabinets/route";
import { resolveSnapshotVintageIdentity } from "@/app/api/cron/factbook/snapshot-vintage/route";
import type {
  CabinetSyncOptions,
  CiaCabinetSyncSummary,
} from "@/lib/factbook/cia-cabinets-sync";

function request(path: string, manual = true): Request {
  return new Request(`https://civicaatlas.org${path}`, {
    method: manual ? "POST" : "GET",
    headers: manual ? { "idempotency-key": "stable-clock-fixture" } : {},
  });
}

test("manual CIA retries require and retain one explicit shard across midnight", () => {
  const stable = request(
    "/api/cron/factbook/sync-cia-cabinets?shard=7",
  );
  assert.deepEqual(
    resolveCiaCabinetShard(stable, new Date("2026-07-14T23:59:59Z")),
    { ok: true, shardIndex: 7 },
  );
  assert.deepEqual(
    resolveCiaCabinetShard(stable, new Date("2026-07-15T00:00:01Z")),
    { ok: true, shardIndex: 7 },
  );
  assert.equal(
    resolveCiaCabinetShard(
      request("/api/cron/factbook/sync-cia-cabinets"),
    ).ok,
    false,
  );
});

function cabinetSummary(dryRun: boolean): CiaCabinetSyncSummary {
  return {
    startedAt: "2026-09-17T00:00:00.000Z",
    finishedAt: "2026-09-17T00:00:01.000Z",
    durationMs: 1_000,
    countriesCrawled: 1,
    countriesApplied: 1,
    countriesFetchFailed: 0,
    countriesSkipped: 0,
    skipped: [],
    countriesUnmatched: 0,
    officesWritten: 1,
    personsExisting: 1,
    personsQidCreated: 0,
    personsIdlessCreated: 0,
    termsWritten: 1,
    vacantOffices: 0,
    diplomaticSkipped: 0,
    statementsWritten: 1,
    totalRowsWritten: 3,
    freshnessStamped: !dryRun,
    dryRun,
  };
}

for (const [label, environment] of [
  ["missing", {}],
  ["invalid", { CIVICA_ATLAS_RELEASE_ID: "release with spaces" }],
] as const) {
  test(`CIA ${label} release configuration fails before domain I/O`, async () => {
    let databaseReads = 0;
    let syncCalls = 0;
    const handler = createCiaCabinetHandler({
      database: {} as never,
      environment,
      buildSlugList: async () => {
        databaseReads++;
        return ["canada"];
      },
      sync: async () => {
        syncCalls++;
        return cabinetSummary(true);
      },
    });

    await assert.rejects(
      handler(
        request(
          "/api/cron/factbook/sync-cia-cabinets?shard=0&dryRun=1",
          false,
        ),
      ),
      /named Atlas release/,
    );
    assert.equal(databaseReads, 0);
    assert.equal(syncCalls, 0);
  });
}

test("CIA route validates and propagates its named routine-refresh release", async () => {
  const received: CabinetSyncOptions[] = [];
  const handler = createCiaCabinetHandler({
    database: {} as never,
    environment: {
      CIVICA_ATLAS_RELEASE_ID: "atlas-routine-refresh-2026-09-17",
    },
    buildSlugList: async () => ["canada"],
    sync: async (options) => {
      received.push(options);
      return cabinetSummary(true);
    },
  });

  const response = await handler(
    request(
      "/api/cron/factbook/sync-cia-cabinets?shard=0&dryRun=1",
      false,
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(
    received[0]?.atlasReleaseId,
    "atlas-routine-refresh-2026-09-17",
  );
  assert.equal(received[0]?.dryRun, true);
});

test("CIA route retains closed failure diagnostics and partial-write counters", async () => {
  const failed = cabinetSummary(false);
  Object.assign(failed, {
    countriesApplied: 6,
    countriesSkipped: 1,
    skipped: [
      {
        slug: "papua-new-guinea",
        code: "office_identity_conflict",
        reason: "Office identity is ambiguous or unsafe",
      },
    ],
    officesWritten: 144,
    termsWritten: 142,
    statementsWritten: 142,
    totalRowsWritten: 428,
    freshnessStamped: false,
  });
  const handler = createCiaCabinetHandler({
    database: {} as never,
    environment: {
      CIVICA_ATLAS_RELEASE_ID: "atlas-routine-refresh-2026-09-17",
    },
    buildSlugList: async () => ["papua-new-guinea"],
    sync: async () => failed,
  });

  const response = await handler(
    request("/api/cron/factbook/sync-cia-cabinets?shard=0"),
  );
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.outcome, "cabinet_office_identity_conflict");
  assert.equal(payload.countriesApplied, 6);
  assert.equal(payload.countriesSkipped, 1);
  assert.equal(payload.officesWritten, 144);
  assert.equal(payload.termsWritten, 142);
  assert.equal(payload.statementsWritten, 142);
  assert.equal(payload.totalRowsWritten, 428);
  assert.equal(payload.freshnessStamped, false);
  assert.deepEqual(payload.failures, [
    {
      slug: "papua-new-guinea",
      code: "office_identity_conflict",
    },
  ]);
  assert.equal(JSON.stringify(payload).includes("Office identity"), false);
});

test("manual CIA delivery without a shard fails before schedule or domain I/O", async () => {
  let databaseReads = 0;
  let syncCalls = 0;
  const handler = createCiaCabinetHandler({
    database: {} as never,
    environment: {
      CIVICA_ATLAS_RELEASE_ID: "atlas-routine-refresh-2026-09-17",
    },
    buildSlugList: async () => {
      databaseReads++;
      return ["canada"];
    },
    sync: async () => {
      syncCalls++;
      return cabinetSummary(true);
    },
  });

  const response = await handler(
    request("/api/cron/factbook/sync-cia-cabinets?dryRun=1"),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    step: "factbook.cia-cabinets.sync",
    error: "Manual cabinet deliveries require an explicit shard (0-27)",
  });
  assert.equal(databaseReads, 0);
  assert.equal(syncCalls, 0);
});

test("manual vintage retries require and retain an explicit label and cut across quarters", () => {
  const label = encodeURIComponent(
    "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2",
  );
  const stable = request(
    `/api/cron/factbook/snapshot-vintage?vintageLabel=${label}&cutAt=2026-07-15T04%3A00%3A00.000Z`,
  );
  const before = resolveSnapshotVintageIdentity(
    stable,
    new Date("2026-09-30T23:59:59Z"),
  );
  const after = resolveSnapshotVintageIdentity(
    stable,
    new Date("2026-10-01T00:00:01Z"),
  );
  assert.equal(before.ok, true);
  assert.equal(after.ok, true);
  if (!before.ok || !after.ok) return;
  assert.equal(before.vintageLabel, after.vintageLabel);
  assert.equal(before.cutDate.toISOString(), "2026-07-15T04:00:00.000Z");
  assert.equal(after.cutDate.toISOString(), before.cutDate.toISOString());

  assert.equal(
    resolveSnapshotVintageIdentity(
      request(`/api/cron/factbook/snapshot-vintage?vintageLabel=${label}`),
    ).ok,
    false,
  );
});
