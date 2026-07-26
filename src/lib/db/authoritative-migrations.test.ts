import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { migrationPlan, splitPostgresStatements } from "./authoritative-migrations";

test("statement splitter preserves semicolons inside PostgreSQL function bodies", () => {
  const sql = "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; END; $$; CREATE TABLE x(id int);";
  const statements = splitPostgresStatements(sql);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /PERFORM 1;/);
});

test("statement splitter preserves semicolons inside line and nested block comments", () => {
  const sql = [
    "SELECT 1;",
    "-- harmless; publication remains explicit",
    "INSERT INTO releases VALUES (1);",
    "/* outer; /* nested; */ still a comment; */ SELECT 2;",
  ].join("\n");
  const statements = splitPostgresStatements(sql);

  assert.equal(statements.length, 3);
  assert.match(statements[1], /^-- harmless; publication remains explicit\nINSERT INTO releases/);
  assert.match(statements[2], /^\/\* outer; \/\* nested; \*\/ still a comment; \*\/ SELECT 2;/);
});

test("statement splitter does not treat comment markers inside quoted values as comments", () => {
  const sql = `SELECT '-- value; /* still a value */', "identifier--with;semicolon", $tag$-- body; /* body */$tag$; SELECT 2;`;
  const statements = splitPostgresStatements(sql);

  assert.equal(statements.length, 2);
  assert.match(statements[0], /identifier--with;semicolon/);
  assert.match(statements[0], /\$tag\$-- body; \/\* body \*\/\$tag\$/);
  assert.equal(statements[1], "SELECT 2;");
});

test("statement splitter keeps the 0036 release-registration comment with its INSERT", () => {
  const source = readFileSync("drizzle/authoritative/0036_moaning_toad_men.sql", "utf8");
  const statements = splitPostgresStatements(source);
  const releaseRegistration = statements.find((statement) => statement.includes("INSERT INTO ci_index_releases"));

  assert.ok(releaseRegistration);
  assert.match(releaseRegistration, /^--> statement-breakpoint[\s\S]*-- PLT-014:[\s\S]*harmless; publication remains[\s\S]*INSERT INTO ci_index_releases/);
  assert.equal(statements.some((statement) => /^publication remains\b/.test(statement)), false);
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
