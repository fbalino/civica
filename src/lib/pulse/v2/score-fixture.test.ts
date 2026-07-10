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
};

const now = new Date("2026-07-10T00:00:00Z");

test("score dry-run is stable and performs zero writes", async () => {
  let writes = 0;
  const options = {
    events: [event],
    existingJurisdictionIds: [],
    dryRun: true,
    now,
    write: async () => { writes++; },
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
  const options = { events: [event], existingJurisdictionIds: [], now, write };
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
  });
  assert.equal(result.eventsConsidered, 0);
  assert.deepEqual(result.planned, []);
});
