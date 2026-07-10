import { FROZEN_SOURCES } from "@/lib/data/sources";
import { countIndependentFamilies } from "@/lib/factbook/reconcile/source-independence";

export const FACT_COVERAGE_VERSION = "fact-provenance-coverage/v1" as const;
export const FACT_COVERAGE_STALE_AFTER_DAYS = 180;

export type CoverageSource = {
  id: string;
  baseUrl: string | null;
  license: string;
};

export type CoverageFactRow = {
  id: string;
  jurisdictionId: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  factKey: string;
  sourceId: string;
  sourceUrl: string | null;
  retrievedAt: string;
  jurisdictionIso3?: string | null;
  valueType?: string | null;
};

export type CoverageStatementRow = {
  id: string;
  subjectTable: string;
  subjectId: string;
  predicate: string;
  sourceId: string;
  sourceUrl: string | null;
  retrievedAt: string;
};

export type CoverageDisputeRow = {
  jurisdictionId: string;
  factKey: string;
  status: string;
};

export type CoverageBreakdown = {
  id: string;
  label: string;
  facts: number;
  sourceLinkedFacts: number;
  oneSourceFacts: number;
  twoPlusIndependentSourceFacts: number;
  unresolvedDisputes: number;
  staleRows: number;
};

export type FactCoverageReport = {
  schemaVersion: typeof FACT_COVERAGE_VERSION;
  generatedAt: string;
  staleness: {
    liveRowThresholdDays: number;
    frozenSourcesExcluded: true;
    rule: string;
  };
  independence: {
    rule: string;
    secondaryOrAggregatorSources: string[];
    limitation: string;
  };
  facts: {
    activeRows: number;
    total: number;
    sourceLinked: number;
    oneSource: number;
    twoPlusIndependentSources: number;
    unresolvedDisputes: number;
    staleRows: number;
    distinctJurisdictions: number;
    distinctFactKeys: number;
  };
  statements: {
    total: number;
    sourceLinked: number;
    unlinked: number;
    distinctGroups: number;
    bySubjectTable: Array<{
      subjectTable: string;
      total: number;
      sourceLinked: number;
    }>;
  };
  byCountry: CoverageBreakdown[];
  byFactKey: CoverageBreakdown[];
};

export const SECONDARY_OR_AGGREGATOR_SOURCE_IDS = new Set([
  "cia_factbook",
  "un_data",
  "wikidata",
]);

function groupKey(jurisdictionId: string, factKey: string) {
  return `${jurisdictionId}\u0000${factKey}`;
}

function isSourceLinked(
  row: { sourceId: string; sourceUrl: string | null },
  sourceById: ReadonlyMap<string, CoverageSource>,
) {
  const source = sourceById.get(row.sourceId);
  return Boolean(
    source &&
    source.license.trim() &&
    (row.sourceUrl?.trim() || source.baseUrl?.trim()),
  );
}

function isStale(
  row: { sourceId: string; retrievedAt: string },
  generatedAtMs: number,
) {
  if (FROZEN_SOURCES.has(row.sourceId)) return false;
  const retrievedAtMs = new Date(row.retrievedAt).getTime();
  if (!Number.isFinite(retrievedAtMs)) return true;
  return (
    generatedAtMs - retrievedAtMs >
    FACT_COVERAGE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
  );
}

export function buildFactCoverageReport(input: {
  generatedAt: string;
  sources: CoverageSource[];
  facts: CoverageFactRow[];
  statements: CoverageStatementRow[];
  disputes: CoverageDisputeRow[];
}): FactCoverageReport {
  const generatedAtMs = new Date(input.generatedAt).getTime();
  if (!Number.isFinite(generatedAtMs)) throw new Error("invalid generatedAt");
  const sourceById = new Map(
    input.sources.map((source) => [source.id, source]),
  );
  const unresolved = new Set(
    input.disputes
      .filter((row) => row.status === "open" || row.status === "in_review")
      .map((row) => groupKey(row.jurisdictionId, row.factKey)),
  );

  type Group = {
    countryId: string;
    countrySlug: string;
    countryName: string;
    factKey: string;
    rows: CoverageFactRow[];
  };
  const groups = new Map<string, Group>();
  for (const row of input.facts) {
    const key = groupKey(row.jurisdictionId, row.factKey);
    const group = groups.get(key) ?? {
      countryId: row.jurisdictionId,
      countrySlug: row.jurisdictionSlug,
      countryName: row.jurisdictionName,
      factKey: row.factKey,
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }

  const summarize = (selected: Group[]) => {
    let sourceLinkedFacts = 0;
    let oneSourceFacts = 0;
    let twoPlusIndependentSourceFacts = 0;
    let unresolvedDisputes = 0;
    let staleRows = 0;
    for (const group of selected) {
      const sourceIds = new Set(group.rows.map((row) => row.sourceId));
      if (group.rows.every((row) => isSourceLinked(row, sourceById))) {
        sourceLinkedFacts++;
      }
      if (sourceIds.size === 1) oneSourceFacts++;
      if (countIndependentFamilies(group.rows) >= 2) {
        twoPlusIndependentSourceFacts++;
      }
      if (unresolved.has(groupKey(group.countryId, group.factKey))) {
        unresolvedDisputes++;
      }
      staleRows += group.rows.filter((row) =>
        isStale(row, generatedAtMs),
      ).length;
    }
    return {
      facts: selected.length,
      sourceLinkedFacts,
      oneSourceFacts,
      twoPlusIndependentSourceFacts,
      unresolvedDisputes,
      staleRows,
    };
  };

  const allGroups = [...groups.values()];
  const total = summarize(allGroups);
  const byCountryGroups = new Map<string, Group[]>();
  const byFactKeyGroups = new Map<string, Group[]>();
  for (const group of allGroups) {
    byCountryGroups.set(group.countryId, [
      ...(byCountryGroups.get(group.countryId) ?? []),
      group,
    ]);
    byFactKeyGroups.set(group.factKey, [
      ...(byFactKeyGroups.get(group.factKey) ?? []),
      group,
    ]);
  }

  const byCountry = [...byCountryGroups.values()]
    .map((countryGroups) => {
      const first = countryGroups[0];
      return {
        id: first.countrySlug,
        label: first.countryName,
        ...summarize(countryGroups),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const byFactKey = [...byFactKeyGroups.entries()]
    .map(([factKey, factGroups]) => ({
      id: factKey,
      label: factKey,
      ...summarize(factGroups),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const statementByTable = new Map<
    string,
    { total: number; sourceLinked: number }
  >();
  let linkedStatements = 0;
  for (const row of input.statements) {
    const linked = isSourceLinked(row, sourceById);
    if (linked) linkedStatements++;
    const bucket = statementByTable.get(row.subjectTable) ?? {
      total: 0,
      sourceLinked: 0,
    };
    bucket.total++;
    if (linked) bucket.sourceLinked++;
    statementByTable.set(row.subjectTable, bucket);
  }

  return {
    schemaVersion: FACT_COVERAGE_VERSION,
    generatedAt: input.generatedAt,
    staleness: {
      liveRowThresholdDays: FACT_COVERAGE_STALE_AFTER_DAYS,
      frozenSourcesExcluded: true,
      rule: "An active row is stale when its retrieval timestamp is more than 180 days before report generation and its source is not registered as a frozen archive.",
    },
    independence: {
      rule: "Count distinct claim-level producing families among measured observations. Republishers collapse into their upstream family; projections do not corroborate measurements; compilations and unknown lineage fail closed.",
      secondaryOrAggregatorSources: [
        ...SECONDARY_OR_AGGREGATOR_SOURCE_IDS,
      ].sort(),
      limitation:
        "The checked lineage registry covers every active source/fact relationship. New or unmapped relationships remain visible but cannot add an independent family until reviewed.",
    },
    facts: {
      activeRows: input.facts.length,
      total: total.facts,
      sourceLinked: total.sourceLinkedFacts,
      oneSource: total.oneSourceFacts,
      twoPlusIndependentSources: total.twoPlusIndependentSourceFacts,
      unresolvedDisputes: total.unresolvedDisputes,
      staleRows: total.staleRows,
      distinctJurisdictions: byCountry.length,
      distinctFactKeys: byFactKey.length,
    },
    statements: {
      total: input.statements.length,
      sourceLinked: linkedStatements,
      unlinked: input.statements.length - linkedStatements,
      distinctGroups: new Set(
        input.statements.map(
          (row) =>
            `${row.subjectTable}\u0000${row.subjectId}\u0000${row.predicate}`,
        ),
      ).size,
      bySubjectTable: [...statementByTable.entries()]
        .map(([subjectTable, value]) => ({ subjectTable, ...value }))
        .sort((a, b) => a.subjectTable.localeCompare(b.subjectTable)),
    },
    byCountry,
    byFactKey,
  };
}
