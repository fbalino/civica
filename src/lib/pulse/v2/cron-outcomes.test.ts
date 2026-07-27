import assert from "node:assert/strict";
import test from "node:test";
import {
  pulseV2ClassifyCronOutcome,
  pulseV2ClusterCronOutcome,
  pulseV2IngestCronOutcome,
  pulseV2ReviewSlaCronOutcome,
} from "./cron-outcomes";

function connector(source: string, error?: string) {
  return {
    source,
    fetched: 1,
    inserted: 1,
    skippedDuplicate: 0,
    unmatchedCountry: 0,
    wouldWrite: 1,
    ...(error === undefined ? {} : { error }),
  };
}

test("ingest reports any connector error as a partial non-2xx outcome", () => {
  assert.deepEqual(
    pulseV2IngestCronOutcome({
      reports: [connector("working"), connector("broken", "upstream down")],
    }),
    {
      ok: false,
      outcome: "partial",
      httpStatus: 502,
      failedConnectors: ["broken"],
    },
  );
  assert.deepEqual(pulseV2IngestCronOutcome({ reports: [connector("ok")] }), {
    ok: true,
    outcome: "completed",
    httpStatus: 200,
    failedConnectors: [],
  });
});

test("cluster treats lexical fallback as partial but accepts a completed no-op", () => {
  assert.deepEqual(pulseV2ClusterCronOutcome({ status: "partial" }), {
    ok: false,
    outcome: "partial",
    httpStatus: 503,
  });
  assert.deepEqual(pulseV2ClusterCronOutcome({ status: "completed" }), {
    ok: true,
    outcome: "completed",
    httpStatus: 200,
  });
});

test("classify fails closed for absent credentials and partial model results", () => {
  assert.deepEqual(
    pulseV2ClassifyCronOutcome({ missingProviders: ["anthropic"] }),
    {
      ok: false,
      outcome: "blocked",
      httpStatus: 503,
      reason: "provider_key_absent",
    },
  );
  assert.deepEqual(pulseV2ClassifyCronOutcome({ summary: { failed: 2 } }), {
    ok: false,
    outcome: "partial",
    httpStatus: 502,
    reason: "classification_failures",
  });
  assert.deepEqual(pulseV2ClassifyCronOutcome({ summary: { failed: 0 } }), {
    ok: true,
    outcome: "completed",
    httpStatus: 200,
  });
  assert.throws(
    () => pulseV2ClassifyCronOutcome({ missingProviders: [] }),
    /classification summary is required/i,
  );
});

test("review SLA findings report unhealthy monitoring state without failing execution", () => {
  const clean = pulseV2ReviewSlaCronOutcome({
    breachedUnexcepted: 0,
    breachedExcepted: 0,
    escalationDue: 0,
  });
  assert.deepEqual(clean, {
    ok: true,
    outcome: "completed",
    healthOk: true,
    httpStatus: 200,
  });

  for (const report of [
    { breachedUnexcepted: 1, breachedExcepted: 0, escalationDue: 0 },
    { breachedUnexcepted: 0, breachedExcepted: 1, escalationDue: 0 },
    { breachedUnexcepted: 0, breachedExcepted: 0, escalationDue: 1 },
  ]) {
    assert.deepEqual(pulseV2ReviewSlaCronOutcome(report), {
      ok: true,
      outcome: "completed_with_findings",
      healthOk: false,
      httpStatus: 200,
    });
  }
});
