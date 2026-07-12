import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDomainCoverageReport,
  DOMAIN_IDS,
  type DomainCoverageInput,
  validateDomainCoverageReport,
} from "./domain-coverage";

const domain = (id: (typeof DOMAIN_IDS)[number]): DomainCoverageInput => ({
  id,
  label: id,
  recordLabel: "records",
  recordCount: 9,
  jurisdictionsCovered: 9,
  completeness: [
    { field: "required", label: "Required field", complete: 8, total: 9 },
  ],
  sources: [
    {
      id: "source",
      label: "Source",
      family: "publisher",
      lastSuccessfulRun: "2026-07-09T00:00:00.000Z",
    },
  ],
  lastSuccessfulRun: "2026-07-09T00:00:00.000Z",
  knownGaps: ["Fixture limitation."],
  threshold: {
    countryCoverageWarnBelow: 80,
    fieldCompletenessWarnBelow: 80,
    staleAfterDays: 30,
  },
});

test("all declared domains build in canonical order and validate", () => {
  const report = buildDomainCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    eligibleJurisdictions: 10,
    domains: [...DOMAIN_IDS].reverse().map(domain),
  });
  assert.deepEqual(
    report.domains.map((row) => row.id),
    DOMAIN_IDS,
  );
  assert.equal(report.summary.current, DOMAIN_IDS.length);
  assert.ok(
    report.domains.every(
      ({ releaseReadiness, publicBehavior }) =>
        releaseReadiness === "meets_declared_minimums" &&
        publicBehavior === "publish_with_coverage_status_and_known_gaps",
    ),
  );
  assert.doesNotThrow(() => validateDomainCoverageReport(report));
});

test("coverage, completeness, stale, and missing-run thresholds emit alerts", () => {
  const domains = DOMAIN_IDS.map(domain);
  domains[0] = { ...domains[0], jurisdictionsCovered: 1 };
  domains[1] = {
    ...domains[1],
    completeness: [{ field: "x", label: "X", complete: 1, total: 9 }],
  };
  domains[2] = { ...domains[2], lastSuccessfulRun: "2025-01-01T00:00:00.000Z" };
  domains[3] = { ...domains[3], lastSuccessfulRun: null };
  const report = buildDomainCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    eligibleJurisdictions: 10,
    domains,
  });
  assert.deepEqual(
    report.domains.slice(0, 4).map((row) => row.alerts[0].code),
    ["country_coverage", "field_completeness", "stale", "run_unknown"],
  );
});

test("missing domains, impossible counts, and undisclosed gaps fail closed", () => {
  const base = {
    generatedAt: "2026-07-10T00:00:00.000Z",
    eligibleJurisdictions: 10,
  };
  assert.throws(
    () =>
      buildDomainCoverageReport({
        ...base,
        domains: DOMAIN_IDS.slice(1).map(domain),
      }),
    /each required domain/,
  );
  assert.throws(
    () =>
      buildDomainCoverageReport({
        ...base,
        domains: DOMAIN_IDS.map((id) =>
          id === "people"
            ? { ...domain(id), jurisdictionsCovered: 11 }
            : domain(id),
        ),
      }),
    /invalid counts/,
  );
  assert.throws(
    () =>
      buildDomainCoverageReport({
        ...base,
        domains: DOMAIN_IDS.map((id) =>
          id === "images" ? { ...domain(id), knownGaps: [] } : domain(id),
        ),
      }),
    /disclose known gaps/,
  );
});
