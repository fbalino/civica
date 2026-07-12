import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { buildIndicatorHistorySeries } from "@/lib/db/queries";
import {
  buildIndicatorHistoryExport,
  indicatorHistoryExportCsv,
} from "@/lib/exports/indicator-history-export";
import type { SourceRightsRecord } from "@/lib/rights/manifest";
import {
  INDICATOR_HISTORY_CATALOG,
  indicatorObservationBreaks,
} from "./history-catalog";

const lineage = {
  upstreamRelease: "fixture release",
  artifactHash: "a".repeat(64),
  artifactKind: "normalized_batch",
  temporalCoverage: "2000/2025",
  licenseUrl: "https://example.test/terms",
  transformationId: "fixture/v1",
  substitutionReason: null,
  methodVersion: "fixture/v1",
};

function row(year: number, sourceId = "worldbank_wgi") {
  return {
    dimension: "rule_of_law",
    indicator: "rl.est",
    sourceId,
    nativeMin: -2.5,
    nativeMax: 2.5,
    isInverted: false,
    year,
    value: 0,
    valueStatus: "observed",
    valueStatusReason: null,
    ...lineage,
  };
}

function rights(
  sourceId: string,
  publicExport: SourceRightsRecord["publicExport"],
): SourceRightsRecord {
  return {
    sourceId,
    licenseId: publicExport === "allowed" ? "CC-BY-4.0" : "PENDING",
    termsUrl: "https://example.test/terms",
    reviewStatus: publicExport === "allowed" ? "verified" : "pending",
    reviewedAt: publicExport === "allowed" ? "2026-07-12" : null,
    publicExport,
    commercialUse: publicExport === "allowed" ? true : null,
    derivatives: publicExport === "allowed" ? true : null,
    attributionRequired: publicExport === "allowed" ? true : null,
    shareAlikeRequired: false,
    restrictions: [],
  };
}

test("catalog documents every production history adapter", () => {
  assert.equal(INDICATOR_HISTORY_CATALOG.length, 5);
  for (const entry of INDICATOR_HISTORY_CATALOG) {
    assert.ok(entry.label);
    assert.ok(entry.definition);
    assert.ok(entry.unit);
    assert.ok(entry.nativeScale);
    assert.ok(entry.expectedCadence);
    assert.ok(entry.comparabilityNote);
  }
});

test("observation breaks preserve biennial cadence and expose longer holes", () => {
  assert.deepEqual(indicatorObservationBreaks([1996, 1998, 2000, 2002]), []);
  assert.deepEqual(indicatorObservationBreaks([2000, 2001, 2005, 2006]), [
    { afterYear: 2001, beforeYear: 2005, unobservedYears: 3 },
  ]);
});

test("series identity includes source and retains exact lineage", () => {
  const built = buildIndicatorHistorySeries([
    row(2000, "worldbank_wgi"),
    row(2000, "other_source"),
  ]);
  assert.equal(built.length, 2);
  assert.equal(built[0].lineage.length, 1);
  assert.equal(built[0].lineage[0].artifactHash, "a".repeat(64));
});

test("country history export emits allowed values and names withheld series", () => {
  const series = buildIndicatorHistorySeries([
    row(2000, "worldbank_wgi"),
    row(2001, "worldbank_wgi"),
    { ...row(2000, "vdem"), indicator: "v2x_libdem" },
    { ...row(2001, "vdem"), indicator: "v2x_libdem" },
  ]);
  const document = buildIndicatorHistoryExport({
    generatedAt: "2026-07-12T00:00:00.000Z",
    jurisdiction: { id: "j1", slug: "fixture", name: "Fixture", iso3: "FIX" },
    series,
    sources: new Map([
      [
        "worldbank_wgi",
        {
          id: "worldbank_wgi",
          name: "World Bank",
          baseUrl: "https://example.test",
          lastSyncAt: null,
        },
      ],
      [
        "vdem",
        {
          id: "vdem",
          name: "V-Dem",
          baseUrl: "https://example.test",
          lastSyncAt: null,
        },
      ],
    ]),
    rights: new Map([
      ["worldbank_wgi", rights("worldbank_wgi", "allowed")],
      ["vdem", rights("vdem", "pending-review")],
    ]),
  });
  assert.deepEqual(
    document.series.map((entry) => entry.source.id),
    ["worldbank_wgi"],
  );
  assert.deepEqual(
    document.withheld.map((entry) => entry.sourceId),
    ["vdem"],
  );
  const csv = indicatorHistoryExportCsv(document);
  assert.match(csv, /World Bank/);
  assert.doesNotMatch(csv, /V-Dem/);
  assert.match(csv, /2000,0,observed/);
});

test("country history grouping stays within its performance budget", () => {
  const rows = Array.from({ length: 50_000 }, (_, index) =>
    row(1800 + index, "worldbank_wgi"),
  );
  const started = performance.now();
  const [series] = buildIndicatorHistorySeries(rows);
  const elapsed = performance.now() - started;
  assert.equal(series.points.length, rows.length);
  assert.ok(elapsed < 2_500, `50k-row grouping took ${elapsed.toFixed(1)}ms`);

  const schema = readFileSync("src/lib/db/schema.ts", "utf8");
  assert.match(schema, /idx_indicator_history_jur_dim/);
  assert.match(schema, /table\.jurisdictionId,\s*table\.dimension/);
});
