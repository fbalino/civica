import type { ResolverOutput } from "@/lib/factbook/reconcile/types";
import type { CoverageBreakdown } from "./fact-coverage";

export const COUNTRY_EVIDENCE_COVERAGE_VERSION =
  "country-evidence-coverage/v1" as const;

export type CountryEvidenceCoverage = {
  schemaVersion: typeof COUNTRY_EVIDENCE_COVERAGE_VERSION;
  coverageSnapshotAt: string;
  coverage: {
    registeredFactKeys: number;
    heldFactKeyGroups: number;
    noActiveFactGroup: number;
    sourceLinkedFactGroups: number;
    oneSourceFactGroups: number;
    twoPlusIndependentFamilyFactGroups: number;
    unresolvedDisputes: number;
    staleLiveRows: number;
  };
  resolver: {
    available: boolean;
    evaluatedFactGroups: number | null;
    multiSourceFactGroups: number | null;
    withinToleranceAgreement: number | null;
    resolverSelectedDifference: number | null;
  };
};

function eligibleSourceCount(output: ResolverOutput): number {
  const active = output.all.filter((row) => row.status === "active");
  const measured = active.filter((row) => row.valueType !== "projected");
  const pool = measured.length > 0 ? measured : active;
  return new Set(pool.map((row) => row.sourceId)).size;
}

export function buildCountryEvidenceCoverage(input: {
  coverageSnapshotAt: string;
  coverage: CoverageBreakdown;
  registeredFactKeys: number;
  resolverFacts: Record<string, ResolverOutput> | null;
}): CountryEvidenceCoverage {
  if (!Number.isFinite(Date.parse(input.coverageSnapshotAt))) {
    throw new Error("invalid coverage snapshot time");
  }
  if (input.coverage.facts > input.registeredFactKeys) {
    throw new Error("country fact groups exceed the registered fact-key set");
  }
  const outputs = input.resolverFacts
    ? Object.values(input.resolverFacts).filter((output) => output.canonical)
    : null;
  const agreement =
    outputs?.filter(
      (output) =>
        eligibleSourceCount(output) > 1 &&
        output.decisionReason === "agreement",
    ).length ?? null;
  const multiSource =
    outputs?.filter((output) => eligibleSourceCount(output) > 1).length ?? null;
  const selectedDifference =
    outputs?.filter(
      (output) =>
        eligibleSourceCount(output) > 1 &&
        output.decisionReason !== "agreement",
    ).length ?? null;

  return {
    schemaVersion: COUNTRY_EVIDENCE_COVERAGE_VERSION,
    coverageSnapshotAt: input.coverageSnapshotAt,
    coverage: {
      registeredFactKeys: input.registeredFactKeys,
      heldFactKeyGroups: input.coverage.facts,
      noActiveFactGroup: input.registeredFactKeys - input.coverage.facts,
      sourceLinkedFactGroups: input.coverage.sourceLinkedFacts,
      oneSourceFactGroups: input.coverage.oneSourceFacts,
      twoPlusIndependentFamilyFactGroups:
        input.coverage.twoPlusIndependentSourceFacts,
      unresolvedDisputes: input.coverage.unresolvedDisputes,
      staleLiveRows: input.coverage.staleRows,
    },
    resolver: {
      available: outputs !== null,
      evaluatedFactGroups: outputs?.length ?? null,
      multiSourceFactGroups: multiSource,
      withinToleranceAgreement: agreement,
      resolverSelectedDifference: selectedDifference,
    },
  };
}
