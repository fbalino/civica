import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import {
  runClustering,
  type CandidateRow,
} from "./cluster";

type Db = NeonHttpDatabase<typeof schema>;

const candidates: CandidateRow[] = [
  {
    id: "event-a",
    jurisdictionId: "country-1",
    eventDate: "2026-07-10",
    title: "Court removes election commissioner",
    body: "The national court removed the election commissioner",
    sourceId: "source-a",
  },
  {
    id: "event-b",
    jurisdictionId: "country-1",
    eventDate: "2026-07-11",
    title: "Court removes election commissioner",
    body: "National court removed the election commissioner",
    sourceId: "source-b",
  },
];

function fakeDb() {
  const state = new Map<string, { clusterId: string; clusteredAt: Date }>();
  let writes = 0;
  const db = {
    update: () => ({
      set: (value: { clusterId: string; clusteredAt: Date }) => ({
        where: async () => {
          const id = candidates[writes % candidates.length].id;
          state.set(id, value);
          writes++;
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state, writes: () => writes };
}

const fixedId = () => "11111111-1111-4111-8111-111111111111";

test("cluster dry-run is deterministic and performs zero writes", async () => {
  const harness = fakeDb();
  const options = {
    candidates,
    embeddingResult: null,
    dryRun: true,
    now: new Date("2026-07-10T00:00:00Z"),
  };
  const first = await runClustering(harness.db, options);
  const second = await runClustering(harness.db, options);
  assert.deepEqual(first, second);
  assert.equal(first.clustered, 2);
  assert.equal(first.clustersCreated, 1);
  assert.equal(first.multiSourceClusters, 1);
  assert.equal(harness.writes(), 0);
});

test("two fixture applications produce identical canonical cluster state", async () => {
  const harness = fakeDb();
  const options = {
    candidates,
    embeddingResult: null,
    now: new Date("2026-07-10T00:00:00Z"),
    clusterIdFactory: fixedId,
  };
  await runClustering(harness.db, options);
  const firstState = structuredClone([...harness.state.entries()]);
  await runClustering(harness.db, options);
  assert.deepEqual([...harness.state.entries()], firstState);
  assert.equal(harness.state.size, 2);
});

test("malformed duplicate fixture rows fail before writes", async () => {
  const harness = fakeDb();
  await assert.rejects(
    runClustering(harness.db, {
      candidates: [candidates[0], { ...candidates[1], id: candidates[0].id }],
      embeddingResult: null,
    }),
    /duplicate candidate id/,
  );
  assert.equal(harness.writes(), 0);
});

test("an empty derived input is an explicit no-op", async () => {
  const harness = fakeDb();
  const result = await runClustering(harness.db, {
    candidates: [],
    embeddingResult: null,
    dryRun: true,
  });
  assert.equal(result.candidates, 0);
  assert.deepEqual(result.assignments, []);
  assert.equal(harness.writes(), 0);
});
