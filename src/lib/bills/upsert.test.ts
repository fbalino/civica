import assert from "node:assert/strict";
import test from "node:test";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { bills } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { BillIngest } from "./types";
import {
  upsertBills,
  type AtomicBillWriter,
  type PlannedBillWrite,
} from "./upsert";

type Db = NeonHttpDatabase<typeof schema>;
type StoredBill = typeof bills.$inferSelect;

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

function keyOf(row: Pick<BillIngest, "sourceId" | "externalId">): string {
  return `${row.sourceId}::${row.externalId}`;
}

function atomicHarness() {
  let stored = new Map<string, StoredBill>();
  let committedWrites = 0;
  let atomicCalls = 0;
  const freshnessCommits: string[][] = [];
  let nextFailure: "mid-write" | "final-freshness" | null = null;

  const readExisting = async (_db: unknown, row: BillIngest) =>
    structuredClone(stored.get(keyOf(row)) ?? null);

  const atomicWrite: AtomicBillWriter = async (_db, writes, committedAt) => {
    atomicCalls++;
    const staged = new Map(
      [...stored].map(([key, value]) => [key, structuredClone(value)]),
    );
    let inserted = 0;
    let updated = 0;

    for (const [index, planned] of writes.entries()) {
      applyPlannedWrite(staged, planned, committedAt);
      if (planned.operation === "insert") inserted++;
      else updated++;
      if (nextFailure === "mid-write" && index === 0) {
        nextFailure = null;
        throw new Error("injected bill write failure");
      }
    }

    const sourcesStamped = Array.from(
      new Set(writes.map(({ row }) => row.sourceId)),
    ).sort();
    if (nextFailure === "final-freshness") {
      nextFailure = null;
      throw new Error("injected source freshness failure");
    }

    stored = staged;
    committedWrites += writes.length;
    freshnessCommits.push(sourcesStamped);
    return { inserted, updated, sourcesStamped };
  };

  return {
    db: {} as Db,
    options: {
      readExisting: readExisting as never,
      atomicWrite,
      now: new Date("2026-07-10T00:00:00Z"),
    },
    failNext: (failure: "mid-write" | "final-freshness") => {
      nextFailure = failure;
    },
    state: () => structuredClone([...stored.values()]),
    committedWrites: () => committedWrites,
    atomicCalls: () => atomicCalls,
    freshnessCommits: () => structuredClone(freshnessCommits),
  };
}

function applyPlannedWrite(
  staged: Map<string, StoredBill>,
  planned: PlannedBillWrite,
  committedAt: Date,
): void {
  const key = keyOf(planned.row);
  const existing = staged.get(key);
  if (planned.operation === "update" && !existing) {
    throw new Error("planned update target disappeared");
  }
  if (planned.operation === "insert" && existing) {
    throw new Error("concurrent uniqueness failure");
  }
  staged.set(key, {
    id:
      planned.existingId ??
      `00000000-0000-4000-8000-${String(staged.size + 1).padStart(12, "0")}`,
    ...structuredClone(planned.row),
    createdAt: existing?.createdAt ?? committedAt,
    updatedAt: committedAt,
  } as StoredBill);
}

test("two bill applications converge without an update or freshness restamp", async () => {
  const harness = atomicHarness();
  const first = await upsertBills(harness.db, [bill], harness.options);
  const firstState = harness.state();
  const second = await upsertBills(harness.db, [bill], harness.options);

  assert.equal(first.inserted, 1);
  assert.deepEqual(first.sourcesStamped, [bill.sourceId]);
  assert.equal(second.unchanged, 1);
  assert.equal(second.updated, 0);
  assert.deepEqual(second.sourcesStamped, []);
  assert.deepEqual(harness.state(), firstState);
  assert.equal(harness.committedWrites(), 1);
  assert.equal(harness.atomicCalls(), 1);
  assert.deepEqual(harness.freshnessCommits(), [[bill.sourceId]]);
});

test("bill dry-run reports proposed rows with zero writes or freshness", async () => {
  const harness = atomicHarness();
  const result = await upsertBills(harness.db, [bill], {
    ...harness.options,
    dryRun: true,
  });

  assert.equal(result.wouldWrite, 1);
  assert.equal(result.inserted, 0);
  assert.equal(harness.committedWrites(), 0);
  assert.equal(harness.atomicCalls(), 0);
  assert.deepEqual(harness.freshnessCommits(), []);
});

test("malformed and duplicate bill fixtures fail before any write", async () => {
  const harness = atomicHarness();
  await assert.rejects(
    upsertBills(
      harness.db,
      [{ ...bill, lastActionDate: "July 10" }],
      harness.options,
    ),
    /lastActionDate/,
  );
  await assert.rejects(
    upsertBills(harness.db, [bill, bill], harness.options),
    /Duplicate bill input key/,
  );
  assert.equal(harness.atomicCalls(), 0);
});

test("an empty bills input is a no-op", async () => {
  const harness = atomicHarness();
  const result = await upsertBills(harness.db, [], harness.options);
  assert.equal(result.wouldWrite, 0);
  assert.equal(harness.atomicCalls(), 0);
});

test("a mid-batch failure leaves no partial bills or freshness and retries safely", async () => {
  const harness = atomicHarness();
  const secondBill: BillIngest = {
    ...bill,
    sourceId: "senat_fr",
    externalId: "119-hr-2",
    title: "H.R. 2",
    url: "https://example.test/bill/2",
    raw: { id: 2 },
  };
  harness.failNext("mid-write");

  await assert.rejects(
    upsertBills(harness.db, [bill, secondBill], harness.options),
    /injected bill write failure/,
  );
  assert.deepEqual(harness.state(), []);
  assert.deepEqual(harness.freshnessCommits(), []);

  const retried = await upsertBills(
    harness.db,
    [bill, secondBill],
    harness.options,
  );
  assert.equal(retried.inserted, 2);
  assert.equal(harness.state().length, 2);
  assert.equal(harness.committedWrites(), 2);
  assert.deepEqual(harness.freshnessCommits(), [
    [bill.sourceId, secondBill.sourceId],
  ]);
});

test("a final freshness failure rolls back bills and same-input retry stamps once", async () => {
  const harness = atomicHarness();
  harness.failNext("final-freshness");

  await assert.rejects(
    upsertBills(harness.db, [bill], harness.options),
    /injected source freshness failure/,
  );
  assert.deepEqual(harness.state(), []);
  assert.deepEqual(harness.freshnessCommits(), []);

  const retried = await upsertBills(harness.db, [bill], harness.options);
  assert.equal(retried.inserted, 1);
  assert.deepEqual(retried.sourcesStamped, [bill.sourceId]);
  assert.equal(harness.committedWrites(), 1);
  assert.deepEqual(harness.freshnessCommits(), [[bill.sourceId]]);

  const unchanged = await upsertBills(harness.db, [bill], harness.options);
  assert.equal(unchanged.unchanged, 1);
  assert.deepEqual(unchanged.sourcesStamped, []);
  assert.equal(harness.atomicCalls(), 2);
  assert.deepEqual(harness.freshnessCommits(), [[bill.sourceId]]);
});
