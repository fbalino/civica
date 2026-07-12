import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import { legacyDerivationVersionEnvelope } from "@/lib/research/derivation-version";
import {
  calculateDimensionalDeltas,
  type DimensionalDeltaPlan,
  type PublishedEvent,
} from "./score";
import { createPulsePipelineRunRef } from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

const event: PublishedEvent = {
  id: "event-1",
  jurisdictionId: "jurisdiction-1",
  dimension: "rule_of_law",
  category: "judicial_purge",
  severityTier: "moderate_neg",
  severityValue: -4,
  corroborationConfidence: 0.8,
  eventDate: "2026-07-01",
  derivationVersions: legacyDerivationVersionEnvelope("fixture event"),
  sourceIds: ["source-1"],
  publicationRunId: "33333333-3333-4333-8333-333333333333",
  corroborationRunId: "55555555-5555-4555-8555-555555555555",
};
const runRef = createPulsePipelineRunRef("score", {
  id: "44444444-4444-4444-8444-444444444444",
  sourceIds: event.sourceIds,
  upstreamRunIds: [event.publicationRunId, event.corroborationRunId],
});

const now = new Date("2026-07-10T00:00:00Z");

test("score dry-run is stable and performs zero writes", async () => {
  let writes = 0;
  const options = {
    events: [event],
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    write: async () => { writes++; },
    runRef,
  };
  const first = await calculateDimensionalDeltas({} as Db, options);
  const second = await calculateDimensionalDeltas({} as Db, options);
  assert.deepEqual(first, second);
  assert.equal(first.planned.length, 5);
  assert.equal(first.dimensionRowsWritten, 0);
  assert.equal(writes, 0);
});

test("two score applications converge on one row per country and dimension", async () => {
  const state = new Map<string, DimensionalDeltaPlan>();
  const write = async (_db: Db, plan: DimensionalDeltaPlan) => {
    state.set(`${plan.jurisdictionId}:${plan.dimension}`, structuredClone(plan));
  };
  const options = { events: [event], existingJurisdictionIds: [], now, write, runRef };
  await calculateDimensionalDeltas({} as Db, options);
  const first = structuredClone([...state.entries()]);
  await calculateDimensionalDeltas({} as Db, options);
  assert.deepEqual([...state.entries()], first);
  assert.equal(state.size, 5);
});

test("malformed score fixtures fail before writes", async () => {
  let writes = 0;
  await assert.rejects(
    calculateDimensionalDeltas({} as Db, {
      events: [event, event],
      existingJurisdictionIds: [],
      write: async () => { writes++; },
      runRef,
    }),
    /duplicate score event id/,
  );
  assert.equal(writes, 0);
});

test("empty score input without prior state is an explicit no-op", async () => {
  const result = await calculateDimensionalDeltas({} as Db, {
    events: [],
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    runRef,
  });
  assert.equal(result.eventsConsidered, 0);
  assert.deepEqual(result.planned, []);
});

test("a 366-day-old event clears prior country state without publishing a signal", async () => {
  const staleEvent: PublishedEvent = {
    ...event,
    eventDate: "2025-07-09",
  };
  const result = await calculateDimensionalDeltas({} as Db, {
    events: [staleEvent],
    existingJurisdictionIds: [event.jurisdictionId],
    dryRun: true,
    now,
    runRef,
  });

  assert.equal(result.eventsConsidered, 0);
  assert.equal(result.countriesScored, 1);
  assert.equal(result.significantDeltas, 0);
  assert.equal(result.planned.length, 5);
  for (const row of result.planned) {
    assert.equal(row.deltaValue, 0);
    assert.deepEqual(row.contributingEventIds, []);
    assert.equal(row.computationRunId, runRef.id);
    assert.equal(row.scoreAsOf, "2026-07-10");
    assert.equal(row.windowStart, "2025-07-10");
    assert.equal(row.windowDays, 365);
    assert.equal(row.derivationVersions.algorithm.state, "versioned");
    assert.equal(row.derivationVersions.sourceBasket.state, "not_applicable");
  }
});

test("the 365-day boundary is included and future events are excluded", async () => {
  const boundaryEvent: PublishedEvent = {
    ...event,
    id: "event-boundary",
    eventDate: "2025-07-10",
  };
  const futureEvent: PublishedEvent = {
    ...event,
    id: "event-future",
    eventDate: "2026-07-11",
  };
  const result = await calculateDimensionalDeltas({} as Db, {
    events: [boundaryEvent, futureEvent],
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    runRef,
  });

  assert.equal(result.eventsConsidered, 1);
  const ruleOfLaw = result.planned.find(
    (row) => row.dimension === "rule_of_law",
  );
  assert.deepEqual(ruleOfLaw?.contributingEventIds, [boundaryEvent.id]);
  assert.ok((ruleOfLaw?.deltaValue ?? 0) < 0);
});

test("current-event and prior-state jurisdictions form one deduplicated union", async () => {
  const result = await calculateDimensionalDeltas({} as Db, {
    events: [event],
    existingJurisdictionIds: ["jurisdiction-prior", "jurisdiction-prior"],
    dryRun: true,
    now,
    runRef,
  });

  assert.equal(result.countriesScored, 2);
  assert.equal(result.planned.length, 10);
  const priorRows = result.planned.filter(
    (row) => row.jurisdictionId === "jurisdiction-prior",
  );
  assert.equal(priorRows.length, 5);
  assert.ok(priorRows.every((row) => row.deltaValue === 0));
  assert.ok(priorRows.every((row) => row.contributingEventIds.length === 0));
});
