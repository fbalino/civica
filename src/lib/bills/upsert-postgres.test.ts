import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  lastActionDateStatus: "observed",
  lastActionDateReason: null,
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

/** DAT-038's shipped migration, applied to the pre-migration table shape. */
const BILL_LAST_ACTION_MIGRATION = readFileSync(
  "drizzle/authoritative/0052_bill_last_action_date_state.sql",
  "utf8",
);

async function billsDatabase(
  beforeMigration?: (database: PGlite) => Promise<void>,
): Promise<PGlite> {
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
    CREATE INDEX bills_jurisdiction_last_action_idx
      ON bills USING btree (jurisdiction_id, last_action_date);
    INSERT INTO sources (
      id, name, license, is_commercial_use_allowed
    ) VALUES (
      'congress_gov', 'Congress.gov', 'public-domain', true
    );
  `);
  await beforeMigration?.(database);
  for (const statement of BILL_LAST_ACTION_MIGRATION.split(
    "--> statement-breakpoint",
  )) {
    if (statement.trim()) await database.exec(statement);
  }
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

test("migration 0052 keeps stored dates observed and enforces the typed absence shape", async () => {
  const database = await billsDatabase(async (preMigration) => {
    await preMigration.query(
      `INSERT INTO bills (
        jurisdiction_id, source_id, external_id, title, last_action_date, url
      ) VALUES ($1, 'congress_gov', 'legacy-1', 'Legacy', '2026-07-01', 'https://example.test/legacy')`,
      [bill.jurisdictionId],
    );
  });
  try {
    assert.deepEqual(
      (
        await database.query<{
          status: string;
          reason: string | null;
          date: string;
        }>(
          "SELECT last_action_date_status AS status, last_action_date_reason AS reason, last_action_date::text AS date FROM bills",
        )
      ).rows,
      [{ status: "observed", reason: null, date: "2026-07-01" }],
    );

    const insert = (date: string | null, status: string, reason: string | null) =>
      database.query(
        `INSERT INTO bills (
          jurisdiction_id, source_id, external_id, title, last_action_date,
          last_action_date_status, last_action_date_reason, url
        ) VALUES ($1, 'congress_gov', gen_random_uuid()::text, 'Probe', $2, $3, $4, 'https://example.test/probe')`,
        [bill.jurisdictionId, date, status, reason],
      );
    await assert.rejects(insert(null, "observed", null), /status_shape/);
    await assert.rejects(insert("2026-07-01", "missing", "x"), /status_shape/);
    await assert.rejects(insert(null, "missing", null), /status_reason/);
    await assert.rejects(insert(null, "missing", "  "), /status_reason/);
    await assert.rejects(insert("2026-07-01", "observed", "x"), /status_reason/);
    await assert.rejects(insert(null, "retrieved", "x"), /status_allowed/);

    const db = drizzle(database);
    const absent: BillIngest = {
      ...bill,
      externalId: "119-s-2",
      url: "https://example.test/bill/2",
      lastActionDate: null,
      lastActionDateStatus: "missing",
      lastActionDateReason: "The Congress.gov record carries no latestAction.actionDate.",
      raw: { id: 2 },
    };
    const written = await upsertBills(db as never, [bill, absent], {
      now: new Date("2026-07-10T00:00:00Z"),
    });
    assert.equal(written.inserted, 2);
    const repeat = await upsertBills(db as never, [bill, absent], {
      now: new Date("2026-07-11T00:00:00Z"),
    });
    assert.equal(repeat.unchanged, 2, "a stored absence is stable, not rewritten daily");

    const nowObserved = await upsertBills(
      db as never,
      [
        {
          ...absent,
          lastActionDate: "2026-07-09",
          lastActionDateStatus: "observed",
          lastActionDateReason: null,
        },
      ],
      { now: new Date("2026-07-12T00:00:00Z") },
    );
    assert.equal(nowObserved.updated, 1);
    assert.deepEqual(
      (
        await database.query<{ date: string | null; status: string; reason: string | null }>(
          "SELECT last_action_date::text AS date, last_action_date_status AS status, last_action_date_reason AS reason FROM bills WHERE external_id = '119-s-2'",
        )
      ).rows[0],
      { date: "2026-07-09", status: "observed", reason: null },
    );
  } finally {
    await database.close();
  }
});
