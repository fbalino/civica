import assert from "node:assert/strict";
import test from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildCountryFactDemotionHistoryStatement,
  buildCountryFactHistoryStatement,
  resolveAtlasReleaseId,
  routineCountryFactHistory,
} from "./country-fact-history-writer";

const values = {
  jurisdictionId: "123e4567-e89b-42d3-a456-426614174000",
  factKey: "population",
  factGroup: "B",
  category: "people",
  sourceId: "world_bank",
  sourceUrl: "https://example.invalid/population",
  factValue: "3,500,000",
  factValueNumeric: 3_500_000,
  factUnit: "people",
  factYear: 2025,
  upstreamVintageLabel: "WDI 2026.01",
  methodologyVersion: "fact-reconciliation/v0.2-beta",
  status: "active",
  statusReason: null,
} as const;

test("country-fact statement serializes, upserts, and appends history atomically", () => {
  const query = new PgDialect().sqlToQuery(
    buildCountryFactHistoryStatement(
      {
        values,
        history: routineCountryFactHistory(values, "atlas-2026-07"),
      },
      "223e4567-e89b-42d3-a456-426614174000",
    ),
  );

  assert.match(query.sql, /pg_advisory_xact_lock/i);
  assert.match(query.sql, /before_row AS MATERIALIZED/i);
  assert.match(query.sql, /INSERT INTO country_facts/i);
  assert.match(
    query.sql,
    /ON CONFLICT \(jurisdiction_id, fact_key, source_id\)/i,
  );
  assert.match(query.sql, /INSERT INTO atlas_entity_change_history/i);
  assert.match(query.sql, /jsonb_array_length\(changes\) > 0/i);
  assert.equal(query.sql.includes("status = EXCLUDED.status"), false);
  assert.ok(query.params.includes("atlas-2026-07"));
});

test("CIA lifecycle writes may explicitly update review status", () => {
  const query = new PgDialect().sqlToQuery(
    buildCountryFactHistoryStatement({
      values,
      history: routineCountryFactHistory(values, "atlas-2026-07"),
      preserveReviewStatus: false,
    }),
  );
  assert.match(query.sql, /status = EXCLUDED.status/i);
  assert.match(query.sql, /status_reason = EXCLUDED.status_reason/i);
});

test("Atlas release identity is validated independently of the host environment", () => {
  const noReleaseEnvironment = {};
  const configuredEnvironment = {
    CIVICA_ATLAS_RELEASE_ID: "atlas-routine-refresh-test",
  };

  assert.throws(
    () => resolveAtlasReleaseId("", noReleaseEnvironment),
    /named Atlas release/,
  );
  assert.throws(
    () => resolveAtlasReleaseId("release with spaces", configuredEnvironment),
    /named Atlas release/,
  );
  assert.equal(
    resolveAtlasReleaseId(undefined, configuredEnvironment),
    "atlas-routine-refresh-test",
  );
  assert.equal(
    resolveAtlasReleaseId("atlas-2026-07", configuredEnvironment),
    "atlas-2026-07",
  );
});

test("reviewer demotion updates the fact and appends its event in one statement", () => {
  const query = new PgDialect().sqlToQuery(
    buildCountryFactDemotionHistoryStatement({
      factId: "323e4567-e89b-42d3-a456-426614174000",
      statusReason: "demoted_by_dispute_fixture",
      history: {
        changeKind: "substantive_revision",
        reason: "Reviewer selected the competing source row",
        methodologyVersion: "fact-reconciliation-dispute-review/v1",
        releaseId: "atlas-2026-07",
      },
    }),
  );
  assert.match(query.sql, /before_row AS MATERIALIZED/i);
  assert.match(query.sql, /UPDATE country_facts/i);
  assert.match(query.sql, /status = 'demoted'/i);
  assert.match(query.sql, /INSERT INTO atlas_entity_change_history/i);
  assert.match(query.sql, /history_complete/i);
});
