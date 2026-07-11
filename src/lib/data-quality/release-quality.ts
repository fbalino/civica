import { getFactKey } from "../factbook/reconcile/fact-keys";

export const RELEASE_QUALITY_SCHEMA = "release-data-quality/v1" as const;

export const QUALITY_CATEGORIES = [
  "identifier_uniqueness",
  "jurisdiction_coverage",
  "impossible_range",
  "unit_vintage_consistency",
  "orphan_provenance",
  "duplicate_canonical",
  "missing_required",
  "unexpected_row_delta",
  "source_age",
] as const;

export type QualityCategory = (typeof QUALITY_CATEGORIES)[number];

export type QualityIssue = {
  checkId: string;
  category: QualityCategory;
  severity: "error" | "warning";
  entity: string;
  detail: string;
  observed: string | number | null;
  expected: string | number;
  remediation: string;
};

export type IdentifierRow = {
  namespace: string;
  entityId: string;
  value: string | null;
  required?: boolean;
};

export type QualityJurisdiction = {
  id: string;
  slug: string | null;
  name: string | null;
  status: string | null;
  statusSourceIds: unknown;
  statusReviewedAt: string | null;
  activeFactCount: number;
};

export type QualityFact = {
  id: string;
  jurisdictionId: string;
  factKey: string | null;
  factGroup: string | null;
  category: string | null;
  sourceId: string | null;
  factValue: string | null;
  factValueNumeric: number | null;
  factUnit: string | null;
  factYear: number | null;
  dataVintageYear: number | null;
  valueJson: unknown;
  valueType: string | null;
};

export type QualityVintage = {
  id: string;
  jurisdictionId: string;
  factKey: string;
  vintageLabel: string;
  canonicalFactId: string;
  canonicalFactExists: boolean;
  sourceId: string;
  methodologyVersion: string;
  derivationVersionKey: string;
};

export type QualityStatement = {
  id: string;
  subjectTable: string;
  subjectId: string;
  sourceId: string;
};

export type QualitySource = {
  id: string;
  name: string | null;
  license: string | null;
  lastSyncAt: string | null;
  activeReferenceCount: number;
  frozen: boolean;
};

export type ReleaseQualitySnapshot = {
  generatedAt: string;
  identifiers: IdentifierRow[];
  jurisdictions: QualityJurisdiction[];
  facts: QualityFact[];
  vintages: QualityVintage[];
  statements: QualityStatement[];
  sources: QualitySource[];
  subjectIds: Record<string, string[]>;
  rowCounts: Record<string, number>;
};

export type ReleaseQualityPolicy = {
  sourceMaxAgeDays: number;
  minimumVintageYear: number;
  maximumFutureYears: number;
  rowCounts: Record<
    string,
    { baseline: number; minimum: number; maximum: number }
  >;
};

export type QualityCheckResult = {
  category: QualityCategory;
  status: "pass" | "fail";
  issueCount: number;
};

export type ReleaseQualityReport = {
  schemaVersion: typeof RELEASE_QUALITY_SCHEMA;
  generatedAt: string;
  status: "pass" | "fail";
  policy: {
    sourceMaxAgeDays: number;
    minimumVintageYear: number;
    maximumFutureYears: number;
  };
  rowCounts: Record<string, number>;
  checks: QualityCheckResult[];
  issues: QualityIssue[];
};

function normalized(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizedUnit(value: string | null | undefined) {
  const unit = normalized(value).toLowerCase();
  if (unit === "$" || unit === "us$" || unit === "usd") return "usd";
  if (unit === "person" || unit === "persons" || unit === "people") return "people";
  return unit;
}

function hasJsonValue(value: unknown) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function evaluateReleaseQuality(
  snapshot: ReleaseQualitySnapshot,
  policy: ReleaseQualityPolicy,
): ReleaseQualityReport {
  const now = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(now)) throw new Error("generatedAt must be an ISO timestamp");
  const issues: QualityIssue[] = [];
  const add = (issue: QualityIssue) => issues.push(issue);

  const identifiers = new Map<string, IdentifierRow[]>();
  for (const row of snapshot.identifiers) {
    const value = normalized(row.value).toLowerCase();
    if (!value) {
      if (row.required) {
        add({
          checkId: "identifier.required",
          category: "missing_required",
          severity: "error",
          entity: `${row.namespace}:${row.entityId}`,
          detail: `Required ${row.namespace} identifier is blank.`,
          observed: row.value,
          expected: "non-empty identifier",
          remediation: `Populate ${row.namespace} for ${row.entityId} before release.`,
        });
      }
      continue;
    }
    const key = `${row.namespace}\u0000${value}`;
    const group = identifiers.get(key) ?? [];
    group.push(row);
    identifiers.set(key, group);
  }
  for (const rows of identifiers.values()) {
    if (rows.length < 2) continue;
    add({
      checkId: "identifier.unique",
      category: "identifier_uniqueness",
      severity: "error",
      entity: rows.map((row) => row.entityId).join(","),
      detail: `${rows[0].namespace} identifier ${JSON.stringify(rows[0].value)} is assigned to ${rows.length} records.`,
      observed: rows.length,
      expected: 1,
      remediation: `Choose one canonical owner for this ${rows[0].namespace} value and repair the duplicates.`,
    });
  }

  for (const jurisdiction of snapshot.jurisdictions) {
    if (jurisdiction.status === "sovereign_state" && jurisdiction.activeFactCount === 0) {
      add({
        checkId: "jurisdiction.sovereign_has_fact",
        category: "jurisdiction_coverage",
        severity: "error",
        entity: jurisdiction.id,
        detail: `Sovereign jurisdiction ${jurisdiction.slug ?? jurisdiction.id} has no active country facts.`,
        observed: 0,
        expected: ">= 1 active fact",
        remediation: "Restore or ingest at least one sourced active fact, or correct the jurisdiction status.",
      });
    }
    const required = [
      ["slug", jurisdiction.slug],
      ["name", jurisdiction.name],
      ["status", jurisdiction.status],
      ["statusReviewedAt", jurisdiction.statusReviewedAt],
    ] as const;
    for (const [field, value] of required) {
      if (normalized(value)) continue;
      add({
        checkId: "jurisdiction.required",
        category: "missing_required",
        severity: "error",
        entity: jurisdiction.id,
        detail: `Jurisdiction field ${field} is blank.`,
        observed: value,
        expected: "non-empty value",
        remediation: `Populate jurisdictions.${field} for ${jurisdiction.id}.`,
      });
    }
    if (!Array.isArray(jurisdiction.statusSourceIds) || jurisdiction.statusSourceIds.length === 0) {
      add({
        checkId: "jurisdiction.status_sources",
        category: "missing_required",
        severity: "error",
        entity: jurisdiction.id,
        detail: "Jurisdiction status has no source IDs.",
        observed: Array.isArray(jurisdiction.statusSourceIds) ? jurisdiction.statusSourceIds.length : null,
        expected: ">= 1 source ID",
        remediation: `Attach at least one registered status source to ${jurisdiction.slug ?? jurisdiction.id}.`,
      });
    }
  }

  const sourceIds = new Set(snapshot.sources.map((source) => source.id));
  const activeFactKeys = new Map<string, QualityFact[]>();
  const maximumVintageYear = new Date(now).getUTCFullYear() + policy.maximumFutureYears;
  for (const fact of snapshot.facts) {
    const factKey = normalized(fact.factKey);
    const sourceId = normalized(fact.sourceId);
    const def = factKey ? getFactKey(factKey) : undefined;
    const identity = `${fact.jurisdictionId}\u0000${factKey}\u0000${sourceId}`;
    const sameIdentity = activeFactKeys.get(identity) ?? [];
    sameIdentity.push(fact);
    activeFactKeys.set(identity, sameIdentity);

    if (fact.factValueNumeric != null && def?.envelope) {
      // Explicit fact-key bounds take precedence. The generic percent/year
      // bounds are fallbacks only, matching the production adapters.
      const min = def.envelope.min ?? (def.envelope.isPercent ? -1 : def.envelope.isYear ? 1500 : undefined);
      const max = def.envelope.max ?? (def.envelope.isPercent ? 101 : def.envelope.isYear ? 2100 : undefined);
      if ((min != null && fact.factValueNumeric < min) || (max != null && fact.factValueNumeric > max)) {
        add({
          checkId: "fact.plausibility_envelope",
          category: "impossible_range",
          severity: "error",
          entity: fact.id,
          detail: `${factKey} value ${fact.factValueNumeric} is outside its registered plausibility envelope.`,
          observed: fact.factValueNumeric,
          expected: `${min ?? "-∞"}..${max ?? "+∞"}`,
          remediation: `Reject or correct country_facts row ${fact.id}; do not widen the envelope without methodology review.`,
        });
      }
    }
    if (fact.factValueNumeric != null && def?.unit && normalizedUnit(fact.factUnit) !== normalizedUnit(def.unit)) {
      add({
        checkId: "fact.unit",
        category: "unit_vintage_consistency",
        severity: "error",
        entity: fact.id,
        detail: `${factKey} uses unit ${JSON.stringify(fact.factUnit)} instead of the fact-key registry unit.`,
        observed: fact.factUnit,
        expected: def.unit,
        remediation: `Convert the value and set country_facts.fact_unit to ${def.unit}.`,
      });
    }
    for (const [field, year] of [
      ["fact_year", fact.factYear],
      ["data_vintage_year", fact.dataVintageYear],
    ] as const) {
      if (year == null) continue;
      if (year < policy.minimumVintageYear || year > maximumVintageYear) {
        add({
          checkId: "fact.vintage_range",
          category: "unit_vintage_consistency",
          severity: "error",
          entity: fact.id,
          detail: `${field} ${year} is outside the supported vintage range.`,
          observed: year,
          expected: `${policy.minimumVintageYear}..${maximumVintageYear}`,
          remediation: `Correct ${field} or document the historical/future-data policy before release.`,
        });
      }
    }
    if (fact.dataVintageYear != null && fact.factYear != null && fact.dataVintageYear > fact.factYear) {
      add({
        checkId: "fact.vintage_order",
        category: "unit_vintage_consistency",
        severity: "error",
        entity: fact.id,
        detail: "Measurement vintage is later than the publisher's fact year.",
        observed: fact.dataVintageYear,
        expected: `<= ${fact.factYear}`,
        remediation: "Correct the measurement vintage or publisher year; do not silently swap their meanings.",
      });
    }
    if (fact.valueType !== "measured" && fact.valueType !== "projected") {
      add({
        checkId: "fact.value_type",
        category: "unit_vintage_consistency",
        severity: "error",
        entity: fact.id,
        detail: `Fact value_type ${JSON.stringify(fact.valueType)} is outside the controlled vocabulary.`,
        observed: fact.valueType,
        expected: "measured or projected",
        remediation: "Classify the row as measured or projected before release.",
      });
    }
    if (!sourceId || !sourceIds.has(sourceId)) {
      add({
        checkId: "fact.source_fk",
        category: "orphan_provenance",
        severity: "error",
        entity: fact.id,
        detail: `Active fact points to missing source ${JSON.stringify(fact.sourceId)}.`,
        observed: fact.sourceId,
        expected: "registered source ID",
        remediation: "Register the source or remove/relink the orphaned fact row.",
      });
    }
    const missingFields = [
      ["fact_key", factKey],
      ["fact_group", normalized(fact.factGroup)],
      ["category", normalized(fact.category)],
      ["source_id", sourceId],
    ].filter(([, value]) => !value).map(([field]) => field);
    if (missingFields.length || (fact.factValue == null && fact.factValueNumeric == null && !hasJsonValue(fact.valueJson))) {
      add({
        checkId: "fact.required",
        category: "missing_required",
        severity: "error",
        entity: fact.id,
        detail: `Active fact is missing ${[...missingFields, ...(fact.factValue == null && fact.factValueNumeric == null && !hasJsonValue(fact.valueJson) ? ["value"] : [])].join(", ")}.`,
        observed: "missing",
        expected: "complete active fact",
        remediation: `Populate the required fields or reject country_facts row ${fact.id}.`,
      });
    }
  }
  for (const facts of activeFactKeys.values()) {
    if (facts.length < 2) continue;
    add({
      checkId: "fact.canonical_identity",
      category: "duplicate_canonical",
      severity: "error",
      entity: facts.map((fact) => fact.id).join(","),
      detail: "More than one active fact has the same jurisdiction, fact key, and source.",
      observed: facts.length,
      expected: 1,
      remediation: "Merge or supersede duplicates so the source contributes one canonical candidate.",
    });
  }

  const vintageKeys = new Map<string, QualityVintage[]>();
  for (const vintage of snapshot.vintages) {
    const key = `${vintage.jurisdictionId}\u0000${vintage.factKey}\u0000${vintage.vintageLabel}`;
    const group = vintageKeys.get(key) ?? [];
    group.push(vintage);
    vintageKeys.set(key, group);
    if (!vintage.canonicalFactExists || !sourceIds.has(vintage.sourceId)) {
      add({
        checkId: "vintage.provenance_fk",
        category: "orphan_provenance",
        severity: "error",
        entity: vintage.id,
        detail: "Frozen vintage points to a missing canonical fact or source.",
        observed: `${vintage.canonicalFactId}/${vintage.sourceId}`,
        expected: "existing fact and source",
        remediation: "Repair the vintage foreign references or regenerate the affected cut.",
      });
    }
    const missing = [vintage.factKey, vintage.vintageLabel, vintage.sourceId, vintage.methodologyVersion, vintage.derivationVersionKey].some((value) => !normalized(value));
    if (missing) {
      add({
        checkId: "vintage.required",
        category: "missing_required",
        severity: "error",
        entity: vintage.id,
        detail: "Frozen vintage is missing a required release field.",
        observed: "missing",
        expected: "fact key, label, source, methodology, and derivation version",
        remediation: "Regenerate the vintage with the complete release envelope.",
      });
    }
  }
  for (const vintages of vintageKeys.values()) {
    if (vintages.length < 2) continue;
    add({
      checkId: "vintage.canonical_identity",
      category: "duplicate_canonical",
      severity: "error",
      entity: vintages.map((vintage) => vintage.id).join(","),
      detail: "A jurisdiction/fact-key/vintage cut has multiple canonical rows.",
      observed: vintages.length,
      expected: 1,
      remediation: "Keep one immutable canonical cut and remove the duplicate release row.",
    });
  }

  const subjectIdSets = new Map(
    Object.entries(snapshot.subjectIds).map(([table, ids]) => [table, new Set(ids)]),
  );
  const orphanSubjects = new Map<string, QualityStatement[]>();
  for (const statement of snapshot.statements) {
    if (!sourceIds.has(statement.sourceId)) {
      add({
        checkId: "statement.source_fk",
        category: "orphan_provenance",
        severity: "error",
        entity: statement.id,
        detail: `Statement points to missing source ${JSON.stringify(statement.sourceId)}.`,
        observed: statement.sourceId,
        expected: "registered source ID",
        remediation: "Register the source or relink/remove the statement.",
      });
    }
    const validIds = subjectIdSets.get(statement.subjectTable);
    if (!validIds?.has(statement.subjectId)) {
      const group = orphanSubjects.get(statement.subjectTable) ?? [];
      group.push(statement);
      orphanSubjects.set(statement.subjectTable, group);
    }
  }
  for (const [subjectTable, statements] of orphanSubjects) {
    add({
      checkId: "statement.subject_fk",
      category: "orphan_provenance",
      severity: "error",
      entity: subjectTable,
      detail: `${statements.length} statements point to missing ${subjectTable} subjects; sample statement IDs: ${statements.slice(0, 5).map((row) => row.id).join(", ")}.`,
      observed: statements.length,
      expected: 0,
      remediation: `Relink or remove orphaned ${subjectTable} statement provenance before release.`,
    });
  }

  for (const source of snapshot.sources) {
    if (!normalized(source.name) || !normalized(source.license)) {
      add({
        checkId: "source.required",
        category: "missing_required",
        severity: "error",
        entity: source.id,
        detail: "Source registry row is missing its name or license.",
        observed: `${source.name ?? ""}/${source.license ?? ""}`,
        expected: "non-empty name and license",
        remediation: `Complete source registry metadata for ${source.id}.`,
      });
    }
    if (source.activeReferenceCount === 0 || source.frozen) continue;
    const synced = source.lastSyncAt ? Date.parse(source.lastSyncAt) : Number.NaN;
    const ageDays = Number.isFinite(synced) ? Math.floor((now - synced) / 86_400_000) : null;
    if (ageDays == null || ageDays > policy.sourceMaxAgeDays) {
      add({
        checkId: "source.last_sync_at",
        category: "source_age",
        severity: "error",
        entity: source.id,
        detail: `Production-active source ${source.id} is ${ageDays == null ? "missing a sync timestamp" : `${ageDays} days old`}.`,
        observed: ageDays,
        expected: `<= ${policy.sourceMaxAgeDays} days`,
        remediation: `Run the owning adapter successfully or freeze/disable the source before release.`,
      });
    }
  }

  for (const [table, expected] of Object.entries(policy.rowCounts)) {
    const observed = snapshot.rowCounts[table];
    if (!Number.isSafeInteger(observed) || observed < expected.minimum || observed > expected.maximum) {
      add({
        checkId: "rows.release_delta",
        category: "unexpected_row_delta",
        severity: "error",
        entity: table,
        detail: `${table} row count moved outside its reviewed release window.`,
        observed: observed ?? null,
        expected: `${expected.minimum}..${expected.maximum} (baseline ${expected.baseline})`,
        remediation: "Review the pipeline delta, then update the policy window in the same reviewed release change if intentional.",
      });
    }
  }

  const checks = QUALITY_CATEGORIES.map((category) => {
    const issueCount = issues.filter((issue) => issue.category === category && issue.severity === "error").length;
    return { category, status: issueCount ? "fail" : "pass", issueCount } as QualityCheckResult;
  });
  return {
    schemaVersion: RELEASE_QUALITY_SCHEMA,
    generatedAt: snapshot.generatedAt,
    status: checks.some((check) => check.status === "fail") ? "fail" : "pass",
    policy: {
      sourceMaxAgeDays: policy.sourceMaxAgeDays,
      minimumVintageYear: policy.minimumVintageYear,
      maximumFutureYears: policy.maximumFutureYears,
    },
    rowCounts: snapshot.rowCounts,
    checks,
    issues,
  };
}

export function formatQualityIssue(issue: QualityIssue) {
  return `[${issue.category}/${issue.checkId}] ${issue.entity}: ${issue.detail} Expected ${issue.expected}; observed ${issue.observed ?? "null"}. Fix: ${issue.remediation}`;
}
