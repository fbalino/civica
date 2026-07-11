import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import {
  classifyClusters,
  type ClassifyOneResult,
  type ClusterToClassify,
} from "./classify";
import { createPulsePipelineRunRef } from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

const cluster: ClusterToClassify = {
  clusterId: "11111111-1111-4111-8111-111111111111",
  jurisdictionId: "jurisdiction-1",
  eventDate: "2026-07-10",
  title: "Court removes election commissioner",
  body: "Fixture context",
  rawEventIds: ["raw-1"],
  sourceIds: ["gdelt"],
  sourceTypes: ["news"],
  clusterRunIds: ["22222222-2222-4222-8222-222222222222"],
  attributions: [
    {
      sourceId: "gdelt",
      sourceType: "news",
      sourceName: "GDELT",
      sourceUrl: "https://example.test/raw-1",
      rawEventId: "raw-1",
    },
  ],
};

const result: ClassifyOneResult = {
  classified: {
    jurisdictionId: "jurisdiction-1",
    eventDate: "2026-07-10",
    category: "judicial_purge",
    dimension: "rule_of_law",
    severityTier: "moderate_neg",
    severityValue: -4,
    classifierRuns: [],
    classifierAgreement: "all",
    headline: "Court removes election commissioner",
    description: "Fixture classification",
  },
  autoPublished: true,
};

const classify = async () => structuredClone(result);
const resolveSubject = async () => null;
const runRef = createPulsePipelineRunRef("classify", {
  id: "33333333-3333-4333-8333-333333333333",
  sourceIds: ["gdelt"],
  upstreamRunIds: cluster.clusterRunIds,
});

test("classification dry-run is stable and performs no writes", async () => {
  let writes = 0;
  const write = async () => {
    writes++;
  };
  const options = {
    clusters: [cluster],
    classify,
    resolveSubject,
    write,
    dryRun: true,
    runRef,
  };
  const first = await classifyClusters({} as Db, options);
  const second = await classifyClusters({} as Db, options);
  assert.deepEqual(first, second);
  assert.equal(first.planned.length, 1);
  assert.equal(writes, 0);
});

test("two classification fixture applications converge on one cluster record", async () => {
  const state = new Map<string, ClassifyOneResult>();
  const write = async (_db: Db, input: ClusterToClassify, classified: ClassifyOneResult) => {
    state.set(input.clusterId, structuredClone(classified));
  };
  const options = { clusters: [cluster], classify, resolveSubject, write, runRef };
  await classifyClusters({} as Db, options);
  const first = structuredClone([...state.entries()]);
  await classifyClusters({} as Db, options);
  assert.deepEqual([...state.entries()], first);
  assert.equal(state.size, 1);
});

test("malformed classification fixtures fail before classification or writes", async () => {
  let calls = 0;
  await assert.rejects(
    classifyClusters({} as Db, {
      clusters: [{ ...cluster, attributions: [] }],
      classify: async () => {
        calls++;
        return result;
      },
      resolveSubject,
      runRef,
    }),
    /attribution is incomplete/,
  );
  assert.equal(calls, 0);
});

test("strict mode surfaces classifier failures", async () => {
  await assert.rejects(
    classifyClusters({} as Db, {
      clusters: [cluster],
      classify: async () => {
        throw new Error("malformed model response");
      },
      resolveSubject,
      failOnError: true,
      runRef,
    }),
    /malformed model response/,
  );
});
