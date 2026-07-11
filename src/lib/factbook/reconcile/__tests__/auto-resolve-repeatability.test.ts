import assert from "node:assert/strict";
import test from "node:test";
import { autoResolveStaleDisputes, type OpenDisputeRow } from "../auto-resolve-disputes";

const candidate: OpenDisputeRow = { id: "dispute-1", jurisdictionId: "jurisdiction-1", factKey: "population_total", disputeKind: "material_error", factIdA: "fact-a", factIdB: "fact-b", countrySlug: "canada", countryName: "Canada", factAStatus: "active", factBStatus: "active" };

function harness() {
  let row = { ...candidate, status: "open", reviewerId: null, reviewerNotes: null, resolvedAt: null as Date | null, resolutionAction: null as string | null };
  let writes = 0;
  let audits = 0;
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [structuredClone(row)] }) }) }),
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { row = { ...row, ...value }; writes++; } }) }),
  };
  return {
    db: db as never,
    readDisputes: async () => row.status === "open" ? [candidate] : [],
    writeAudit: (async () => { audits++; return `audit-${audits}`; }) as never,
    state: () => ({ row: structuredClone(row), writes, audits }),
  };
}

const resolveStale = async () => ({ population_total: { proposedDisputes: [] } }) as never;

test("auto-resolve fixture applications converge after the first close", async () => {
  const state = harness();
  const options = { readDisputes: state.readDisputes, resolveFacts: resolveStale, writeAudit: state.writeAudit };
  await autoResolveStaleDisputes(state.db, options);
  const first = state.state();
  await autoResolveStaleDisputes(state.db, options);
  assert.deepEqual(state.state(), first);
  assert.equal(first.row.status, "resolved_auto_stale");
  assert.equal(first.audits, 1);
});

test("auto-resolve dry-run is stable and performs zero writes", async () => {
  const state = harness();
  const options = { readDisputes: state.readDisputes, resolveFacts: resolveStale, writeAudit: state.writeAudit, dryRun: true };
  const first = await autoResolveStaleDisputes(state.db, options);
  const second = await autoResolveStaleDisputes(state.db, options);
  assert.deepEqual(first, second);
  assert.deepEqual({ writes: state.state().writes, audits: state.state().audits }, { writes: 0, audits: 0 });
});

test("auto-resolve resolver failure is loud and performs zero writes", async () => {
  const state = harness();
  const result = await autoResolveStaleDisputes(state.db, { readDisputes: state.readDisputes, resolveFacts: async () => { throw new Error("resolver input changed"); }, writeAudit: state.writeAudit });
  assert.match(result.errors.join(" "), /resolver input changed/);
  assert.deepEqual({ writes: state.state().writes, audits: state.state().audits }, { writes: 0, audits: 0 });
});
