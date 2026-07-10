import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import type { BillIngestDraft } from "./types";
import { runBillsSync } from "./sync";

type Db = NeonHttpDatabase<typeof schema>;

const draft: BillIngestDraft = {
  jurisdictionId: "11111111-1111-4111-8111-111111111111",
  bodyId: null,
  sourceId: "congress_gov",
  externalId: "119-hr-1",
  title: "H.R. 1",
  longTitle: "Fixture bill",
  stage: 1,
  rawStatus: "In committee",
  introducedDate: "2026-07-01",
  lastActionDate: "2026-07-10",
  lastActionText: null,
  sponsorName: null,
  sponsorParty: null,
  url: "https://example.test/bill/1",
  textUrl: null,
  voteYes: null,
  voteNo: null,
  voteAbstain: null,
  raw: { id: 1 },
};

test("the shared six-country bills runner keeps dry-run cache and table writes at zero", async () => {
  let cacheWrites = 0;
  let tableDryRun = false;
  const options = {
    jurisdictionSlug: "united-states",
    jurisdictionId: draft.jurisdictionId,
    iso2: "US",
    dryRun: true,
    fetchDrafts: async () => [draft],
    readSummaries: async () => [null],
    generateSummaries: async () => ["Generated fixture summary."],
    cacheSummary: async () => { cacheWrites++; },
    writeRows: async (_db: Db, rows: unknown[], writeOptions?: { dryRun?: boolean }) => {
      tableDryRun = writeOptions?.dryRun === true;
      return { inserted: 0, updated: 0, unchanged: 0, wouldWrite: rows.length, dryRun: true, sourcesStamped: [] };
    },
  };
  const first = await runBillsSync({} as Db, options);
  const second = await runBillsSync({} as Db, options);
  assert.deepEqual(first, second);
  assert.equal(first.wouldWrite, 1);
  assert.equal(first.summarised, 1);
  assert.equal(tableDryRun, true);
  assert.equal(cacheWrites, 0);
});

test("the shared bills runner fails loudly on an empty upstream before writes", async () => {
  let writes = 0;
  await assert.rejects(runBillsSync({} as Db, {
    jurisdictionSlug: "united-states",
    jurisdictionId: draft.jurisdictionId,
    iso2: "US",
    dryRun: true,
    fetchDrafts: async () => [],
    readSummaries: async () => [],
    writeRows: async () => {
      writes++;
      return { inserted: 0, updated: 0, unchanged: 0, wouldWrite: 0, dryRun: true, sourcesStamped: [] };
    },
  }), /upstream returned no rows/);
  assert.equal(writes, 0);
});
