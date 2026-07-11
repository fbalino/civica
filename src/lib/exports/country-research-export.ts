import type { SourceRightsRecord } from "@/lib/rights/manifest";
import type {
  DecisionTraceStep,
  FactRow,
  ResolverOutput,
} from "@/lib/factbook/reconcile/types";
import { SOURCE_PRECEDENCE_VERSION } from "@/lib/factbook/reconcile/resolver";
import type { AtlasSelectionMetadata } from "@/lib/factbook/read-selection";

export const COUNTRY_RESEARCH_EXPORT_VERSION =
  "country-research-export/v1" as const;

export interface ExportSourceRecord {
  id: string;
  name: string;
  baseUrl: string | null;
  lastSyncAt: string | null;
}

export interface CountryExportJurisdiction {
  id: string;
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  status: string;
}

export type CountryObservationClass =
  | "canonical"
  | "alternate"
  | "projection"
  | "rejected";

export interface CountryExportObservation {
  recordClass: CountryObservationClass;
  rowId: string;
  factKey: string;
  factGroup: string;
  category: string;
  value: {
    text: string | null;
    numeric: number | null;
    structured: unknown;
    unit: string | null;
    status: string;
    statusReason: string | null;
    type: string;
  };
  source: {
    id: string;
    name: string;
    url: string;
    license: string;
    termsUrl: string;
    lastSyncedAt: string | null;
  };
  freshness: {
    asOf: string | null;
    observationYear: number | null;
    dataVintageYear: number | null;
    retrievedAt: string;
    upstreamVintage: string | null;
  };
  lifecycle: {
    status: string;
    reason: string | null;
  };
  method: {
    rowMethodologyVersion: string;
    reconciliationVersion: typeof SOURCE_PRECEDENCE_VERSION;
    growthMethodology: string | null;
  };
  decision: {
    reason: string;
    trace: DecisionTraceStep[];
  };
  dispute: {
    openOrInReview: boolean;
  };
}

export interface CountryExportFact {
  factKey: string;
  canonical: CountryExportObservation;
  alternates: CountryExportObservation[];
  projections: CountryExportObservation[];
  rejected: CountryExportObservation[];
}

export interface CountryResearchExport {
  schemaVersion: typeof COUNTRY_RESEARCH_EXPORT_VERSION;
  generatedAt: string;
  selection: AtlasSelectionMetadata;
  jurisdiction: CountryExportJurisdiction;
  facts: CountryExportFact[];
  withheld: {
    factKeys: string[];
    observationCount: number;
    reason: string;
  };
  rights: {
    manifest: "/api/rights-manifest";
    policy: "source-row-filtered";
  };
}

function observation(
  row: FactRow,
  recordClass: CountryObservationClass,
  resolution: ResolverOutput,
  source: ExportSourceRecord,
  rights: SourceRightsRecord,
): CountryExportObservation {
  return {
    recordClass,
    rowId: row.id,
    factKey: row.factKey,
    factGroup: row.factGroup,
    category: row.category,
    value: {
      text: row.factValue,
      numeric: row.factValueNumeric,
      structured: row.valueJson,
      unit: row.factUnit,
      status: row.valueStatus ?? "observed",
      statusReason: row.valueStatusReason ?? null,
      type: row.valueType,
    },
    source: {
      id: row.sourceId,
      name: source.name,
      url: row.sourceUrl ?? source.baseUrl ?? rights.termsUrl,
      license: rights.licenseId,
      termsUrl: rights.termsUrl,
      lastSyncedAt: source.lastSyncAt,
    },
    freshness: {
      asOf: row.asOf,
      observationYear: row.factYear,
      dataVintageYear: row.dataVintageYear,
      retrievedAt: row.retrievedAt,
      upstreamVintage: row.upstreamVintageLabel,
    },
    lifecycle: {
      status: row.status,
      reason: row.statusReason,
    },
    method: {
      rowMethodologyVersion: row.methodologyVersion,
      reconciliationVersion: SOURCE_PRECEDENCE_VERSION,
      growthMethodology: row.growthMethodology,
    },
    decision: {
      reason: resolution.decisionReason,
      trace: resolution.decisionTrace,
    },
    dispute: {
      openOrInReview: resolution.isDisputed,
    },
  };
}

const stableRows = (rows: FactRow[]) => [...rows].sort(
  (a, b) => a.sourceId.localeCompare(b.sourceId) || a.id.localeCompare(b.id),
);

export function buildCountryResearchExport(input: {
  generatedAt: string;
  selection: AtlasSelectionMetadata;
  jurisdiction: CountryExportJurisdiction;
  resolutions: Record<string, ResolverOutput>;
  sources: Map<string, ExportSourceRecord>;
  rights: Map<string, SourceRightsRecord>;
}): CountryResearchExport {
  const facts: CountryExportFact[] = [];
  const withheldFactKeys: string[] = [];
  let withheldObservationCount = 0;

  for (const factKey of Object.keys(input.resolutions).sort()) {
    const resolution = input.resolutions[factKey];
    const canonical = resolution.canonical;
    if (!canonical) continue;
    const canonicalRights = input.rights.get(canonical.sourceId);
    if (canonicalRights?.publicExport !== "allowed") {
      withheldFactKeys.push(factKey);
      withheldObservationCount += resolution.all.length;
      continue;
    }

    const allowed = resolution.all.filter(
      (row) => input.rights.get(row.sourceId)?.publicExport === "allowed",
    );
    withheldObservationCount += resolution.all.length - allowed.length;
    const toObservation = (
      row: FactRow,
      recordClass: CountryObservationClass,
    ) => {
      const source = input.sources.get(row.sourceId);
      const rights = input.rights.get(row.sourceId);
      if (!source || !rights || rights.publicExport !== "allowed") {
        throw new Error(`Allowed export row lacks source/rights metadata: ${row.id}`);
      }
      return observation(row, recordClass, resolution, source, rights);
    };

    const otherRows = stableRows(allowed.filter((row) => row.id !== canonical.id));
    facts.push({
      factKey,
      canonical: toObservation(canonical, "canonical"),
      alternates: otherRows
        .filter((row) => row.status === "active" && row.valueType !== "projected")
        .map((row) => toObservation(row, "alternate")),
      projections: otherRows
        .filter((row) => row.status === "active" && row.valueType === "projected")
        .map((row) => toObservation(row, "projection")),
      rejected: otherRows
        .filter((row) => row.status !== "active")
        .map((row) => toObservation(row, "rejected")),
    });
  }

  return {
    schemaVersion: COUNTRY_RESEARCH_EXPORT_VERSION,
    generatedAt: input.generatedAt,
    selection: input.selection,
    jurisdiction: input.jurisdiction,
    facts,
    withheld: {
      factKeys: withheldFactKeys,
      observationCount: withheldObservationCount,
      reason:
        "Rows whose source terms do not permit public export are omitted. A fact is withheld when its resolver-selected canonical row cannot be distributed.",
    },
    rights: {
      manifest: "/api/rights-manifest",
      policy: "source-row-filtered",
    },
  };
}

export const COUNTRY_RESEARCH_EXPORT_CSV_COLUMNS = [
  "schema_version", "generated_at", "selection_mode", "selection_as_of", "selection_vintage", "selection_cutoff_at", "selection_retrieved_through", "selection_methodology_versions_json", "rights_manifest", "rights_policy",
  "withheld_fact_keys_json", "withheld_observation_count", "withheld_reason",
  "jurisdiction_id", "jurisdiction_slug", "jurisdiction_name",
  "iso2", "iso3", "jurisdiction_status", "fact_key", "record_class", "row_id",
  "fact_group", "category", "value_text", "value_numeric", "value_structured_json",
  "unit", "value_status", "value_status_reason", "value_type", "source_id",
  "source_name", "source_url", "source_license", "source_terms_url", "source_last_synced_at",
  "as_of", "observation_year", "data_vintage_year", "retrieved_at", "upstream_vintage",
  "lifecycle_status", "lifecycle_reason", "row_methodology_version", "reconciliation_version",
  "growth_methodology", "decision_reason", "decision_trace_json", "dispute_open_or_in_review",
] as const;

function csvCell(value: unknown): string {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function countryResearchExportCsv(document: CountryResearchExport): string {
  const rows: string[][] = [];
  for (const fact of document.facts) {
    const observations = [
      fact.canonical,
      ...fact.alternates,
      ...fact.projections,
      ...fact.rejected,
    ];
    for (const row of observations) {
      rows.push([
        document.schemaVersion, document.generatedAt, document.selection.mode, document.selection.asOf,
        document.selection.vintage ?? "", document.selection.cutoffAt ?? "", document.selection.retrievedThrough ?? "",
        JSON.stringify(document.selection.methodologyVersions), document.rights.manifest, document.rights.policy,
        JSON.stringify(document.withheld.factKeys), String(document.withheld.observationCount), document.withheld.reason,
        document.jurisdiction.id, document.jurisdiction.slug,
        document.jurisdiction.name, document.jurisdiction.iso2 ?? "", document.jurisdiction.iso3 ?? "",
        document.jurisdiction.status, row.factKey, row.recordClass, row.rowId, row.factGroup,
        row.category, row.value.text ?? "", row.value.numeric == null ? "" : String(row.value.numeric),
        row.value.structured == null ? "" : JSON.stringify(row.value.structured), row.value.unit ?? "",
        row.value.status, row.value.statusReason ?? "", row.value.type, row.source.id, row.source.name,
        row.source.url, row.source.license, row.source.termsUrl, row.source.lastSyncedAt ?? "",
        row.freshness.asOf ?? "", row.freshness.observationYear == null ? "" : String(row.freshness.observationYear),
        row.freshness.dataVintageYear == null ? "" : String(row.freshness.dataVintageYear),
        row.freshness.retrievedAt, row.freshness.upstreamVintage ?? "", row.lifecycle.status,
        row.lifecycle.reason ?? "", row.method.rowMethodologyVersion, row.method.reconciliationVersion,
        row.method.growthMethodology ?? "", row.decision.reason, JSON.stringify(row.decision.trace),
        String(row.dispute.openOrInReview),
      ]);
    }
  }
  return [COUNTRY_RESEARCH_EXPORT_CSV_COLUMNS.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n") + "\n";
}

export function flattenCountryResearchExport(document: CountryResearchExport) {
  return document.facts.flatMap((fact) => [
    fact.canonical,
    ...fact.alternates,
    ...fact.projections,
    ...fact.rejected,
  ]);
}
