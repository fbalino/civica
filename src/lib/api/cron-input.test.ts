import assert from "node:assert/strict";
import { test } from "node:test";

import { validateCronInput } from "./cron-input";

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://civicaatlas.org${path}`, init);
}

test("default cron inputs admit only one exact dry-run flag", () => {
  assert.deepEqual(
    validateCronInput(
      "pulse.v2.ingest",
      request("/api/cron/pulse/v2/ingest?dryRun=1"),
    ),
    { ok: true },
  );
  assert.deepEqual(
    validateCronInput(
      "pulse.v2.ingest",
      request("/api/cron/pulse/v2/ingest?dryRun=0"),
    ),
    { ok: false, problem: "invalid_query_parameter" },
  );
  assert.deepEqual(
    validateCronInput(
      "pulse.v2.ingest",
      request("/api/cron/pulse/v2/ingest?country=URY"),
    ),
    { ok: false, problem: "unknown_query_parameter" },
  );
  assert.deepEqual(
    validateCronInput(
      "pulse.v2.ingest",
      request("/api/cron/pulse/v2/ingest?dryRun=1&dryRun=1"),
    ),
    { ok: false, problem: "duplicate_query_parameter" },
  );
});

test("special cron schemas enforce bounds and paired identity fields", () => {
  assert.deepEqual(
    validateCronInput(
      "factbook.auto-resolve",
      request("/api/cron/factbook/auto-resolve-disputes?limit=1000"),
    ),
    { ok: true },
  );
  assert.deepEqual(
    validateCronInput(
      "factbook.auto-resolve",
      request("/api/cron/factbook/auto-resolve-disputes?limit=1001"),
    ),
    { ok: false, problem: "invalid_query_parameter" },
  );
  assert.deepEqual(
    validateCronInput(
      "factbook.cia-cabinets",
      request("/api/cron/factbook/sync-cia-cabinets?shard=27"),
    ),
    { ok: true },
  );
  assert.deepEqual(
    validateCronInput(
      "factbook.cia-cabinets",
      request("/api/cron/factbook/sync-cia-cabinets?shard=28"),
    ),
    { ok: false, problem: "invalid_query_parameter" },
  );

  const label = encodeURIComponent(
    "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q3",
  );
  const cutAt = encodeURIComponent("2026-07-01T00:00:00.000Z");
  assert.deepEqual(
    validateCronInput(
      "factbook.snapshot-vintage",
      request(
        `/api/cron/factbook/snapshot-vintage?vintageLabel=${label}&cutAt=${cutAt}`,
      ),
    ),
    { ok: true },
  );
  assert.deepEqual(
    validateCronInput(
      "factbook.snapshot-vintage",
      request(`/api/cron/factbook/snapshot-vintage?vintageLabel=${label}`),
    ),
    { ok: false, problem: "invalid_query_parameter" },
  );
});

test("verification metric selection is a closed enum", () => {
  assert.deepEqual(
    validateCronInput(
      "factbook.verify-reconciliation",
      request(
        "/api/cron/factbook/verify-reconciliation?metric=active_sources&verbose=1",
      ),
    ),
    { ok: true },
  );
  assert.deepEqual(
    validateCronInput(
      "factbook.verify-reconciliation",
      request("/api/cron/factbook/verify-reconciliation?metric=not_a_metric"),
    ),
    { ok: false, problem: "invalid_query_parameter" },
  );
});

test("cron bodies and retired-route inputs are rejected", () => {
  assert.deepEqual(
    validateCronInput(
      "pulse.v2.ingest",
      request("/api/cron/pulse/v2/ingest", {
        method: "POST",
        body: "{}",
      }),
    ),
    { ok: false, problem: "body_not_allowed" },
  );
  assert.deepEqual(
    validateCronInput(
      "pulse.v1.ingest",
      request("/api/cron/pulse/ingest?dryRun=1"),
    ),
    { ok: false, problem: "unknown_query_parameter" },
  );
});
