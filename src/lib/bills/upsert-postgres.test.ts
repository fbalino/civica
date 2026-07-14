import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { BillIngest } from "./types";
import { executeAtomicBillWrites, upsertBills } from "./upsert";

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
  raw: { id: 1 },
};

async function billsDatabase(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE sources (
      id text PRIMARY KEY,
      name text NOT NULL,
      base_url text,
      license text NOT NULL,
      is_commercial_use_allowed boolean NOT NULL,
      last_sync_at timestamp
    );
    CREATE TABLE bills (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      jurisdiction_id uuid NOT NULL,
      body_id uuid,
      source_id text NOT NULL REFERENCES sources(id),
      external_id text NOT NULL,
      title text NOT NULL,
      long_title text,
      summary text,
      stage integer NOT NULL DEFAULT 0,
      raw_status text,
      introduced_date date,
      last_action_date date NOT NULL,
      last_action_text text,
      sponsor_name text,
      sponsor_party text,
      url text NOT NULL,
      text_url text,
      vote_yes integer,
      vote_no integer,
      vote_abstain integer,
      raw jsonb,
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW(),
      CONSTRAINT bills_source_external_unique UNIQUE (source_id, external_id)
    );
    INSERT INTO sources (
      id, name, license, is_commercial_use_allowed
    ) VALUES (
      'congress_gov', 'Congress.gov', 'public-domain', true
    );
  `);
  return database;
}

function errorChain(error: unknown): string {
  const messages: string[] = [];
  let current = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return messages.join("\n");
}

test("PostgreSQL rolls back bill rows when the final freshness operation fails", async () => {
  const database = await billsDatabase();
  try {
    const db = drizzle(database);
    await database.exec(`
      ALTER TABLE sources
      ADD CONSTRAINT block_freshness CHECK (last_sync_at IS NULL);
    `);

    await assert.rejects(
      upsertBills(db as never, [bill], {
        now: new Date("2026-07-10T00:00:00Z"),
      }),
      (error) => {
        assert.match(errorChain(error), /block_freshness/);
        return true;
      },
    );
    assert.equal(
      (
        await database.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM bills",
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await database.query<{ last_sync_at: string | null }>(
          "SELECT last_sync_at::text AS last_sync_at FROM sources WHERE id = 'congress_gov'",
        )
      ).rows[0].last_sync_at,
      null,
    );

    await database.exec("ALTER TABLE sources DROP CONSTRAINT block_freshness;");
    const retried = await upsertBills(db as never, [bill], {
      now: new Date("2026-07-10T00:00:00Z"),
    });
    assert.equal(retried.inserted, 1);
    assert.deepEqual(retried.sourcesStamped, [bill.sourceId]);

    const freshnessAfterRetry = (
      await database.query<{ last_sync_at: string | null }>(
        "SELECT last_sync_at::text AS last_sync_at FROM sources WHERE id = 'congress_gov'",
      )
    ).rows[0].last_sync_at;
    assert.ok(freshnessAfterRetry);

    const unchanged = await upsertBills(db as never, [bill], {
      now: new Date("2026-07-11T00:00:00Z"),
    });
    assert.equal(unchanged.unchanged, 1);
    assert.deepEqual(unchanged.sourcesStamped, []);
    assert.equal(
      (
        await database.query<{ last_sync_at: string | null }>(
          "SELECT last_sync_at::text AS last_sync_at FROM sources WHERE id = 'congress_gov'",
        )
      ).rows[0].last_sync_at,
      freshnessAfterRetry,
    );

    const changed = await upsertBills(
      db as never,
      [
        {
          ...bill,
          stage: 2,
          rawStatus: "Passed chamber",
          lastActionDate: "2026-07-12",
        },
      ],
      { now: new Date("2026-07-12T00:00:00Z") },
    );
    assert.equal(changed.updated, 1);
    assert.deepEqual(changed.sourcesStamped, [bill.sourceId]);
    assert.deepEqual(
      (
        await database.query<{ stage: number; raw_status: string }>(
          "SELECT stage, raw_status FROM bills WHERE source_id = 'congress_gov'",
        )
      ).rows[0],
      { stage: 2, raw_status: "Passed chamber" },
    );
  } finally {
    await database.close();
  }
});

test("a concurrent uniqueness failure rolls back every planned bill write", async () => {
  const database = await billsDatabase();
  try {
    const db = drizzle(database);
    const secondBill: BillIngest = {
      ...bill,
      externalId: "119-hr-2",
      title: "H.R. 2",
      url: "https://example.test/bill/2",
      raw: { id: 2 },
    };
    let injected = false;

    await assert.rejects(
      upsertBills(db as never, [bill, secondBill], {
        atomicWrite: async (executor, writes, committedAt) => {
          if (!injected) {
            injected = true;
            await database.query(
              `INSERT INTO bills (
                jurisdiction_id,
                source_id,
                external_id,
                title,
                stage,
                last_action_date,
                url,
                raw
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
              [
                secondBill.jurisdictionId,
                secondBill.sourceId,
                secondBill.externalId,
                secondBill.title,
                secondBill.stage,
                secondBill.lastActionDate,
                secondBill.url,
                JSON.stringify(secondBill.raw),
              ],
            );
          }
          return executeAtomicBillWrites(executor, writes, committedAt);
        },
      }),
      (error) => {
        assert.match(errorChain(error), /unique|duplicate/i);
        return true;
      },
    );

    assert.deepEqual(
      (
        await database.query<{ external_id: string }>(
          "SELECT external_id FROM bills ORDER BY external_id",
        )
      ).rows.map((row) => row.external_id),
      [secondBill.externalId],
    );
    assert.equal(
      (
        await database.query<{ last_sync_at: string | null }>(
          "SELECT last_sync_at::text AS last_sync_at FROM sources WHERE id = 'congress_gov'",
        )
      ).rows[0].last_sync_at,
      null,
    );
  } finally {
    await database.close();
  }
});
