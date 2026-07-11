import assert from "node:assert/strict";
import test from "node:test";
import {
  QUALITY_CATEGORIES,
  evaluateReleaseQuality,
  formatQualityIssue,
  type QualityFact,
  type ReleaseQualityPolicy,
  type ReleaseQualitySnapshot,
} from "./release-quality";
import { releaseQualityReportErrors } from "./release-quality-validation";

const NOW = "2026-07-10T12:00:00.000Z";

function policy(): ReleaseQualityPolicy {
  return {
    sourceMaxAgeDays: 180,
    minimumVintageYear: 1500,
    maximumFutureYears: 10,
    rowCounts: {},
  };
}

function snapshot(): ReleaseQualitySnapshot {
  return {
    generatedAt: NOW,
    identifiers: [
      { namespace: "jurisdiction.slug", entityId: "j1", value: "alpha", required: true },
      { namespace: "source.id", entityId: "source-1", value: "source-1", required: true },
    ],
    jurisdictions: [
      {
        id: "j1",
        slug: "alpha",
        name: "Alpha",
        status: "dependency_or_territory",
        statusSourceIds: ["source-1"],
        statusReviewedAt: "2026-01-01",
        activeFactCount: 0,
      },
    ],
    facts: [],
    vintages: [],
    statements: [],
    sources: [
      {
        id: "source-1",
        name: "Source One",
        license: "CC0",
        lastSyncAt: NOW,
        activeReferenceCount: 0,
        frozen: false,
      },
    ],
    subjectIds: { jurisdictions: ["j1"] },
    rowCounts: {},
  };
}

function fact(overrides: Partial<QualityFact> = {}): QualityFact {
  return {
    id: "fact-1",
    jurisdictionId: "j1",
    factKey: "population_total",
    factGroup: "B",
    category: "demographics",
    sourceId: "source-1",
    factValue: "1,000,000",
    factValueNumeric: 1_000_000,
    factUnit: "people",
    factYear: 2025,
    dataVintageYear: null,
    valueJson: null,
    valueType: "measured",
    ...overrides,
  };
}

function expectOnlyCategory(
  category: (typeof QUALITY_CATEGORIES)[number],
  mutate: (input: ReleaseQualitySnapshot, configured: ReleaseQualityPolicy) => void,
) {
  const input = snapshot();
  const configured = policy();
  mutate(input, configured);
  const report = evaluateReleaseQuality(input, configured);
  const check = report.checks.find((row) => row.category === category);
  assert.equal(report.status, "fail");
  assert.equal(check?.status, "fail");
  assert.ok(check && check.issueCount >= 1);
  const issue = report.issues.find((row) => row.category === category);
  assert.ok(issue);
  assert.ok(issue.remediation.length > 12);
  assert.match(formatQualityIssue(issue), /Fix:/);
}

test("clean release fixture runs every invariant and passes", () => {
  const report = evaluateReleaseQuality(snapshot(), policy());
  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((row) => row.category), QUALITY_CATEGORIES);
  assert.ok(report.checks.every((row) => row.status === "pass"));
});

test("seeded duplicate identifier fails with an actionable owner repair", () => {
  expectOnlyCategory("identifier_uniqueness", (input) => {
    input.identifiers.push({ namespace: "jurisdiction.slug", entityId: "j2", value: "ALPHA" });
  });
});

test("seeded sovereign coverage gap fails", () => {
  expectOnlyCategory("jurisdiction_coverage", (input) => {
    input.jurisdictions[0].status = "sovereign_state";
  });
});

test("seeded impossible numeric value fails its registered envelope", () => {
  expectOnlyCategory("impossible_range", (input) => {
    input.facts.push(fact({ factValueNumeric: -5 }));
  });
});

test("seeded unit and vintage mismatch fails", () => {
  expectOnlyCategory("unit_vintage_consistency", (input) => {
    input.facts.push(fact({ factUnit: "millions", dataVintageYear: 2026, factYear: 2025 }));
  });
});

test("seeded orphan statement subject fails provenance", () => {
  expectOnlyCategory("orphan_provenance", (input) => {
    input.statements.push({ id: "st-1", subjectTable: "jurisdictions", subjectId: "missing", sourceId: "source-1" });
  });
});

test("seeded duplicate canonical candidate fails", () => {
  expectOnlyCategory("duplicate_canonical", (input) => {
    input.facts.push(fact(), fact({ id: "fact-2" }));
  });
});

test("seeded required-field omission fails", () => {
  expectOnlyCategory("missing_required", (input) => {
    input.jurisdictions[0].name = "";
  });
});

test("seeded row-count drop fails the reviewed window", () => {
  expectOnlyCategory("unexpected_row_delta", (input, configured) => {
    input.rowCounts.country_facts = 5;
    configured.rowCounts.country_facts = { baseline: 100, minimum: 90, maximum: 110 };
  });
});

test("seeded stale production source fails", () => {
  expectOnlyCategory("source_age", (input) => {
    input.sources[0].activeReferenceCount = 1;
    input.sources[0].lastSyncAt = "2025-01-01T00:00:00.000Z";
  });
});

test("frozen and unused sources are exempt from operational source age", () => {
  const input = snapshot();
  input.sources[0].lastSyncAt = null;
  input.sources[0].frozen = true;
  input.sources[0].activeReferenceCount = 50;
  assert.equal(evaluateReleaseQuality(input, policy()).status, "pass");
  input.sources[0].frozen = false;
  input.sources[0].activeReferenceCount = 0;
  assert.equal(evaluateReleaseQuality(input, policy()).status, "pass");
});

test("checked-report validator rejects a missing invariant family", () => {
  const configured = policy();
  const report = evaluateReleaseQuality(snapshot(), configured);
  report.checks = report.checks.filter((check) => check.category !== "source_age");
  assert.match(releaseQualityReportErrors(report, configured).join("\n"), /every required quality category/);
});
