import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichPersonPortraits,
  type PersonPortraitCandidate,
  type PersonPortraitPlan,
} from "../person-portraits";

const candidate: PersonPortraitCandidate = {
  personId: "person-1",
  personName: "Example Person",
  personQid: "Q1",
};

const plan: PersonPortraitPlan = {
  portraits: [
    {
      personId: "person-1",
      personName: "Example Person",
      personQid: "Q1",
      file: "Example.jpg",
      license: "CC-BY-4.0",
      credit: "Example",
    },
  ],
  birthdates: [],
  skippedPortraits: [],
  noImage: [],
  stats: {
    candidates: 1,
    portraitFound: 1,
    portraitFree: 1,
    portraitSkippedNonFree: 0,
    portraitNoImage: 0,
    dobFound: 0,
  },
};

function options(markCalls: number[]) {
  return {
    loadCandidates: async () => [candidate],
    computePlan: async () => plan,
    markSynced: (async () => {
      markCalls.push(1);
      return ["wikidata"];
    }) as never,
  };
}

test("a row write failure reports partial and cannot stamp Wikidata freshness", async () => {
  const markCalls: number[] = [];
  const db = {
    update: () => ({
      set: () => ({
        where: async () => {
          throw new Error("seeded row failure");
        },
      }),
    }),
  };

  const summary = await enrichPersonPortraits({
    ...options(markCalls),
    db: db as never,
  });

  assert.equal(summary.status, "partial");
  assert.equal(summary.writeFailures, 1);
  assert.equal(summary.portraitsWritten, 0);
  assert.equal(summary.freshnessStamped, false);
  assert.deepEqual(markCalls, []);
});

test("a complete applied pass delegates one eligible freshness claim", async () => {
  const markCalls: number[] = [];
  const db = {
    update: () => ({
      set: () => ({ where: async () => ({ rowCount: 1 }) }),
    }),
  };

  const summary = await enrichPersonPortraits({
    ...options(markCalls),
    db: db as never,
  });

  assert.equal(summary.status, "completed");
  assert.equal(summary.writeFailures, 0);
  assert.equal(summary.portraitsWritten, 1);
  assert.equal(summary.freshnessStamped, true);
  assert.deepEqual(markCalls, [1]);
});
