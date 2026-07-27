import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL(
    "../../../drizzle/authoritative/0033_flat_hardball.sql",
    import.meta.url,
  ),
  "utf8",
);

test("PLT-009 migration creates constrained hashed revocation and audit relations", () => {
  assert.match(
    migration,
    /civica-affected-relations: admin_mutation_audit_log,admin_session_revocations/,
  );
  assert.match(migration, /CREATE TABLE "admin_session_revocations"/);
  assert.match(migration, /"session_key" text PRIMARY KEY NOT NULL/);
  assert.match(migration, /admin_session_revocations_lifetime_check/);
  assert.match(migration, /admin_session_revocations_time_order_check/);
  assert.match(migration, /idx_admin_session_revocations_expires_at/);
  assert.doesNotMatch(migration, /"session_id"\s+text/);

  assert.match(migration, /CREATE TABLE "admin_mutation_audit_log"/);
  for (const column of [
    "actor_id",
    "action",
    "target_type",
    "target_id",
    "result",
    "created_at",
  ]) {
    assert.match(migration, new RegExp(`"${column}"`));
  }
  assert.match(migration, /admin_mutation_audit_event_result_check/);
  assert.match(migration, /admin_mutation_audit_log_append_only/);
  assert.match(migration, /admin_session_revocations_append_only/);
  assert.match(
    migration,
    /CREATE TRIGGER admin_mutation_audit_log_no_truncate[\s\S]*BEFORE TRUNCATE ON admin_mutation_audit_log[\s\S]*FOR EACH STATEMENT/,
  );
  assert.match(
    migration,
    /CREATE TRIGGER admin_session_revocations_no_truncate[\s\S]*BEFORE TRUNCATE ON admin_session_revocations[\s\S]*FOR EACH STATEMENT/,
  );
});
