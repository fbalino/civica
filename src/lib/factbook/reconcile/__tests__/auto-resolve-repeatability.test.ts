import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  autoResolveStaleDisputes,
  closeStaleDisputeAtomically,
  type AtomicCloseStaleDispute,
  type OpenDisputeRow,
} from "../auto-resolve-disputes";

const candidate: OpenDisputeRow = {
  id: "dispute-1",
  jurisdictionId: "jurisdiction-1",
  factKey: "population_total",
  disputeKind: "material_error",
  factIdA: "fact-a",
  factIdB: "fact-b",
  countrySlug: "canada",
  countryName: "Canada",
  factAStatus: "active",
  factBStatus: "active",
};

function harness(options: { failNextClose?: boolean } = {}) {
  let row: OpenDisputeRow & {
    status: string;
    reviewerId: string | null;
    reviewerNotes: string | null;
    resolvedAt: Date | null;
    resolutionAction: string | null;
  } = {
    ...candidate,
    status: "open",
    reviewerId: null,
    reviewerNotes: null,
    resolvedAt: null as Date | null,
    resolutionAction: null as string | null,
  };
  let audits = 0;
  let closeCalls = 0;
  let failNextClose = options.failNextClose ?? false;
  const closeDispute: AtomicCloseStaleDispute = async (_db, input) => {
    closeCalls++;
    if (row.status !== "open" && row.status !== "in_review") {
      return { outcome: "not_open" };
    }
    if (failNextClose) {
      failNextClose = false;
      throw new Error("audit insert rejected");
    }

    // The fixture commits the domain row and audit row together, mirroring
    // the production data-modifying CTE's all-or-nothing boundary.
    row = {
      ...row,
      status: "resolved_auto_stale",
      reviewerId: "system_auto_resolve",
      resolvedAt: new Date("2026-07-14T12:00:00.000Z"),
      resolutionAction: "auto_resolve_stale",
    };
    audits++;
    return { outcome: "closed", auditId: `audit-${audits}-${input.disputeId}` };
  };
  return {
    db: {} as never,
    readDisputes: async () => (row.status === "open" ? [candidate] : []),
    closeDispute,
    state: () => ({ row: structuredClone(row), audits, closeCalls }),
  };
}

const resolveStale = async () =>
  ({ population_total: { proposedDisputes: [] } }) as never;

test("auto-resolve fixture applications converge after the first close", async () => {
  const state = harness();
  const options = {
    readDisputes: state.readDisputes,
    resolveFacts: resolveStale,
    closeDispute: state.closeDispute,
  };
  await autoResolveStaleDisputes(state.db, options);
  const first = state.state();
  await autoResolveStaleDisputes(state.db, options);
  assert.deepEqual(state.state(), first);
  assert.equal(first.row.status, "resolved_auto_stale");
  assert.equal(first.audits, 1);
});

test("auto-resolve dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const options = {
    readDisputes: state.readDisputes,
    resolveFacts: resolveStale,
    closeDispute: state.closeDispute,
    dryRun: true,
  };
  const first = await autoResolveStaleDisputes(state.db, options);
  const second = await autoResolveStaleDisputes(state.db, options);
  assert.deepEqual(first, second);
  assert.deepEqual(
    { closeCalls: state.state().closeCalls, audits: state.state().audits },
    { closeCalls: 0, audits: 0 },
  );
});

test("auto-resolve resolver failure is loud and performs zero writes", async () => {
  const state = harness();
  const result = await autoResolveStaleDisputes(state.db, {
    readDisputes: state.readDisputes,
    resolveFacts: async () => {
      throw new Error("resolver input changed");
    },
    closeDispute: state.closeDispute,
  });
  assert.match(result.errors.join(" "), /resolver input changed/);
  assert.deepEqual(
    { closeCalls: state.state().closeCalls, audits: state.state().audits },
    { closeCalls: 0, audits: 0 },
  );
});

test("failed atomic close retains no partial state and a retry converges", async () => {
  const state = harness({ failNextClose: true });
  const options = {
    readDisputes: state.readDisputes,
    resolveFacts: resolveStale,
    closeDispute: state.closeDispute,
  };

  const failed = await autoResolveStaleDisputes(state.db, options);
  assert.match(failed.errors.join(" "), /audit insert rejected/);
  assert.equal(state.state().row.status, "open");
  assert.equal(state.state().audits, 0);

  const retried = await autoResolveStaleDisputes(state.db, options);
  assert.equal(retried.autoResolved, 1);
  assert.deepEqual(retried.errors, []);
  const afterRetry = state.state();
  assert.equal(afterRetry.row.status, "resolved_auto_stale");
  assert.equal(afterRetry.audits, 1);

  const duplicate = await autoResolveStaleDisputes(state.db, options);
  assert.equal(duplicate.scanned, 0);
  assert.deepEqual(state.state(), afterRetry);
});

test("PostgreSQL rolls back the dispute UPDATE when the audit INSERT fails", async () => {
  const database = new PGlite();
  const disputeId = "11111111-1111-4111-8111-111111111111";
  try {
    await database.exec(`
      CREATE TABLE data_disputes (
        id uuid PRIMARY KEY,
        jurisdiction_id uuid NOT NULL,
        fact_key text NOT NULL,
        status text NOT NULL,
        reviewer_id text,
        reviewer_notes text,
        resolved_at timestamp,
        resolution_action text
      );
      CREATE TABLE data_facts_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        jurisdiction_id uuid,
        fact_key text,
        dispute_id uuid,
        action text NOT NULL,
        actor_id text NOT NULL,
        before jsonb,
        after jsonb,
        notes text CHECK (notes <> 'force-audit-failure'),
        created_at timestamp NOT NULL DEFAULT NOW()
      );
      INSERT INTO data_disputes (
        id, jurisdiction_id, fact_key, status
      ) VALUES (
        '${disputeId}',
        '22222222-2222-4222-8222-222222222222',
        'population_total',
        'open'
      );
    `);
    await database.exec("SET TIME ZONE 'America/Los_Angeles'");
    const testDb = drizzle(database);

    await assert.rejects(
      closeStaleDisputeAtomically(testDb as never, {
        disputeId,
        note: "force-audit-failure",
      }),
    );
    assert.equal(
      (
        await database.query<{ status: string }>(
          "SELECT status FROM data_disputes WHERE id = $1",
          [disputeId],
        )
      ).rows[0].status,
      "open",
    );
    assert.equal(
      (
        await database.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM data_facts_audit_log",
        )
      ).rows[0].count,
      0,
    );

    const retried = await closeStaleDisputeAtomically(testDb as never, {
      disputeId,
      note: "resolver no longer emits this dispute",
    });
    assert.equal(retried.outcome, "closed");
    assert.equal(
      (
        await database.query<{ status: string }>(
          "SELECT status FROM data_disputes WHERE id = $1",
          [disputeId],
        )
      ).rows[0].status,
      "resolved_auto_stale",
    );
    assert.equal(
      (
        await database.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM data_facts_audit_log",
        )
      ).rows[0].count,
      1,
    );
    const timestampEvidence = (
      await database.query<{
        stored_resolved_at: string;
        audit_resolved_at: string;
      }>(`
        SELECT
          to_char(resolved_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stored_resolved_at,
          after ->> 'resolvedAt' AS audit_resolved_at
        FROM data_disputes d
        JOIN data_facts_audit_log a ON a.dispute_id = d.id
        WHERE d.id = $1
      `, [disputeId])
    ).rows[0];
    assert.equal(
      timestampEvidence.audit_resolved_at,
      timestampEvidence.stored_resolved_at,
    );

    assert.deepEqual(
      await closeStaleDisputeAtomically(testDb as never, {
        disputeId,
        note: "duplicate delivery",
      }),
      { outcome: "not_open" },
    );
  } finally {
    await database.close();
  }
});
