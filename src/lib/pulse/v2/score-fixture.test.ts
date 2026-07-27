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
import { EVENT_CATEGORIES, SCORE_WINDOW_DAYS } from "./taxonomy";

type Db = NeonHttpDatabase<typeof schema>;

const event: PublishedEvent = {
  id: "event-1",
  jurisdictionId: "jurisdiction-1",
  dimension: "rule_of_law",
  category: "judicial_purge",
  projectionStatus: "current",
  published: true,
  reviewStatus: "approved",
  severityTier: "moderate_neg",
  severityValue: -4,
  corroborationConfidence: 0.8,
  eventDate: "2026-07-01",
  derivationVersions: legacyDerivationVersionEnvelope("fixture event"),
  sourceIds: ["source-1"],
  publicationRunId: "33333333-3333-4333-8333-333333333333",
  corroborationRunId: "55555555-5555-4555-8555-555555555555",
  absorptionDecisionKey: null,
  absorptionOutcome: null,
};
const runRef = createPulsePipelineRunRef("score", {
  id: "44444444-4444-4444-8444-444444444444",
  sourceIds: event.sourceIds,
  upstreamRunIds: [event.publicationRunId, event.corroborationRunId],
});

const now = new Date("2026-07-10T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function dateDaysBefore(days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

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

test("an event one day beyond the configured window clears prior country state without publishing a signal", async () => {
  const staleEvent: PublishedEvent = {
    ...event,
    eventDate: dateDaysBefore(SCORE_WINDOW_DAYS + 1),
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
    assert.equal(row.windowStart, dateDaysBefore(SCORE_WINDOW_DAYS));
    assert.equal(row.windowDays, SCORE_WINDOW_DAYS);
    assert.equal(row.derivationVersions.algorithm.state, "versioned");
    assert.equal(row.derivationVersions.sourceBasket.state, "not_applicable");
  }
});

test("the maximum configured half-life boundary is included and future events are excluded", async () => {
  const boundaryEvent: PublishedEvent = {
    ...event,
    id: "event-boundary",
    eventDate: dateDaysBefore(SCORE_WINDOW_DAYS),
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

test("every declared category remains scoreable through its own half-life", async () => {
  assert.equal(
    SCORE_WINDOW_DAYS,
    Math.max(...EVENT_CATEGORIES.map(({ halfLifeDays }) => halfLifeDays)),
  );
  assert.ok(
    EVENT_CATEGORIES.every(
      ({ halfLifeDays }) => halfLifeDays > 0 && halfLifeDays <= SCORE_WINDOW_DAYS,
    ),
  );

  const events: PublishedEvent[] = EVENT_CATEGORIES.map((category) => {
    const tier = category.allowedTiers[0];
    return {
      ...event,
      id: `half-life-${category.id}`,
      dimension: category.dimension,
      category: category.id,
      severityTier: tier,
      severityValue: tier.endsWith("_pos") ? 2 : -2,
      eventDate: dateDaysBefore(category.halfLifeDays),
    };
  });
  const result = await calculateDimensionalDeltas({} as Db, {
    events,
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    runRef,
  });

  assert.equal(result.eventsConsidered, EVENT_CATEGORIES.length);
  const contributors = result.planned.flatMap(
    ({ contributingEventIds }) => contributingEventIds,
  );
  assert.deepEqual(
    contributors.toSorted(),
    events.map(({ id }) => id).toSorted(),
  );
});

test("score plans clamp deterministic totals to both declared bounds", async () => {
  const result = await calculateDimensionalDeltas({} as Db, {
    events: [
      {
        ...event,
        id: "lower-one",
        severityTier: "catastrophic_neg",
        severityValue: -10,
      },
      {
        ...event,
        id: "lower-two",
        severityTier: "catastrophic_neg",
        severityValue: -10,
      },
      {
        ...event,
        id: "upper-one",
        dimension: "democratic_quality",
        category: "fair_election",
        severityTier: "high_pos",
        severityValue: 6,
      },
      {
        ...event,
        id: "upper-two",
        dimension: "democratic_quality",
        category: "fair_election",
        severityTier: "high_pos",
        severityValue: 6,
      },
      {
        ...event,
        id: "upper-three",
        dimension: "democratic_quality",
        category: "fair_election",
        severityTier: "high_pos",
        severityValue: 6,
      },
    ],
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    runRef,
  });

  assert.equal(
    result.planned.find(({ dimension }) => dimension === "rule_of_law")
      ?.deltaValue,
    -15,
  );
  assert.equal(
    result.planned.find(({ dimension }) => dimension === "democratic_quality")
      ?.deltaValue,
    10,
  );
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

test("absorption evidence suppresses impact without mutating corroboration", async () => {
  const absorbed: PublishedEvent = {
    ...event,
    absorptionDecisionKey:
      "pulse-absorption/sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    absorptionOutcome: "absorbed",
  };
  const result = await calculateDimensionalDeltas({} as Db, {
    events: [absorbed],
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    runRef,
  });
  assert.equal(absorbed.corroborationConfidence, 0.8);
  assert.equal(result.absorbedEventsExcluded, 1);
  assert.ok(result.planned.every((row) => row.deltaValue === 0));
  assert.ok(
    result.planned.every((row) => row.contributingEventIds.length === 0),
  );
});
