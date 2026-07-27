import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AUTHORITATIVE_SCHEMA_FINGERPRINT_VERSION,
  authoritativeManifestBinding,
  buildAuthoritativeSchemaFingerprintArtifact,
  migrationPlan,
  splitPostgresStatements,
  validateAuthoritativeSchemaFingerprintArtifact,
} from "./authoritative-migrations";
import { ciStagedReleaseHeader } from "../ci/release-publication";
import { resolveCiRelease } from "../ci/release-selection";

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

test("0036 limits its frozen-vintage bypass to the release-id backfill", () => {
  const source = readFileSync("drizzle/authoritative/0036_moaning_toad_men.sql", "utf8");
  const statements = splitPostgresStatements(source);
  const disableIndex = statements.findIndex((statement) =>
    /ALTER TABLE ci_composite_scores DISABLE TRIGGER dat_023_immutable_vintage/.test(statement),
  );
  const backfillIndex = statements.findIndex((statement) =>
    /UPDATE ci_composite_scores score\s+SET release_id=release\.id/.test(statement),
  );
  const enableIndex = statements.findIndex((statement) =>
    /ALTER TABLE ci_composite_scores ENABLE TRIGGER dat_023_immutable_vintage/.test(statement),
  );

  assert.ok(disableIndex >= 0);
  assert.equal(backfillIndex, disableIndex + 1);
  assert.equal(enableIndex, backfillIndex + 1);
  assert.match(statements[backfillIndex], /WHERE score\.release_id IS NULL/);
  assert.match(statements[backfillIndex], /score\.vintage_label=release\.vintage_label/);
  assert.doesNotMatch(statements[backfillIndex], /\bSET\s+(?!release_id=)/);
  assert.equal(
    statements.filter((statement) => /DISABLE TRIGGER/.test(statement)).length,
    1,
  );
});

test("0050 repairs only the three exact unpublished Index headers", () => {
  const source = readFileSync(
    "drizzle/authoritative/0050_index_release_header_contract.sql",
    "utf8",
  );
  const currentHeader = ciStagedReleaseHeader(
    resolveCiRelease("ci-beta-r5-2024-Q4"),
  );

  assert.match(source, /LOCK TABLE ci_index_releases IN ACCESS EXCLUSIVE MODE/);
  assert.match(source, /status = 'staging'/);
  assert.match(source, /published_at IS NULL/);
  assert.match(source, /Index header repair refuses a release selected by the public pointer/);
  assert.match(
    source,
    /dc74a651c96ec770cd8128cb22c61d663f0b8192f9441ce55ff44f24966602cc/,
  );
  assert.ok(source.includes(currentHeader.inputManifestSha256));
  assert.match(source, /DISABLE TRIGGER plt_014_guard_ci_release_header/);
  assert.match(source, /ENABLE TRIGGER plt_014_guard_ci_release_header/);
  assert.match(source, /rule\.value->>'dimension'/);
  assert.match(source, /repaired_count NOT IN \(0, 3\)/);
  assert.doesNotMatch(source, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(source, /\bSET\s+status\b/i);
  assert.doesNotMatch(source, /\bSET\s+published_at\b/i);
});

test("0051 forward-fixes only the Conditions normalization direction constraint", () => {
  const source = readFileSync(
    "drizzle/authoritative/0051_eminent_jocasta.sql",
    "utf8",
  );
  const statements = splitPostgresStatements(source);

  assert.equal(statements.length, 2);
  assert.match(
    statements[0],
    /DROP CONSTRAINT "conditions_normalization_parameter_shape_check"/,
  );
  assert.match(
    statements[1],
    /ADD CONSTRAINT "conditions_normalization_parameter_shape_check"/,
  );
  assert.match(statements[1], /'not_ranked'/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE)\b/i);
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

const manifestFixture = [
  {
    id: "0000_base",
    path: "drizzle/authoritative/0000_base.sql",
    sha256: "a".repeat(64),
    baseline: true,
  },
  {
    id: "0001_next",
    path: "drizzle/authoritative/0001_next.sql",
    sha256: "b".repeat(64),
    baseline: false,
  },
] as const;

test("schema fingerprint artifact binds the complete authoritative manifest and its head", () => {
  const schema = { relations: [{ name: "countries" }], columns: [] };
  const artifact = buildAuthoritativeSchemaFingerprintArtifact(
    schema,
    manifestFixture,
    "2026-07-26T12:00:00.000Z",
  );

  assert.equal(artifact.schemaVersion, AUTHORITATIVE_SCHEMA_FINGERPRINT_VERSION);
  assert.deepEqual(artifact.authoritativeManifest, {
    head: { id: "0001_next", sha256: "b".repeat(64) },
    sha256: authoritativeManifestBinding(manifestFixture).sha256,
  });
  assert.deepEqual(
    validateAuthoritativeSchemaFingerprintArtifact(artifact, manifestFixture),
    [],
  );
});

test("schema fingerprint validation rejects legacy and stale artifacts without fallback", () => {
  const schema = { relations: [], columns: [] };
  const current = buildAuthoritativeSchemaFingerprintArtifact(
    schema,
    manifestFixture,
    "2026-07-26T12:00:00.000Z",
  );
  const staleManifest = [
    {
      id: "0000_base",
      path: "drizzle/authoritative/0000_base.sql",
      sha256: "a".repeat(64),
      baseline: true,
    },
  ] as const;
  const legacy = {
    schemaVersion: AUTHORITATIVE_SCHEMA_FINGERPRINT_VERSION,
    generatedAt: current.generatedAt,
    sha256: current.sha256,
    schema,
  };
  const errors = validateAuthoritativeSchemaFingerprintArtifact(
    {
      ...current,
      schemaVersion: "authoritative-schema-fingerprint/v0",
      authoritativeManifest: authoritativeManifestBinding(staleManifest),
      sha256: "0".repeat(64),
    },
    manifestFixture,
  );

  assert.deepEqual(
    validateAuthoritativeSchemaFingerprintArtifact(legacy, manifestFixture),
    [
      `schema fingerprint manifest head <missing>@<missing> differs from 0001_next@${"b".repeat(64)}`,
      `schema fingerprint manifest hash <missing> differs from ${authoritativeManifestBinding(manifestFixture).sha256}`,
    ],
  );
  assert.equal(errors.length, 4);
  assert.match(errors[0], /artifact version .* differs/);
  assert.match(errors[1], /manifest head .* differs/);
  assert.match(errors[2], /manifest hash .* differs/);
  assert.match(errors[3], /serialized schema hash .* differs/);
});
