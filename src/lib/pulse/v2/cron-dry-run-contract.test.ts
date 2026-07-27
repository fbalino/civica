import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROUTE_ROOT = "src/app/api/cron/pulse/v2";

const contracts = [
  {
    route: "ingest",
    call: "ingestPulseV2(db, { dryRun, cronExecutionKey })",
  },
  {
    route: "cluster",
    call: "runClustering(db, {",
  },
  {
    route: "classify",
    call: "classifyClusters(db, {",
  },
  {
    route: "score",
    call: "corroborateEvents(db, {",
    secondCall: "calculateDimensionalDeltas(db, {",
  },
] as const;

test("every mutable Pulse v2 cron forwards its authenticated dry-run mode", () => {
  for (const contract of contracts) {
    const source = readFileSync(
      `${ROUTE_ROOT}/${contract.route}/route.ts`,
      "utf8",
    );
    assert.match(
      source,
      /new URL\(request\.url\)\.searchParams\.get\("dryRun"\) === "1"/,
      `${contract.route} must parse dryRun from the authenticated request`,
    );
    assert.ok(
      source.includes(contract.call),
      `${contract.route} must forward dryRun to ${contract.call}`,
    );
    if ("secondCall" in contract) {
      assert.ok(
        source.includes(contract.secondCall),
        `${contract.route} must forward dryRun to ${contract.secondCall}`,
      );
    }
  }
});

test("Pulse score forwards dry-run and the stable cron identity to both stages", () => {
  const source = readFileSync(`${ROUTE_ROOT}/score/route.ts`, "utf8");
  assert.match(
    source,
    /corroborateEvents\(db,\s*\{\s*dryRun,\s*cronExecutionKey,?\s*\}\)/,
  );
  assert.match(
    source,
    /calculateDimensionalDeltas\(db,\s*\{\s*dryRun,\s*cronExecutionKey,?\s*\}\)/,
  );
});

test("Pulse ingest forwards dry-run and its stable cron identity", () => {
  const source = readFileSync(`${ROUTE_ROOT}/ingest/route.ts`, "utf8");
  assert.match(
    source,
    /ingestPulseV2\(db,\s*\{\s*dryRun,\s*cronExecutionKey,?\s*\}\)/,
  );
});

test("Pulse cluster forwards dry-run and its stable cron identity", () => {
  const source = readFileSync(`${ROUTE_ROOT}/cluster/route.ts`, "utf8");
  assert.match(
    source,
    /runClustering\(db,\s*\{[\s\S]*?dryRun,[\s\S]*?cronExecutionKey,?[\s\S]*?\}\)/,
  );
});

test("Pulse classify forwards dry-run and its stable cron identity", () => {
  const source = readFileSync(`${ROUTE_ROOT}/classify/route.ts`, "utf8");
  assert.match(
    source,
    /classifyClusters\(db,\s*\{[\s\S]*?dryRun,[\s\S]*?cronExecutionKey,?[\s\S]*?\}\)/,
  );
});

test("Pulse review-SLA dry-run skips escalation writes but still reads health", () => {
  const source = readFileSync(`${ROUTE_ROOT}/review-sla/route.ts`, "utf8");
  assert.match(
    source,
    /const alertsRecorded = dryRun\s*\? 0\s*:\s*await recordDuePulseReviewEscalations\(now\)/,
  );
  assert.match(source, /await loadPulseReviewSlaReport\(now\)/);
});
