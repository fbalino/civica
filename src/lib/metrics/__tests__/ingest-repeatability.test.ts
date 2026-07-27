import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildCountryMetricHistoryStatement,
  writeCountryMetrics,
  type CountryMetricHistoryContext,
  type CountryMetricInput,
} from "../ingest";

const fixture: CountryMetricInput = {
  jurisdictionId: "123e4567-e89b-42d3-a456-426614174000",
  metricId: "cpi",
  year: 2024,
  value: 75,
  rank: 12,
  totalRanked: 180,
  sourceId: "transparency_intl",
  sourceUrl: "https://example.invalid",
};
const history: CountryMetricHistoryContext = {
  changeKind: "routine_refresh",
  reason: "Publisher release refresh",
  methodologyVersion: "country-metric-upsert/v1",
  releaseId: "atlas-2026-07",
};

function harness() {
  const rows = new Map<string, CountryMetricInput>();
  let writes = 0;
  const db = {};
  const writeMetric = async (
    _database: never,
    value: CountryMetricInput,
  ) => {
    rows.set(
      `${value.jurisdictionId}:${value.metricId}:${value.year}`,
      structuredClone(value),
    );
    writes += 1;
  };
  return {
    db: db as never,
    rows,
    writes: () => writes,
    writeMetric: writeMetric as never,
  };
}

const mark = (async () => []) as never;

test("country-metric fixtures converge", async () => {
  const state = harness();
  await writeCountryMetrics(state.db, [fixture], {
    history,
    markSynced: mark,
    writeMetric: state.writeMetric,
  });
  const first = structuredClone([...state.rows]);
  await writeCountryMetrics(state.db, [fixture], {
    history,
    markSynced: mark,
    writeMetric: state.writeMetric,
  });
  assert.deepEqual([...state.rows], first);
  assert.equal(state.rows.size, 1);
});

test("country-metric history statement is one atomic upsert-and-append query", () => {
  const query = new PgDialect().sqlToQuery(
    buildCountryMetricHistoryStatement(
      fixture,
      history,
      "223e4567-e89b-42d3-a456-426614174000",
    ),
  );
  assert.match(query.sql, /^\s*WITH before_row AS/i);
  assert.match(query.sql, /INSERT INTO country_metrics/i);
  assert.match(query.sql, /ON CONFLICT \(jurisdiction_id, metric_id, year\)/i);
  assert.match(query.sql, /INSERT INTO atlas_entity_change_history/i);
  assert.match(query.sql, /jsonb_array_length\(changes\) > 0/i);
  assert.ok(query.params.includes("atlas-2026-07"));
  assert.ok(query.params.includes("country-metric-upsert/v1"));
});

test("country-metric apply fails closed without a named release context", async () => {
  const state = harness();
  await assert.rejects(
    writeCountryMetrics(state.db, [fixture], {
      markSynced: mark,
      writeMetric: state.writeMetric,
    }),
    /require a named Atlas release history context/,
  );
  assert.equal(state.writes(), 0);
});

test("country-metric dry-run writes nothing", async () => {
  const state = harness();
  assert.deepEqual(
    await writeCountryMetrics(state.db, [fixture], {
      dryRun: true,
      markSynced: mark,
    }),
    await writeCountryMetrics(state.db, [fixture], {
      dryRun: true,
      markSynced: mark,
    }),
  );
  assert.equal(state.writes(), 0);
});

test("country-metric malformed and duplicate batches fail before writes", async () => {
  const state = harness();
  let stamps = 0;
  const countingMark = (async () => {
    stamps += 1;
    return [];
  }) as never;
  await assert.rejects(
    writeCountryMetrics(state.db, [fixture, fixture], {
      history,
      markSynced: countingMark,
      writeMetric: state.writeMetric,
    }),
    /Duplicate/,
  );
  await assert.rejects(
    writeCountryMetrics(
      state.db,
      [{ ...fixture, value: Number.NaN }],
      {
        history,
        markSynced: countingMark,
        writeMetric: state.writeMetric,
      },
    ),
    /Invalid/,
  );
  assert.equal(state.writes(), 0);
  assert.equal(stamps, 0);
});
