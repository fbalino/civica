import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import {
  corroborateEvents,
  type CorroborationPlan,
  type EventRow,
  type SourceCounts,
} from "./corroborate";
import { createPulsePipelineRunRef } from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

const event: EventRow = {
  id: "event-1",
  jurisdictionId: "jurisdiction-1",
  iso3: null,
  severityTier: "moderate_neg",
  classifierAgreement: "all",
  category: "judicial_purge",
  pressPinned: null,
  classificationRunId: "33333333-3333-4333-8333-333333333333",
};

const sourceCounts = new Map<string, SourceCounts>([[
  event.id,
  { specialist: new Set(["specialist-1"]), news: new Set(["news-1"]) },
]]);
const runRef = createPulsePipelineRunRef("corroborate", {
  id: "55555555-5555-4555-8555-555555555555",
  sourceIds: ["specialist-1", "news-1"],
  upstreamRunIds: [event.classificationRunId],
});

test("corroboration dry-run is stable and performs zero writes", async () => {
  let writes = 0;
  const options = {
    events: [event],
    sourceCounts,
    dryRun: true,
    write: async () => { writes++; },
    runRef,
  };
  const first = await corroborateEvents({} as Db, options);
  const second = await corroborateEvents({} as Db, options);
  assert.deepEqual(first, second);
  assert.equal(first.planned.length, 1);
  assert.equal(first.updated, 0);
  assert.equal(writes, 0);
});

test("two corroboration applications converge on one canonical event", async () => {
  const state = new Map<string, CorroborationPlan>();
  const write = async (_db: Db, plan: CorroborationPlan) => {
    state.set(plan.eventId, structuredClone(plan));
  };
  const options = { events: [event], sourceCounts, write, runRef };
  await corroborateEvents({} as Db, options);
  const first = structuredClone([...state.entries()]);
  await corroborateEvents({} as Db, options);
  assert.deepEqual([...state.entries()], first);
  assert.equal(state.size, 1);
});

test("malformed corroboration fixtures fail before writes", async () => {
  let writes = 0;
  await assert.rejects(
    corroborateEvents({} as Db, {
      events: [event, event],
      sourceCounts,
      write: async () => { writes++; },
      runRef,
    }),
    /duplicate corroboration event id/,
  );
  assert.equal(writes, 0);
});

test("empty corroboration input is an explicit no-op", async () => {
  const result = await corroborateEvents({} as Db, {
    events: [],
    sourceCounts: new Map(),
    dryRun: true,
    runRef,
  });
  assert.equal(result.examined, 0);
  assert.deepEqual(result.planned, []);
});
