import type {
  DecisionReason,
  FactRow,
  ResolverOutput,
} from "./types";
import {
  resolveSourceLineage,
  type SourceLineage,
} from "./source-independence";

const DECISION_LABELS: Record<DecisionReason, string> = {
  single_source: "Single-source selection",
  agreement: "Sources agree within the registered tolerance",
  fresher_winner: "Fresher or higher-precedence observation selected",
  incumbent_held: "Existing canonical observation retained",
  cia_default_group_a: "Identity rule retained the CIA observation",
  cia_default_group_c: "Narrative rule retained the CIA observation",
  no_active_rows: "No eligible observation",
};

export type FactEvidenceSummary = {
  posture: "single_source" | "agreement" | "resolver_selected" | "unavailable";
  heading: string;
  explanation: string;
  sourceRecordCount: number;
  verifiedFamilyCount: number;
  unverifiedLineageCount: number;
  rationale: string;
};

function eligibleRows(output: ResolverOutput): FactRow[] {
  const active = output.all.filter((row) => row.status === "active");
  const measured = active.filter((row) => row.valueType !== "projected");
  return measured.length > 0 ? measured : active;
}

export function lineageForFactRow(
  row: FactRow,
  factKey: string,
  jurisdictionIso3?: string | null,
): SourceLineage {
  return resolveSourceLineage({
    sourceId: row.sourceId,
    factKey,
    jurisdictionIso3,
  });
}

export function buildFactEvidenceSummary(
  output: ResolverOutput,
  jurisdictionIso3?: string | null,
): FactEvidenceSummary {
  const rows = eligibleRows(output);
  const sourceRecordCount = new Set(rows.map((row) => row.sourceId)).size;
  const lineages = rows.map((row) =>
    lineageForFactRow(row, output.factKey, jurisdictionIso3),
  );
  const verifiedFamilyCount = new Set(
    lineages
      .filter((lineage) => lineage.independentEligible)
      .map((lineage) => lineage.familyId),
  ).size;
  const unverifiedLineageCount = lineages.filter(
    (lineage) => !lineage.independentEligible,
  ).length;
  const rationale =
    output.decisionTrace.find((step) => step.code === "precedence_rule")
      ?.detail ?? DECISION_LABELS[output.decisionReason];

  if (!output.canonical || sourceRecordCount === 0) {
    return {
      posture: "unavailable",
      heading: "No eligible observation",
      explanation:
        "Civica has not selected a value. Stored rejected or unavailable rows remain audit evidence, not a canonical fact.",
      sourceRecordCount,
      verifiedFamilyCount,
      unverifiedLineageCount,
      rationale,
    };
  }

  if (sourceRecordCount === 1) {
    return {
      posture: "single_source",
      heading: "Single-source fact",
      explanation:
        "Only one eligible source record is available. Civica reports that source directly and makes no source-agreement claim.",
      sourceRecordCount,
      verifiedFamilyCount,
      unverifiedLineageCount,
      rationale,
    };
  }

  const familyNote = `${verifiedFamilyCount} verified producing ${verifiedFamilyCount === 1 ? "family" : "families"}${unverifiedLineageCount > 0 ? `; ${unverifiedLineageCount} record${unverifiedLineageCount === 1 ? " has" : "s have"} unverified or compilation lineage` : ""}.`;
  if (output.decisionReason === "agreement") {
    return {
      posture: "agreement",
      heading: "Source records agree",
      explanation: `${sourceRecordCount} eligible source records agree within this fact's registered tolerance. ${familyNote} Records from one producing family are not counted as independent corroboration.`,
      sourceRecordCount,
      verifiedFamilyCount,
      unverifiedLineageCount,
      rationale,
    };
  }

  return {
    posture: "resolver_selected",
    heading: "Source records differ",
    explanation: `${sourceRecordCount} eligible source records do not resolve as simple agreement. ${familyNote} Civica applies the published deterministic resolver; this is not a vote among sources.`,
    sourceRecordCount,
    verifiedFamilyCount,
    unverifiedLineageCount,
    rationale,
  };
}

