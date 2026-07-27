import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import {
  corroborateEvents,
  sourceCountsFromEvidence,
  type CorroborationPlan,
  type EventRow,
  type SourceCounts,
} from "./corroborate";
import { createPulsePipelineRunRef } from "./pipeline-version";
import {
  RSF_2026_CANDIDATE_RELEASE,
  missingInformationEnvironmentContext,
  observedInformationEnvironmentContext,
} from "./press-freedom";

type Db = NeonHttpDatabase<typeof schema>;

const event: EventRow = {
  id: "event-1",
  clusterId: "11111111-1111-4111-8111-111111111111",
  jurisdictionId: "jurisdiction-1",
  iso3: null,
  severityTier: "moderate_neg",
  classifierAgreement: "all",
  category: "judicial_purge",
  classificationRunId: "33333333-3333-4333-8333-333333333333",
};

const sourceCounts = new Map<string, SourceCounts>([
  [
    event.id,
    { specialist: new Set(["specialist-1"]), news: new Set(["news-1"]) },
  ],
]);
const informationContexts = new Map([
  [event.id, missingInformationEnvironmentContext("fixture has no context")],
]);
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
    informationContexts,
    dryRun: true,
    write: async () => {
      writes++;
    },
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
  const options = {
    events: [event],
    sourceCounts,
    informationContexts,
    write,
    runRef,
  };
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
      informationContexts,
      write: async () => {
        writes++;
      },
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
    informationContexts: new Map(),
    dryRun: true,
    runRef,
  });
  assert.equal(result.examined, 0);
  assert.deepEqual(result.planned, []);
});

test("corroboration counts independent evidence groups instead of connector rows", () => {
  const counts = sourceCountsFromEvidence([
    {
      rawEventId: "raw-reuters",
      sourceId: "gdelt",
      sourceType: "news",
      sourceUrl: "https://reuters.com/story",
      sourceFamilyId: "gdelt",
      itemPublisherHost: "reuters.com",
      title: "Minister resigns",
      body: "Reuters reported the resignation",
    },
    {
      rawEventId: "raw-copy",
      sourceId: "gdelt",
      sourceType: "news",
      sourceUrl: "https://daily.test/reuters-copy",
      sourceFamilyId: "gdelt",
      itemPublisherHost: "daily.test",
      title: "Minister resigns",
      body: "Reporting by Reuters on the resignation",
    },
  ]);
  assert.equal(counts.reportCount, 2);
  assert.equal(counts.news.size, 1);
  assert.deepEqual([...counts.sourceIds!], ["gdelt"]);
});

test("information context changes only the declared sensitivity scenario", async () => {
  const positive = { ...event, severityTier: "moderate_pos" as const };
  const newsOnly = new Map<string, SourceCounts>([
    [positive.id, { specialist: new Set(), news: new Set(["news-1"]) }],
  ]);
  const context = observedInformationEnvironmentContext({
    score: 30,
    sourceId: RSF_2026_CANDIDATE_RELEASE.sourceId,
    sourceUrl: RSF_2026_CANDIDATE_RELEASE.sourceUrl,
    upstreamRelease: RSF_2026_CANDIDATE_RELEASE.upstreamRelease,
    observationYear: RSF_2026_CANDIDATE_RELEASE.observationYear,
    retrievedAt: RSF_2026_CANDIDATE_RELEASE.retrievedAt,
    contentSha256: RSF_2026_CANDIDATE_RELEASE.contentSha256,
    publisherRows: 180,
    matchedJurisdictions: 175,
    supportedJurisdictions: 195,
    rightsStatus: "pending",
    useStatus: "disabled_pending_rights_and_validation",
  });
  const informationContexts = new Map([[positive.id, context]]);
  const common = {
    events: [positive],
    sourceCounts: newsOnly,
    informationContexts,
    dryRun: true,
    runRef,
  };
  const production = await corroborateEvents({} as Db, common);
  const sensitivity = await corroborateEvents({} as Db, {
    ...common,
    informationContextMode: "sensitivity",
  });
  assert.ok(Math.abs((production.planned[0]?.confidence ?? 0) - 0.384) < 1e-12);
  assert.ok(
    Math.abs((sensitivity.planned[0]?.confidence ?? 0) - 0.0576) < 1e-12,
  );
  assert.equal(production.planned[0]?.informationEnvironmentContext.score, 30);
});
