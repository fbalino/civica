import test from "node:test";
import assert from "node:assert/strict";
import {
  GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
  GOVERNANCE_EVIDENCE_INDICATORS,
  GOVERNANCE_EVIDENCE_SERIES,
  buildGovernanceEvidenceExport,
  formatNativeEvidenceValue,
  formatUncertaintyStatus,
  governanceEvidenceRights,
  type GovernanceEvidenceRow,
} from "./governance-evidence";

test("dashboard preserves five native publisher observations without a composite", () => {
  assert.equal(GOVERNANCE_EVIDENCE_INDICATORS.length, 5);
  assert.equal(
    new Set(GOVERNANCE_EVIDENCE_INDICATORS.map((row) => row.identity)).size,
    5,
  );
  assert.equal(formatNativeEvidenceValue(0.81234, 0, 1), "0.812");
  assert.equal(formatNativeEvidenceValue(71, 0, 100), "71.0");
  assert.equal(
    formatUncertaintyStatus("publisher_90pct_interval"),
    "Publisher 90% interval",
  );
  assert.equal(
    governanceEvidenceRights("worldbank_wgi").exportPermission,
    "allowed",
  );
  assert.notEqual(
    governanceEvidenceRights("freedom_house").exportPermission,
    "allowed",
  );
});

test("rights-safe export retains allowed observations and withholds blocked values", () => {
  const base = {
    sourceOwner: "Owner",
    indicatorId: "x",
    label: "X",
    construct: "X",
    direction: "Higher",
    valueStatus: "observed",
    missingReason: null,
    nativeUnit: "points",
    nativeMin: 0,
    nativeMax: 100,
    uncertaintyLower: 1,
    uncertaintyUpper: 2,
    uncertaintyStatus: "published",
    sourceVintage: "2024",
    seriesType: "harmonized_backcast",
    artifactHash: "a".repeat(64),
    sourceUrl: "https://example.com",
    lastSyncAt: null,
    termsUrl: "https://example.com/terms",
  };
  const rows = [
    {
      ...base,
      sourceId: "worldbank_wgi",
      value: 5,
      exportPermission: "allowed",
    },
    {
      ...base,
      sourceId: "freedom_house",
      value: 6,
      exportPermission: "blocked",
    },
  ] as GovernanceEvidenceRow[];
  const output = buildGovernanceEvidenceExport({
    country: { slug: "test" },
    year: 2024,
    releaseId: "r",
    series: GOVERNANCE_EVIDENCE_SERIES,
    availableSeriesTypes: GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
    rows,
  });
  assert.equal(output.rows[0].value, 5);
  assert.equal(output.rows[1].value, null);
  assert.equal(output.rows[1].valueStatus, "withheld");
});

test("export projections drop future and internal fields at every spread-prone boundary", () => {
  const row = {
    sourceOwner: "Owner",
    indicatorId: "x",
    label: "X",
    construct: "X",
    direction: "Higher",
    valueStatus: "observed",
    missingReason: null,
    nativeUnit: "points",
    nativeMin: 0,
    nativeMax: 100,
    uncertaintyLower: 1,
    uncertaintyUpper: 2,
    uncertaintyStatus: "published",
    sourceVintage: "2024",
    seriesType: "harmonized_backcast",
    artifactHash: "a".repeat(64),
    sourceUrl: "https://example.com",
    lastSyncAt: null,
    termsUrl: "https://example.com/terms",
    sourceId: "worldbank_wgi",
    value: 5,
    exportPermission: "allowed",
    credentialHash: "DROP_ROW_SECRET",
  } as GovernanceEvidenceRow & { credentialHash: string };
  const evidenceWithSentinels = {
    country: {
      slug: "test",
      id: "DROP_INTERNAL_ID",
      privateNote: "DROP_COUNTRY_SECRET",
    },
    year: 2024,
    releaseId: "r",
    series: {
      ...GOVERNANCE_EVIDENCE_SERIES,
      privateMethodNote: "DROP_SERIES_SECRET",
    },
    availableSeriesTypes: GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
    rows: [row],
    futureTopLevelSecret: "DROP_TOP_SECRET",
  };
  const output = buildGovernanceEvidenceExport(evidenceWithSentinels);

  assert.deepEqual(output.country, { slug: "test" });
  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /DROP_|credentialHash|privateMethodNote/);
});
