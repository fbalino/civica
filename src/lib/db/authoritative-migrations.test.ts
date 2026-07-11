import assert from "node:assert/strict";
import test from "node:test";
import { migrationPlan, splitPostgresStatements } from "./authoritative-migrations";

test("statement splitter preserves semicolons inside PostgreSQL function bodies", () => {
  const sql = "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; END; $$; CREATE TABLE x(id int);";
  const statements = splitPostgresStatements(sql);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /PERFORM 1;/);
});

test("ordered migration plan applies every later migration exactly once", () => {
  const all = [
    { id: "0000_base", path: "a", sha256: "x", baseline: true },
    { id: "0001_next", path: "b", sha256: "y", baseline: false },
  ];
  assert.deepEqual(migrationPlan(all, ["0000_base"]), { unknown: [], pending: [all[1]] });
  assert.deepEqual(migrationPlan(all, ["0000_base", "0001_next"]), { unknown: [], pending: [] });
  assert.deepEqual(migrationPlan(all, ["unknown"]).unknown, ["unknown"]);
});
