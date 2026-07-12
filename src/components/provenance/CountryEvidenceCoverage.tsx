import Link from "next/link";

import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { DataValueState } from "@/components/DataValueState";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";
import rawAudit from "@/lib/factbook/reconcile/reconciliation-audit.generated.json";
import type { ReconciliationAuditReport } from "@/lib/factbook/reconcile/reconciliation-audit";
import {
  buildCountryEvidenceCoverage,
  type CountryEvidenceCoverage as CountryEvidenceCoverageModel,
} from "@/lib/provenance/country-evidence-coverage";
import rawCoverage from "@/lib/provenance/fact-coverage.generated.json";
import type { FactCoverageReport } from "@/lib/provenance/fact-coverage";

const coverageReport = rawCoverage as FactCoverageReport;
const reconciliationAudit = rawAudit as ReconciliationAuditReport;

export const COUNTRY_EVIDENCE_SUPPORTED_FACT_KEYS =
  reconciliationAudit.factPolicies
    .filter((row) => row.policy !== "unsupported")
    .map((row) => row.factKey);

const number = new Intl.NumberFormat("en-US");

function Count({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <DataValueState
        status="unknown"
        reason="The current resolver query was unavailable."
      />
    );
  }
  return number.format(value);
}

function EvidenceTable({ model }: { model: CountryEvidenceCoverageModel }) {
  const facts = model.coverage.heldFactKeyGroups;
  const registered = model.coverage.registeredFactKeys;
  const rows: Array<{
    property: string;
    count: number | null;
    denominator: string;
    meaning: string;
  }> = [
    {
      property: "Held fact-key groups",
      count: facts,
      denominator: `${number.format(registered)} registered keys`,
      meaning:
        "Registered fact keys with at least one active observation for this country or area.",
    },
    {
      property: "No active fact group",
      count: model.coverage.noActiveFactGroup,
      denominator: `${number.format(registered)} registered keys`,
      meaning:
        "Civica currently holds no active observation for the registered key. This can include genuine absence and keys that do not apply.",
    },
    {
      property: "Source-linked groups",
      count: model.coverage.sourceLinkedFactGroups,
      denominator: `${number.format(facts)} held groups`,
      meaning:
        "Every active observation resolves to source identity, terms, and a row- or source-level URL.",
    },
    {
      property: "One-source groups",
      count: model.coverage.oneSourceFactGroups,
      denominator: `${number.format(facts)} held groups`,
      meaning:
        "Only one source ID is present, so Civica makes no source-agreement claim.",
    },
    {
      property: "Two-plus producing families",
      count: model.coverage.twoPlusIndependentFamilyFactGroups,
      denominator: `${number.format(facts)} held groups`,
      meaning:
        "At least two measured observations resolve to distinct producing families after republishers are collapsed.",
    },
    {
      property: "Within-tolerance agreement",
      count: model.resolver.withinToleranceAgreement,
      denominator: model.resolver.available
        ? `${number.format(model.resolver.multiSourceFactGroups ?? 0)} current multi-source groups`
        : "Current resolver unavailable",
      meaning:
        "Multiple eligible source records agree under the fact key's registered comparison rule.",
    },
    {
      property: "Resolver-selected differences",
      count: model.resolver.resolverSelectedDifference,
      denominator: model.resolver.available
        ? `${number.format(model.resolver.multiSourceFactGroups ?? 0)} current multi-source groups`
        : "Current resolver unavailable",
      meaning:
        "Multiple eligible source records differ; the deterministic precedence rule selects the displayed row.",
    },
    {
      property: "Unresolved disputes",
      count: model.coverage.unresolvedDisputes,
      denominator: `${number.format(facts)} held groups`,
      meaning:
        "An open or in-review evidence conflict is recorded for the fact key.",
    },
    {
      property: "Stale live rows",
      count: model.coverage.staleLiveRows,
      denominator: "Active source rows",
      meaning:
        "Non-frozen rows older than the checked 180-day retrieval threshold.",
    },
  ];

  return (
    <DataTable className="country-evidence-coverage-table">
      <thead>
        <tr>
          <th>Evidence property</th>
          <th className="num">Count</th>
          <th>Denominator</th>
          <th>What it measures</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.property}>
            <td>{row.property}</td>
            <td className="num">
              <Count value={row.count} />
            </td>
            <td>{row.denominator}</td>
            <td>{row.meaning}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function CountryEvidenceCoverage({
  slug,
  countryName,
  resolverFacts,
}: {
  slug: string;
  countryName: string;
  resolverFacts: Record<string, ResolverOutput> | null;
}) {
  const coverage = coverageReport.byCountry.find((row) => row.id === slug);
  if (!coverage) {
    return (
      <Banner variant="warn">
        The checked evidence-coverage report has no country row for{" "}
        {countryName}. Civica is not substituting a zero or a country-quality
        judgment.
      </Banner>
    );
  }

  const model = buildCountryEvidenceCoverage({
    coverageSnapshotAt: coverageReport.generatedAt,
    coverage,
    registeredFactKeys: reconciliationAudit.factPolicies.length,
    resolverFacts,
  });
  const snapshotDate = new Date(model.coverageSnapshotAt).toLocaleDateString(
    "en-US",
    { dateStyle: "long", timeZone: "UTC" },
  );

  return (
    <div className="country-evidence-coverage">
      <Banner variant="info">
        This view describes Civica&apos;s evidence for {countryName}. It does
        not grade the country, its government, or its institutions.
      </Banner>
      <p className="country-evidence-coverage-dek">
        Coverage, linkage, source-family depth, disputes, and freshness come
        from the checked DAT-005 snapshot dated {snapshotDate}. Agreement and
        resolver-selected differences come from the current DAT-006/DAT-007
        resolver query. No combined confidence score is calculated.
      </p>
      <EvidenceTable model={model} />
      <p className="country-evidence-coverage-links">
        Read the complete{" "}
        <Link href="/methodology/provenance-coverage">
          provenance coverage report
        </Link>{" "}
        and the{" "}
        <Link href="/country/methodology/reconciliation">
          reconciliation rules
        </Link>
        .
      </p>
    </div>
  );
}
