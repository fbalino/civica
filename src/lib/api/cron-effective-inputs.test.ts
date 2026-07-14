import assert from "node:assert/strict";
import test from "node:test";

import { resolveCiaCabinetShard } from "@/app/api/cron/factbook/sync-cia-cabinets/route";
import { resolveSnapshotVintageIdentity } from "@/app/api/cron/factbook/snapshot-vintage/route";

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
