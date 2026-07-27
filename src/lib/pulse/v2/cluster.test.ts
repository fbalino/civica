import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import { runClustering, type CandidateRow } from "./cluster";
import { createPulsePipelineRunRef } from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

const candidates: CandidateRow[] = [
  {
    id: "event-a",
    jurisdictionId: "country-1",
    eventDate: "2026-07-10",
    title: "Court removes election commissioner",
    body: "The national court removed the election commissioner",
    sourceId: "source-a",
    sourceFamilyId: "publisher-a",
    language: "en",
    ingestRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  },
  {
    id: "event-b",
    jurisdictionId: "country-1",
    eventDate: "2026-07-11",
    title: "Court removes election commissioner",
    body: "National court removed the election commissioner",
    sourceId: "source-b",
    sourceFamilyId: "publisher-b",
    language: "en",
    ingestRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
const runRef = createPulsePipelineRunRef("cluster", {
  id: "22222222-2222-4222-8222-222222222222",
  sourceIds: ["source-a", "source-b"],
  upstreamRunIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
});

test("cluster dry-run is deterministic and performs zero writes", async () => {
  const harness = fakeDb();
  const options = {
    candidates,
    embeddingResult: null,
    dryRun: true,
    now: new Date("2026-07-10T00:00:00Z"),
    runRef,
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
    runRef,
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
      runRef,
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
    runRef,
  });
  assert.equal(result.candidates, 0);
  assert.deepEqual(result.assignments, []);
  assert.equal(harness.writes(), 0);
});

test("exact multilingual canonical identity merges despite conflicting provisional countries", async () => {
  const fixture: CandidateRow[] = [
    {
      ...candidates[0],
      id: "oaxaca-en",
      jurisdictionId: "wrong-country-a",
      title: "Mexico court annuls Oaxaca election",
      body: null,
      sourceId: "wire-en",
      sourceFamilyId: "wire-family",
      language: "en",
    },
    {
      ...candidates[1],
      id: "oaxaca-es",
      jurisdictionId: "wrong-country-b",
      title: "Tribunal de México anula elección Oaxaca",
      body: null,
      sourceId: "daily-es",
      sourceFamilyId: "daily-family",
      language: "es",
    },
  ];
  const result = await runClustering(fakeDb().db, {
    candidates: fixture,
    embeddingResult: null,
    dryRun: true,
    runRef,
  });
  assert.equal(result.clustersCreated, 1);
  assert.equal(result.collisionCandidates, 0);
  assert.equal(result.multiSourceFamilyClusters, 1);
  assert.equal(result.multilingualClusters, 1);
  assert.equal(result.crossJurisdictionClusters, 1);
  assert.deepEqual(result.assignments[0].memberIds, ["oaxaca-en", "oaxaca-es"]);
});

test("normalized identity keeps similar same-day events with conflicting anchors separate", async () => {
  const fixture: CandidateRow[] = [
    {
      ...candidates[0],
      id: "oaxaca",
      title: "Mexico court annuls Oaxaca election",
      body: null,
    },
    {
      ...candidates[1],
      id: "puebla",
      jurisdictionId: "country-1",
      title: "Mexico court annuls Puebla election",
      body: null,
    },
  ];
  const result = await runClustering(fakeDb().db, {
    candidates: fixture,
    embeddingResult: null,
    dryRun: true,
    runRef,
  });
  assert.equal(result.clustersCreated, 2);
  assert.deepEqual(
    result.assignments.map(({ memberIds }) => memberIds),
    [["oaxaca"], ["puebla"]],
  );
});

test("unresolved reports remain eligible for clustering", async () => {
  const fixture = candidates.map((candidate) => ({
    ...candidate,
    jurisdictionId: null,
  }));
  const result = await runClustering(fakeDb().db, {
    candidates: fixture,
    embeddingResult: null,
    dryRun: true,
    runRef,
  });
  assert.equal(result.clustersCreated, 1);
  assert.equal(result.crossJurisdictionClusters, 1);
});
