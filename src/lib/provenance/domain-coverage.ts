export const DOMAIN_COVERAGE_VERSION = "atlas-domain-coverage/v1" as const;

export const DOMAIN_IDS = [
  "elections",
  "constitutions",
  "offices",
  "people",
  "parties",
  "organizations",
  "bills",
  "indicators",
  "images",
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

export type CoverageThreshold = {
  countryCoverageWarnBelow: number;
  fieldCompletenessWarnBelow: number;
  staleAfterDays: number;
};

export type DomainSourceInput = {
  id: string;
  label: string;
  family: string;
  lastSuccessfulRun: string | null;
};

export type DomainCoverageInput = {
  id: DomainId;
  label: string;
  recordLabel: string;
  recordCount: number;
  jurisdictionsCovered: number;
  completeness: Array<{
    field: string;
    label: string;
    complete: number;
    total: number;
  }>;
  sources: DomainSourceInput[];
  lastSuccessfulRun: string | null;
  knownGaps: string[];
  threshold: CoverageThreshold;
};

export type DomainCoverageRow = Omit<DomainCoverageInput, "completeness"> & {
  eligibleJurisdictions: number;
  countryCoveragePercent: number;
  completeness: Array<DomainCoverageInput["completeness"][number] & {
    percent: number;
  }>;
  alerts: Array<{
    code: "country_coverage" | "field_completeness" | "stale" | "run_unknown" | "source_stale" | "source_run_unknown";
    severity: "warning";
    message: string;
  }>;
  status: "current" | "attention";
};

export type DomainCoverageReport = {
  schemaVersion: typeof DOMAIN_COVERAGE_VERSION;
  generatedAt: string;
  scope: {
    jurisdictionTaxonomy: "jurisdiction-status/v1";
    eligibleClass: "sovereign_state";
    eligibleJurisdictions: number;
    rule: string;
  };
  domains: DomainCoverageRow[];
  summary: {
    domains: number;
    current: number;
    attention: number;
    alerts: number;
  };
};

const round = (value: number) => Math.round(value * 10) / 10;
const percent = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : round((numerator / denominator) * 100);

function ageDays(earlier: string, later: string) {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 86_400_000;
}

export function buildDomainCoverageReport(input: {
  generatedAt: string;
  eligibleJurisdictions: number;
  domains: DomainCoverageInput[];
}): DomainCoverageReport {
  if (!Number.isFinite(new Date(input.generatedAt).getTime())) {
    throw new Error("generatedAt must be an ISO date");
  }
  if (!Number.isInteger(input.eligibleJurisdictions) || input.eligibleJurisdictions <= 0) {
    throw new Error("eligibleJurisdictions must be a positive integer");
  }
  const ids = input.domains.map((row) => row.id);
  if (
    ids.length !== DOMAIN_IDS.length ||
    new Set(ids).size !== DOMAIN_IDS.length ||
    DOMAIN_IDS.some((id) => !ids.includes(id))
  ) {
    throw new Error("coverage input must contain each required domain exactly once");
  }

  const domains = DOMAIN_IDS.map((id) => input.domains.find((row) => row.id === id)!)
    .map((row): DomainCoverageRow => {
      if (
        row.recordCount < 0 ||
        row.jurisdictionsCovered < 0 ||
        row.jurisdictionsCovered > input.eligibleJurisdictions
      ) {
        throw new Error(`${row.id} has invalid counts`);
      }
      if (!row.knownGaps.length) throw new Error(`${row.id} must disclose known gaps`);
      const completeness = row.completeness.map((metric) => {
        if (metric.total < 0 || metric.complete < 0 || metric.complete > metric.total) {
          throw new Error(`${row.id}.${metric.field} has invalid completeness counts`);
        }
        return { ...metric, percent: percent(metric.complete, metric.total) };
      });
      const countryCoveragePercent = percent(
        row.jurisdictionsCovered,
        input.eligibleJurisdictions,
      );
      const alerts: DomainCoverageRow["alerts"] = [];
      if (countryCoveragePercent < row.threshold.countryCoverageWarnBelow) {
        alerts.push({
          code: "country_coverage",
          severity: "warning",
          message: `${row.label} covers ${countryCoveragePercent}% of eligible jurisdictions; alert threshold is ${row.threshold.countryCoverageWarnBelow}%.`,
        });
      }
      for (const metric of completeness) {
        if (metric.percent < row.threshold.fieldCompletenessWarnBelow) {
          alerts.push({
            code: "field_completeness",
            severity: "warning",
            message: `${row.label}: ${metric.label} is ${metric.percent}% complete; alert threshold is ${row.threshold.fieldCompletenessWarnBelow}%.`,
          });
        }
      }
      if (!row.lastSuccessfulRun) {
        alerts.push({
          code: "run_unknown",
          severity: "warning",
          message: `${row.label} has no recorded successful-run timestamp.`,
        });
      } else if (ageDays(row.lastSuccessfulRun, input.generatedAt) > row.threshold.staleAfterDays) {
        alerts.push({
          code: "stale",
          severity: "warning",
          message: `${row.label}'s last successful run is older than ${row.threshold.staleAfterDays} days.`,
        });
      }
      for (const source of row.sources) {
        if (!source.lastSuccessfulRun) {
          alerts.push({
            code: "source_run_unknown",
            severity: "warning",
            message: `${row.label}: ${source.label} has no recorded successful-run timestamp.`,
          });
        } else if (ageDays(source.lastSuccessfulRun, input.generatedAt) > row.threshold.staleAfterDays) {
          alerts.push({
            code: "source_stale",
            severity: "warning",
            message: `${row.label}: ${source.label} is older than ${row.threshold.staleAfterDays} days.`,
          });
        }
      }
      return {
        ...row,
        eligibleJurisdictions: input.eligibleJurisdictions,
        countryCoveragePercent,
        completeness,
        alerts,
        status: alerts.length ? "attention" : "current",
      };
    });

  return {
    schemaVersion: DOMAIN_COVERAGE_VERSION,
    generatedAt: input.generatedAt,
    scope: {
      jurisdictionTaxonomy: "jurisdiction-status/v1",
      eligibleClass: "sovereign_state",
      eligibleJurisdictions: input.eligibleJurisdictions,
      rule: "Country coverage uses only jurisdiction-status/v1 sovereign_state rows; territories, dependencies, disputed entities, associated states, and aggregates are outside the denominator.",
    },
    domains,
    summary: {
      domains: domains.length,
      current: domains.filter((row) => row.status === "current").length,
      attention: domains.filter((row) => row.status === "attention").length,
      alerts: domains.reduce((sum, row) => sum + row.alerts.length, 0),
    },
  };
}

export function validateDomainCoverageReport(report: DomainCoverageReport) {
  const rebuilt = buildDomainCoverageReport({
    generatedAt: report.generatedAt,
    eligibleJurisdictions: report.scope.eligibleJurisdictions,
    domains: report.domains.map((row) => ({
      id: row.id,
      label: row.label,
      recordLabel: row.recordLabel,
      recordCount: row.recordCount,
      jurisdictionsCovered: row.jurisdictionsCovered,
      completeness: row.completeness.map((metric) => ({
        field: metric.field,
        label: metric.label,
        complete: metric.complete,
        total: metric.total,
      })),
      sources: row.sources,
      lastSuccessfulRun: row.lastSuccessfulRun,
      knownGaps: row.knownGaps,
      threshold: row.threshold,
    })),
  });
  if (JSON.stringify(rebuilt) !== JSON.stringify(report)) {
    throw new Error("checked domain coverage report differs from its source counts or alert policy");
  }
}
