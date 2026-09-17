import assert from "node:assert/strict";
import test from "node:test";

import { billsCronResponse } from "./cron-response";
import { BillSourceAggregateError } from "./sync";

test("bill cron responses expose only safe transient source codes", async () => {
  const response = await billsCronResponse("bills.fr", async () => {
    throw new BillSourceAggregateError("france", [
      {
        sourceId: "data_assemblee_fr",
        status: "failed",
        fetched: 0,
        mapped: 0,
        code: "upstream_unavailable",
        error: "private upstream detail must not escape",
      },
    ]);
  });
  assert.equal(response.status, 503);
  const body = (await response.json()) as Record<string, unknown>;
  assert.match(String(body.started), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(body.finished), /^\d{4}-\d{2}-\d{2}T/);
  delete body.started;
  delete body.finished;
  assert.deepEqual(body, {
    ok: false,
    step: "bills.fr",
    outcome: "upstream_unavailable",
    sourceFailures: [
      { sourceId: "data_assemblee_fr", code: "upstream_unavailable" },
    ],
  });
});

test("bill cron responses keep deterministic source failures non-retryable", async () => {
  const response = await billsCronResponse("bills.de", async () => {
    throw new BillSourceAggregateError("germany", [
      {
        sourceId: "bundestag_dip",
        status: "failed",
        fetched: 0,
        mapped: 0,
        code: "source_configuration_missing",
        error: "configuration detail",
      },
    ]);
  });
  assert.equal(response.status, 502);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.outcome, "source_sync_failed");
  assert.deepEqual(body.sourceFailures, [
    {
      sourceId: "bundestag_dip",
      code: "source_configuration_missing",
    },
  ]);
  assert.equal(JSON.stringify(body).includes("configuration detail"), false);
});

test("bill cron responses leave unknown exceptions to the shared boundary", async () => {
  await assert.rejects(
    billsCronResponse("bills.ca", async () => {
      throw new Error("unknown failure");
    }),
    /unknown failure/,
  );
});
