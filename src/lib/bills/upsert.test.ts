import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import type { BillIngest } from "./types";
import { upsertBills } from "./upsert";

type Db = NeonHttpDatabase<typeof schema>;

const bill: BillIngest = {
  jurisdictionId: "11111111-1111-4111-8111-111111111111",
  bodyId: null,
  sourceId: "congress_gov",
  externalId: "119-hr-1",
  title: "H.R. 1",
  longTitle: "Fixture bill",
  summary: "A fixture summary.",
  stage: 1,
  rawStatus: "In committee",
  introducedDate: "2026-07-01",
  lastActionDate: "2026-07-10",
  lastActionText: "Referred to committee",
  sponsorName: null,
  sponsorParty: null,
  url: "https://example.test/bill/1",
  textUrl: null,
  voteYes: null,
  voteNo: null,
  voteAbstain: null,
  raw: { id: 1, nested: { stable: true } },
};

function fakeDb() {
  let stored: Record<string, unknown> | null = null;
  let writes = 0;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => stored ? [stored] : [] }),
      }),
    }),
    insert: () => ({
      values: async (value: Record<string, unknown>) => {
        stored = { id: "bill-1", createdAt: new Date(0), updatedAt: new Date(0), ...structuredClone(value) };
        writes++;
      },
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: async () => {
          stored = { ...stored, ...structuredClone(value) };
          writes++;
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state: () => structuredClone(stored), writes: () => writes };
}

test("two bill applications converge without an update or freshness restamp", async () => {
  const harness = fakeDb();
  const stamps: number[] = [];
  const stampSources = async (_ids: string | string[], options: { rowsWritten: number }) => {
    stamps.push(options.rowsWritten);
    return options.rowsWritten > 0 ? [bill.sourceId] : [];
  };
  const options = { stampSources: stampSources as never, now: new Date("2026-07-10T00:00:00Z") };
  const first = await upsertBills(harness.db, [bill], options);
  const firstState = harness.state();
  const second = await upsertBills(harness.db, [bill], options);
  assert.equal(first.inserted, 1);
  assert.equal(second.unchanged, 1);
  assert.equal(second.updated, 0);
  assert.deepEqual(harness.state(), firstState);
  assert.equal(harness.writes(), 1);
  assert.deepEqual(stamps, [1, 0]);
});

test("bill dry-run reports the proposed rows with zero writes or freshness", async () => {
  const harness = fakeDb();
  let stamps = 0;
  const result = await upsertBills(harness.db, [bill], {
    dryRun: true,
    stampSources: (async () => { stamps++; return []; }) as never,
  });
  assert.equal(result.wouldWrite, 1);
  assert.equal(result.inserted, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(stamps, 0);
});

test("malformed and duplicate bill fixtures fail before any write", async () => {
  const harness = fakeDb();
  await assert.rejects(upsertBills(harness.db, [{ ...bill, lastActionDate: "July 10" }]), /lastActionDate/);
  await assert.rejects(upsertBills(harness.db, [bill, bill]), /Duplicate bill input key/);
  assert.equal(harness.writes(), 0);
});

test("an empty bills input is a no-op", async () => {
  const harness = fakeDb();
  const result = await upsertBills(harness.db, []);
  assert.equal(result.wouldWrite, 0);
  assert.equal(harness.writes(), 0);
});
