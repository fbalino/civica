import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import {
  classifyClusters,
  classificationDecisionInputs,
  selectProvisionalJurisdiction,
  writeEvent,
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
  verification: null,
  subjectAttribution: null,
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
  const write = async (
    _db: Db,
    input: ClusterToClassify,
    classified: ClassifyOneResult,
  ) => {
    state.set(input.clusterId, structuredClone(classified));
  };
  const options = {
    clusters: [cluster],
    classify,
    resolveSubject,
    write,
    runRef,
  };
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

test("the production writer rejects one-run automatic publication before database access", async () => {
  const oneRun = structuredClone(result);
  oneRun.classified.classifierAgreement = "none";
  oneRun.classified.classifierRuns = [
    {
      run: 1,
      temp: 0,
      provider: "anthropic",
      model: "claude-fixture",
      role: "classify",
      promptVersion: "prompt-fixture",
      methodVersion: "pulse-v2.13-beta",
      configurationHash: "config-fixture",
      configuredEngineCount: 3,
      category: "judicial_purge",
      dimension: "rule_of_law",
      severityTier: "moderate_neg",
      severityValue: -4,
      selfConfidence: 0.9,
      rationale: "fixture",
      raw: JSON.stringify({ pass: "classify", runnerUp: "none" }),
    },
  ];
  await assert.rejects(
    writeEvent({} as Db, cluster, oneRun, runRef.id),
    /Automatic publication requires stored provider-distinct versioned votes/,
  );
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

test("provisional jurisdiction selection is deterministic and majority-based", () => {
  assert.equal(
    selectProvisionalJurisdiction(["country-b", "country-a", "country-b"]),
    "country-b",
  );
  assert.equal(
    selectProvisionalJurisdiction(["country-b", "country-a"]),
    "country-a",
  );
  assert.throws(
    () => selectProvisionalJurisdiction([]),
    /no provisional jurisdiction/,
  );
});

test("classification persists each judgment and verifier axis separately", () => {
  const verified: ClassifyOneResult = {
    ...structuredClone(result),
    verification: {
      verdict: "revised",
      confidence: "low",
      categoryOk: false,
      severityOk: true,
      subjectOk: false,
      isEvent: true,
      rationale: "category and subject need review",
    },
    subjectAttribution: {
      attributionVersion: "pulse-jurisdiction-attribution/v2",
      entityCatalogVersion: "pulse-jurisdiction-entities/v1",
      aliasVersion: "pulse-jurisdiction-aliases/v1",
      entityCatalogHash:
        "pulse-jurisdiction-entities/sha256:1111111111111111111111111111111111111111111111111111111111111111",
      promptContext: "Japan (JPN)",
      status: "single",
      primaryJurisdictionId: "jurisdiction-1",
      rationale: "The event concerns Japan's domestic institutions.",
      attributions: [
        {
          jurisdictionId: "jurisdiction-1",
          role: "primary",
          rationale: "The event concerns Japan's domestic institutions.",
          evidenceRefs: ["headline"],
          entity: {
            jurisdictionId: "jurisdiction-1",
            canonicalName: "Japan",
            iso2: "JP",
            iso3: "JPN",
            slug: "japan",
            aliases: [],
          },
        },
      ],
      verdict: {
        scope: "single",
        primaryIso3: "JPN",
        attributions: [
          {
            iso3: "JPN",
            role: "primary",
            rationale: "The event concerns Japan's domestic institutions.",
            evidenceRefs: ["headline"],
          },
        ],
        reasoning: "The event concerns Japan's domestic institutions.",
      },
    },
  };
  const decisions = classificationDecisionInputs({
    cluster,
    eventId: "44444444-4444-4444-8444-444444444444",
    result: verified,
    runId: runRef.id,
    decidedAt: "2026-07-11T20:00:00.000Z",
  });
  assert.deepEqual(
    decisions
      .filter(({ actor }) => actor.type !== "verifier")
      .map(({ kind }) => kind),
    [
      "event_existence",
      "category_labels",
      "severity",
      "calibration",
      "subject_attribution",
      "publication",
    ],
  );
  assert.deepEqual(
    Object.fromEntries(
      decisions
        .filter(({ actor }) => actor.type === "verifier")
        .map(({ kind, verdict }) => [kind, verdict]),
    ),
    {
      event_existence: "affirmed",
      subject_attribution: "refuted",
      category_labels: "refuted",
      severity: "affirmed",
    },
  );
  assert.equal(
    decisions.some((decision) => "confidence" in decision.payload),
    false,
  );
});
