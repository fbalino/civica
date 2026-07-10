import type { FactKeyDefinition } from "./fact-keys";
import { resolveSourceLineage, type SourceLineage } from "./source-independence";

export const RECONCILIATION_AUDIT_VERSION = "reconciliation-coverage/v1" as const;

export type ReconciliationPolicy =
  | "single_source_passthrough"
  | "multi_source_resolver"
  | "manual_review"
  | "unsupported";

export type AuditFactRow = {
  jurisdictionId: string;
  jurisdictionIso3: string | null;
  factKey: string;
  sourceId: string;
  valueType: string | null;
};

export type FactPolicyAudit = {
  factKey: string;
  label: string;
  group: string;
  policy: ReconciliationPolicy;
  activeRows: number;
  jurisdictions: number;
  sourceIds: string[];
  reason: string;
};

export type ReconciliationAuditReport = {
  schemaVersion: typeof RECONCILIATION_AUDIT_VERSION;
  generatedAt: string;
  registry: {
    totalFactKeys: number;
    supportedFactKeys: number;
    unsupportedFactKeys: number;
    policyCounts: Record<ReconciliationPolicy, number>;
  };
  lineage: {
    rule: string;
    activeSourceFactPairs: number;
    unverifiedSourceFactPairs: number;
    relationships: SourceLineage[];
  };
  factPolicies: FactPolicyAudit[];
};

export function policyForFact(
  definition: FactKeyDefinition,
  rows: AuditFactRow[],
): Pick<FactPolicyAudit, "policy" | "reason"> {
  if (rows.length === 0) {
    return {
      policy: "unsupported",
      reason: "No active observation exists; the key remains registered but is not published as covered.",
    };
  }
  if (definition.group === "A" || definition.group === "C") {
    return {
      policy: "manual_review",
      reason: `Group ${definition.group} changes require the incumbent rule and reviewer signoff for overrides.`,
    };
  }
  const sources = new Set(rows.map((row) => row.sourceId));
  if (sources.size === 1) {
    return {
      policy: "single_source_passthrough",
      reason: "Only one active source is connected; the value passes through with provenance and plausibility checks.",
    };
  }
  return {
    policy: "multi_source_resolver",
    reason: "Multiple active sources are connected; the deterministic Group B resolver selects the displayed observation.",
  };
}

export function buildReconciliationAudit(input: {
  generatedAt: string;
  factDefinitions: FactKeyDefinition[];
  facts: AuditFactRow[];
}): ReconciliationAuditReport {
  if (!Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error("invalid generatedAt");
  }
  const rowsByKey = new Map<string, AuditFactRow[]>();
  for (const row of input.facts) {
    rowsByKey.set(row.factKey, [...(rowsByKey.get(row.factKey) ?? []), row]);
  }

  const factPolicies = input.factDefinitions
    .map((definition) => {
      const rows = rowsByKey.get(definition.key) ?? [];
      const policy = policyForFact(definition, rows);
      return {
        factKey: definition.key,
        label: definition.label,
        group: definition.group,
        ...policy,
        activeRows: rows.length,
        jurisdictions: new Set(rows.map((row) => row.jurisdictionId)).size,
        sourceIds: [...new Set(rows.map((row) => row.sourceId))].sort(),
      };
    })
    .sort((a, b) => a.factKey.localeCompare(b.factKey));

  const lineageByPair = new Map<string, SourceLineage>();
  for (const row of input.facts) {
    const lineage = resolveSourceLineage({
      sourceId: row.sourceId,
      factKey: row.factKey,
      jurisdictionIso3: row.jurisdictionIso3,
    });
    const key = `${row.sourceId}\u0000${row.factKey}\u0000${lineage.familyId}`;
    lineageByPair.set(key, lineage);
  }
  const relationships = [...lineageByPair.values()].sort(
    (a, b) =>
      a.factKey.localeCompare(b.factKey) ||
      a.sourceId.localeCompare(b.sourceId) ||
      a.familyId.localeCompare(b.familyId),
  );

  const count = (policy: ReconciliationPolicy) =>
    factPolicies.filter((row) => row.policy === policy).length;
  return {
    schemaVersion: RECONCILIATION_AUDIT_VERSION,
    generatedAt: input.generatedAt,
    registry: {
      totalFactKeys: factPolicies.length,
      supportedFactKeys: factPolicies.filter((row) => row.policy !== "unsupported").length,
      unsupportedFactKeys: count("unsupported"),
      policyCounts: {
        single_source_passthrough: count("single_source_passthrough"),
        multi_source_resolver: count("multi_source_resolver"),
        manual_review: count("manual_review"),
        unsupported: count("unsupported"),
      },
    },
    lineage: {
      rule: "Evidence is independent only when claim-level lineage resolves to distinct producing families. Republishers share the upstream family; projections are not corroborating measurements; compilations and unknown lineage fail closed.",
      activeSourceFactPairs: relationships.length,
      unverifiedSourceFactPairs: relationships.filter(
        (row) => row.relationship === "unverified",
      ).length,
      relationships,
    },
    factPolicies,
  };
}
