import assert from "node:assert/strict";
import test from "node:test";

import {
  NEON_TARGET_IDENTITY_SQL,
  NEON_TARGET_LEDGER_HEAD_SQL,
  databaseHostname,
  inspectNeonTarget,
  neonHostnameSha256,
  neonTargetErrors,
  neonTargetExpectationsFromArguments,
  readNeonTarget,
  validateNeonTarget,
  type NeonTargetExpectations,
  type NeonTargetReport,
  type ReadOnlyNeonSql,
} from "./neon-target";

const databaseUrl =
  "postgresql://ep-qa.example.neon.tech/civica?sslmode=require&channel_binding=require";
const expectations: NeonTargetExpectations = {
  expectedProjectId: "project-qa",
  expectedBranchId: "branch-qa",
  expectedHostnameSha256: neonHostnameSha256("ep-qa.example.neon.tech"),
  forbiddenBranchId: "branch-production",
  forbiddenHostnameSha256: neonHostnameSha256(
    "ep-production.example.neon.tech",
  ),
  requiredMigrationHead: "0048_entity_name_forms",
};
const identity = {
  projectId: "project-qa",
  branchId: "branch-qa",
  endpointId: "endpoint-qa",
  migrationHead: "0048_entity_name_forms",
  ledgerPresent: true,
};

test("validated Neon target report contains only bounded non-credential fields", () => {
  const report = validateNeonTarget({
    databaseUrl,
    identity,
    expectations,
  });
  assert.deepEqual(Object.keys(report), [
    "projectId",
    "branchId",
    "endpointId",
    "hostnameSha256",
    "migrationHead",
    "ledgerPresent",
    "writesPerformed",
  ]);
  assert.equal(
    report.hostnameSha256,
    neonHostnameSha256("ep-qa.example.neon.tech"),
  );
  assert.equal(report.writesPerformed, 0);
  const serialized = JSON.stringify(report);
  for (const secret of [
    "civica",
    "sslmode",
    "channel_binding",
  ]) {
    assert.ok(!serialized.includes(secret));
  }
});

test("database URL parser never returns credentials, path, or query", () => {
  assert.equal(databaseHostname(databaseUrl), "ep-qa.example.neon.tech");
  assert.throws(
    () => databaseHostname("https://example.test/not-postgres"),
    /not a valid PostgreSQL URL/,
  );
  assert.throws(
    () => databaseHostname("not-a-url"),
    /not a valid PostgreSQL URL/,
  );
});

test("pure target validation fails closed on every production identity guard", () => {
  const report = validateNeonTarget({
    databaseUrl,
    identity,
    expectations,
  });
  const cases: Array<[Partial<NeonTargetReport>, Partial<NeonTargetExpectations>, RegExp]> = [
    [{ projectId: "other-project" }, {}, /expected project/],
    [{ branchId: "branch-other" }, {}, /expected branch/],
    [{ hostnameSha256: neonHostnameSha256("ep-other.example.neon.tech") }, {}, /expected hostname/],
    [{ branchId: "branch-production" }, {}, /forbidden branch/],
    [
      { hostnameSha256: expectations.forbiddenHostnameSha256 },
      {},
      /forbidden hostname/,
    ],
    [{ migrationHead: "0047_atlas_data_error_reports" }, {}, /ledger head/],
    [{ migrationHead: null, ledgerPresent: false }, {}, /ledger is absent/],
    [{ endpointId: "" }, {}, /endpoint identity is absent/],
    [{}, { expectedHostnameSha256: "invalid" }, /expected hostname hash/],
    [{}, { expectedBranchId: "branch-production" }, /must differ/],
    [{}, { forbiddenHostnameSha256: "invalid" }, /must be SHA-256/],
  ];
  for (const [reportPatch, expectationPatch, error] of cases) {
    assert.match(
      neonTargetErrors(
        { ...report, ...reportPatch },
        { ...expectations, ...expectationPatch },
      ).join("\n"),
      error,
    );
  }
});

test("target expectations require exact staging and forbidden production identities", () => {
  assert.deepEqual(
    neonTargetExpectationsFromArguments([
      "--expected-project=project-qa",
      "--expected-branch=branch-qa",
      `--expected-hostname-sha256=${expectations.expectedHostnameSha256}`,
      "--forbidden-branch=branch-production",
      `--forbidden-hostname-sha256=${expectations.forbiddenHostnameSha256}`,
      "--required-migration-head=0048_entity_name_forms",
    ]),
    expectations,
  );
  assert.throws(
    () =>
      neonTargetExpectationsFromArguments([
        "--expected-project=project-qa",
      ]),
    /--expected-branch=/,
  );
});

test("read-only reader executes only identity and ledger-head queries", async () => {
  const queries: Array<{ query: string; params: readonly unknown[] }> = [];
  const sql: ReadOnlyNeonSql = {
    async query(query, params) {
      queries.push({ query, params });
      if (query === NEON_TARGET_IDENTITY_SQL) {
        return [{
          project_id: identity.projectId,
          branch_id: identity.branchId,
          endpoint_id: identity.endpointId,
        }];
      }
      if (query === NEON_TARGET_LEDGER_HEAD_SQL) {
        return [{ id: identity.migrationHead }];
      }
      throw new Error("unexpected query");
    },
  };
  assert.deepEqual(await readNeonTarget(sql), identity);
  assert.deepEqual(queries, [
    { query: NEON_TARGET_IDENTITY_SQL, params: [] },
    { query: NEON_TARGET_LEDGER_HEAD_SQL, params: [] },
  ]);
  assert.ok(
    queries.every(({ query }) =>
      /^\s*SELECT\b/i.test(query) &&
      !/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(query)),
  );
});

test("missing ledger is reported without fallback discovery queries", async () => {
  const queries: string[] = [];
  const sql: ReadOnlyNeonSql = {
    async query(query) {
      queries.push(query);
      if (query === NEON_TARGET_IDENTITY_SQL) {
        return [{
          project_id: identity.projectId,
          branch_id: identity.branchId,
          endpoint_id: identity.endpointId,
        }];
      }
      throw Object.assign(new Error("relation missing"), { code: "42P01" });
    },
  };
  assert.deepEqual(await readNeonTarget(sql), {
    projectId: identity.projectId,
    branchId: identity.branchId,
    endpointId: identity.endpointId,
    migrationHead: null,
    ledgerPresent: false,
  });
  assert.deepEqual(queries, [
    NEON_TARGET_IDENTITY_SQL,
    NEON_TARGET_LEDGER_HEAD_SQL,
  ]);
});

test("integrated inspector validates before returning and sanitizes query failures", async () => {
  const sql: ReadOnlyNeonSql = {
    async query(query) {
      if (query === NEON_TARGET_IDENTITY_SQL) {
        return [{
          project_id: identity.projectId,
          branch_id: identity.branchId,
          endpoint_id: identity.endpointId,
        }];
      }
      return [{ id: identity.migrationHead }];
    },
  };
  assert.equal(
    (await inspectNeonTarget({ databaseUrl, sql, expectations })).branchId,
    identity.branchId,
  );
  await assert.rejects(
    inspectNeonTarget({
      databaseUrl,
      sql: {
        async query() {
          throw new Error("connection failed with opaque credential material");
        },
      },
      expectations,
    }),
    (error: Error) => {
      assert.equal(error.message, "Unable to read Neon target identity");
      assert.ok(!error.message.includes("opaque credential material"));
      return true;
    },
  );
});
