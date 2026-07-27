import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import {
  type CronExecutionClaim,
  type CronExecutionClaimInput,
  type CronExecutionFinishInput,
  type CronExecutionStore,
} from "@/lib/api/cron-execution-store";
import { CRON_JOB_LEASE_MS } from "@/lib/api/cron-job-registry";
import {
  cronExecutionKeyFromRequest,
  withCronJob,
} from "@/lib/api/cron-job";
import * as schema from "@/lib/db/schema";
import { ingestPulseV2, type Db } from "./ingest";
import type { RawEventInput } from "./types";

class OneFinishOutageStore implements CronExecutionStore {
  private requestHash: string | null = null;
  private executionKey: string | null = null;
  private lease:
    | {
        token: string;
        attemptId: string;
        fence: number;
        expiresAt: Date;
      }
    | undefined;
  private succeededAt: Date | null = null;
  private responseStatus = 0;
  private finishOutagePending = true;
  attemptCount = 0;

  constructor(private readonly now: () => Date) {}

  async acquire(input: CronExecutionClaimInput): Promise<CronExecutionClaim> {
    if (
      this.executionKey === input.executionKey &&
      this.requestHash !== input.requestSha256
    ) {
      return { state: "conflict", attemptCount: this.attemptCount };
    }
    if (this.succeededAt) {
      return {
        state: "succeeded",
        completedAt: this.succeededAt,
        responseStatus: this.responseStatus,
        attemptCount: this.attemptCount,
      };
    }
    if (this.lease && this.lease.expiresAt > this.now()) {
      return {
        state: "running",
        leaseExpiresAt: this.lease.expiresAt,
        attemptCount: this.attemptCount,
      };
    }

    this.executionKey = input.executionKey;
    this.requestHash = input.requestSha256;
    this.attemptCount++;
    this.lease = {
      token: randomUUID(),
      attemptId: randomUUID(),
      fence: (this.lease?.fence ?? 0) + 1,
      expiresAt: new Date(this.now().getTime() + input.leaseMs),
    };
    return {
      state: "acquired",
      leaseToken: this.lease.token,
      attemptId: this.lease.attemptId,
      leaseFence: this.lease.fence,
      leaseExpiresAt: this.lease.expiresAt,
      attemptCount: this.attemptCount,
    };
  }

  async finish(input: CronExecutionFinishInput): Promise<boolean> {
    if (this.finishOutagePending) {
      this.finishOutagePending = false;
      throw new Error("seeded delivery-finalization outage");
    }
    if (
      !this.lease ||
      input.executionKey !== this.executionKey ||
      input.leaseToken !== this.lease.token ||
      input.attemptId !== this.lease.attemptId ||
      input.leaseFence !== this.lease.fence
    ) {
      return false;
    }
    if (input.status === "succeeded") {
      this.succeededAt = this.now();
      this.responseStatus = input.responseStatus;
    }
    this.lease = undefined;
    return true;
  }
}

const fixture: RawEventInput = {
  sourceId: "gdelt",
  externalId: "cron-retry-fixture",
  sourceUrl: "https://example.test/cron-retry-fixture",
  sourceType: "news",
  jurisdictionId: null,
  rawCountryName: "Uruguay",
  eventDate: "2026-07-13",
  title: "Fixture governance event",
  body: "Fixture body",
  raw: { fixture: true },
};

test("a delivery-finalization outage retries one completed ingest run without refetching or duplicate evidence", async () => {
  const database = new PGlite();
  const originalSecret = process.env.CRON_SECRET;
  let now = new Date("2026-07-14T08:05:00.000Z");
  const store = new OneFinishOutageStore(() => now);
  let fetchCalls = 0;
  try {
    await database.exec(`
      CREATE TABLE sources (
        id text PRIMARY KEY,
        last_sync_at timestamp
      );
      CREATE TABLE pulse_pipeline_runs (
        id uuid PRIMARY KEY,
        stage text NOT NULL,
        status text NOT NULL,
        version_key text NOT NULL,
        versions jsonb NOT NULL,
        counts jsonb NOT NULL DEFAULT '{}'::jsonb,
        failures jsonb NOT NULL DEFAULT '[]'::jsonb,
        started_at timestamp NOT NULL DEFAULT NOW(),
        completed_at timestamp
      );
      CREATE TABLE raw_events (
        id uuid PRIMARY KEY,
        source_id text NOT NULL,
        external_id text,
        source_url text NOT NULL,
        source_type text NOT NULL,
        jurisdiction_id uuid,
        raw_country_name text,
        event_date date,
        retrieved_at timestamp NOT NULL,
        title text NOT NULL,
        body text,
        raw jsonb NOT NULL,
        evidence_identity_key text NOT NULL UNIQUE,
        evidence_content_hash text NOT NULL,
        evidence_language text NOT NULL,
        evidence_publisher jsonb NOT NULL,
        evidence_attribution jsonb NOT NULL,
        evidence_rights jsonb NOT NULL,
        evidence_retention jsonb NOT NULL,
        ingest_run_id uuid NOT NULL
      );
      CREATE UNIQUE INDEX raw_events_external_unique
        ON raw_events (source_id, external_id)
        WHERE external_id IS NOT NULL;
      CREATE TABLE pulse_candidate_outcomes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        schema_version text NOT NULL,
        outcome_key text NOT NULL UNIQUE,
        candidate_kind text NOT NULL,
        candidate_id text NOT NULL,
        outcome text NOT NULL,
        reason_code text NOT NULL,
        reason text NOT NULL,
        actor jsonb NOT NULL,
        method_version text NOT NULL,
        stage_run_id uuid NOT NULL,
        decision_key text,
        canonical_candidate_id text,
        evidence_refs text[] NOT NULL,
        metadata jsonb NOT NULL,
        occurred_at timestamp NOT NULL
      );
      INSERT INTO sources (id) VALUES ('gdelt');
    `);
    const db = drizzle(database, { schema });
    const handler = withCronJob(
      "pulse.v2.ingest",
      async (request) => {
        const summary = await ingestPulseV2(db as unknown as Db, {
          cronExecutionKey: cronExecutionKeyFromRequest(request),
          jobs: [
            {
              source: "gdelt",
              fetcher: async () => {
                fetchCalls++;
                return { rows: [fixture], fetched: 1, unmatchedCountry: 0 };
              },
            },
          ],
          jurisdictionMap: new Map(),
          persistRun: true,
        });
        return Response.json({ ok: true, summary });
      },
      { store, now: () => now },
    );
    const request = () =>
      new Request("https://civicaatlas.org/api/cron/pulse/v2/ingest", {
        method: "POST",
        headers: {
          authorization: "Bearer correct-cron-secret",
          "idempotency-key": "ingest-finish-outage",
        },
      });

    process.env.CRON_SECRET = "correct-cron-secret";
    const first = await handler(request());
    assert.equal(first.status, 503);
    assert.equal(fetchCalls, 1);

    now = new Date(now.getTime() + CRON_JOB_LEASE_MS + 1);
    const retried = await handler(request());
    assert.equal(retried.status, 200);
    assert.equal((await retried.json()).summary.reused, true);
    assert.equal(fetchCalls, 1);
    assert.equal(store.attemptCount, 2);

    const state = await database.query<{
      runs: number;
      raw_rows: number;
      duplicate_outcomes: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM pulse_pipeline_runs) AS runs,
        (SELECT count(*)::integer FROM raw_events) AS raw_rows,
        (SELECT count(*)::integer FROM pulse_candidate_outcomes)
          AS duplicate_outcomes
    `);
    assert.deepEqual(state.rows[0], {
      runs: 1,
      raw_rows: 1,
      duplicate_outcomes: 0,
    });
  } finally {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    await database.close();
  }
});
