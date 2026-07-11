import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DataValueState } from "@/components/DataValueState";
import { buildIndicatorHistorySeries } from "@/lib/db/queries";
import { buildApiDataValueStatus } from "@/lib/factbook/reconcile/api";
import { zCountryExportFact } from "@/lib/api/contract/schemas";
import type { FactRow, ResolverOutput } from "@/lib/factbook/reconcile/types";
import {
  DATA_VALUE_STATUSES,
  dataValueStatusLabel,
  publicDataValueStatus,
  validateDataValueState,
  type DataValueStatus,
} from "./value-state";

const REASON: Record<Exclude<DataValueStatus, "observed">, string> = {
  missing: "Pipeline row is absent.",
  unknown: "Publisher reports unknown.",
  not_applicable: "Concept does not apply.",
  not_observed: "No observation exists for this period.",
  disputed: "Sources conflict.",
  withheld: "Release rights do not permit publication.",
};

function fact(status: DataValueStatus): FactRow {
  const hasValue = status === "observed" || status === "disputed";
  return {
    id: `fact-${status}`,
    jurisdictionId: "j1",
    factKey: "population_total",
    factGroup: "B",
    category: "demographics",
    sourceId: "fixture",
    sourceUrl: null,
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    factValue: hasValue ? "0" : null,
    factValueNumeric: hasValue ? 0 : null,
    factUnit: "people",
    factYear: 2025,
    valueJson: null,
    valueStatus: status,
    valueStatusReason: status === "observed" ? null : REASON[status],
    asOf: "2025-01-01",
    dataVintageYear: null,
    retrievedAt: "2026-01-01T00:00:00.000Z",
    upstreamVintageLabel: "fixture",
    methodologyVersion: "fixture",
    status: "active",
    statusReason: null,
    sourceNote: null,
    valueType: "measured",
    growthMethodology: null,
  };
}

function output(status: DataValueStatus): ResolverOutput {
  const row = fact(status);
  const hasValue = status === "observed" || status === "disputed";
  return {
    jurisdictionId: "j1",
    factKey: row.factKey,
    canonical: hasValue ? row : null,
    alternates: [],
    all: [row],
    isDisputed: status === "disputed",
    decisionReason: hasValue ? "single_source" : "no_active_rows",
    decisionTrace: [],
    proposedDisputes: [],
    canonicalIsProjection: false,
  };
}

test("all seven states have valid and mutually distinct storage shapes", () => {
  assert.equal(new Set(DATA_VALUE_STATUSES).size, 7);
  for (const status of DATA_VALUE_STATUSES) {
    const hasValue = status === "observed" || status === "disputed";
    assert.deepEqual(
      validateDataValueState({
        status,
        hasValue,
        reason: status === "observed" ? null : REASON[status],
      }),
      [],
      status,
    );
  }
});

test("zero is an observed value and absence states cannot smuggle zero or empty string", () => {
  assert.deepEqual(validateDataValueState({ status: "observed", hasValue: true }), []);
  for (const status of DATA_VALUE_STATUSES.filter((state) => state !== "observed" && state !== "disputed")) {
    assert.match(validateDataValueState({ status, hasValue: true, reason: "fixture" }).join(" "), /must not expose/);
  }
  assert.match(validateDataValueState({ status: "unknown", hasValue: false, reason: "" }).join(" "), /requires a reason/);
});

test("country API status preserves every stored state and dispute/rights precedence", () => {
  for (const status of DATA_VALUE_STATUSES) {
    assert.equal(buildApiDataValueStatus(output(status)).status, status);
  }
  assert.equal(publicDataValueStatus({ storedStatus: "observed", disputed: true }), "disputed");
  assert.equal(publicDataValueStatus({ storedStatus: "disputed", withheld: true }), "withheld");
});

test("indicator grouping keeps observed zero, retains disputed values, and records every absence", () => {
  const rows = DATA_VALUE_STATUSES.map((status, index) => ({
    dimension: "democratic_quality",
    indicator: "fixture_indicator",
    sourceId: "fixture",
    nativeMin: 0,
    nativeMax: 100,
    isInverted: false,
    year: 2000 + index,
    value: status === "observed" || status === "disputed" ? 0 : null,
    valueStatus: status,
    valueStatusReason: status === "observed" ? null : REASON[status],
  }));
  const [series] = buildIndicatorHistorySeries(rows);
  assert.deepEqual(series.points, [
    { year: 2000, value: 0 },
    { year: 2005, value: 0 },
  ]);
  assert.deepEqual(series.availability.map((row) => row.status), DATA_VALUE_STATUSES.slice(1));
});

test("export rows preserve all states instead of collapsing absent values to zero or empty text", () => {
  for (const status of DATA_VALUE_STATUSES) {
    const hasValue = status === "observed" || status === "disputed";
    const row = zCountryExportFact.parse({
      category: "demographics",
      key: `fixture_${status}`,
      value: hasValue ? "0" : null,
      numericValue: hasValue ? 0 : null,
      unit: "people",
      year: 2025,
      valueStatus: status,
      valueStatusReason: status === "observed" ? null : REASON[status],
    });
    assert.equal(row.valueStatus, status);
    assert.equal(row.numericValue, hasValue ? 0 : null);
  }
});

test("shared UI renders every state with a distinct label and never substitutes a dash", () => {
  const rendered = DATA_VALUE_STATUSES.map((status) =>
    renderToStaticMarkup(
      createElement(
        DataValueState,
        { status, reason: status === "observed" ? null : REASON[status] },
        0,
      ),
    ),
  );
  assert.equal(rendered[0], "0");
  for (let index = 1; index < rendered.length; index++) {
    assert.match(rendered[index], new RegExp(dataValueStatusLabel(DATA_VALUE_STATUSES[index]), "i"));
    assert.doesNotMatch(rendered[index], />—</);
  }
  assert.equal(new Set(rendered).size, DATA_VALUE_STATUSES.length);
});

test("forward migration constrains country facts and both indicator stores", () => {
  const sql = readFileSync("drizzle/migrations/0023_data_value_states.sql", "utf8");
  for (const table of ["country_facts", "indicator_history", "country_metrics"]) {
    assert.match(sql, new RegExp(`ALTER TABLE "${table}"`));
    assert.match(sql, new RegExp(`${table}_value_status_allowed`));
    assert.match(sql, new RegExp(`${table}_value_status_shape`));
    assert.match(sql, new RegExp(`${table}_value_status_reason`));
  }
  for (const status of DATA_VALUE_STATUSES) assert.match(sql, new RegExp(`'${status}'`));
});
