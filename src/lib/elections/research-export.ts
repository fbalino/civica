import { sourceRights } from "@/lib/rights/manifest";
import type { getQualifiedElectionResearchRows } from "@/lib/db/queries";
import { spreadsheetSafeCsvCell } from "@/lib/exports/csv";

export const ELECTION_RESEARCH_EXPORT_VERSION =
  "election-research-export/v1" as const;

export type QualifiedElectionResearchRow = Awaited<
  ReturnType<typeof getQualifiedElectionResearchRows>
>[number];

export interface ElectionResearchFilters {
  jurisdiction?: string;
  type?: "legislative" | "presidential";
  temporalClass?: "historical" | "source_dated_upcoming" | "projection_due";
  sourceStatus?: string;
  jurisdictionStatus?: string;
  from?: string;
  to?: string;
  hasResults?: boolean;
  hasTurnout?: boolean;
}

function matches(
  row: QualifiedElectionResearchRow,
  filters: ElectionResearchFilters,
) {
  if (
    filters.jurisdiction &&
    ![row.jurisdiction.slug, row.jurisdiction.iso2, row.jurisdiction.iso3]
      .filter(Boolean)
      .some(
        (value) => value!.toLowerCase() === filters.jurisdiction!.toLowerCase(),
      )
  )
    return false;
  if (filters.type && row.audit.normalizedType !== filters.type) return false;
  if (
    filters.temporalClass &&
    row.audit.temporalClass !== filters.temporalClass
  )
    return false;
  if (
    filters.sourceStatus &&
    row.audit.sourceEventStatus !== filters.sourceStatus
  )
    return false;
  if (
    filters.jurisdictionStatus &&
    row.jurisdiction.type !== filters.jurisdictionStatus
  )
    return false;
  if (
    filters.from &&
    (!row.election.electionDate || row.election.electionDate < filters.from)
  )
    return false;
  if (
    filters.to &&
    (!row.election.electionDate || row.election.electionDate > filters.to)
  )
    return false;
  if (
    filters.hasResults !== undefined &&
    row.results.length > 0 !== filters.hasResults
  )
    return false;
  if (
    filters.hasTurnout !== undefined &&
    (row.election.turnoutPercent != null) !== filters.hasTurnout
  )
    return false;
  return true;
}

export function buildElectionResearchExport(input: {
  rows: QualifiedElectionResearchRow[];
  filters: ElectionResearchFilters;
  auditVersion: string;
  auditAsOf: string;
  generatedAt: string;
}) {
  const filtered = input.rows.filter((row) => matches(row, input.filters));
  const withheldBySource = new Map<string, number>();
  let projectionRows = 0;
  const withheldFields = [
    {
      field: "electoralSystem",
      count: filtered.filter((row) => row.election.electoralSystem != null)
        .length,
      reason:
        "Stored electoral-system labels do not yet carry exact field-level statement provenance and are not exported.",
    },
    {
      field: "turnout",
      count: filtered.filter((row) => row.audit.fieldEligibility.turnout)
        .length,
      reason:
        "International IDEA turnout fields remain pending and non-commercial-only and are not exported.",
    },
    {
      field: "results",
      count: filtered.filter((row) => row.audit.fieldEligibility.results)
        .length,
      reason:
        "IPU result fields remain pending and non-commercial-only; stored percentages derived from seats are seat shares, not vote shares.",
    },
  ].filter((field) => field.count > 0);
  const data = [];

  for (const row of filtered) {
    const sourceId = row.audit.evidence.sourceId;
    const rights = sourceId ? sourceRights(sourceId) : undefined;
    const exportable =
      sourceId === "wikidata" &&
      rights?.reviewStatus === "verified" &&
      rights.publicExport === "allowed" &&
      Boolean(row.eventSourceUrl);
    if (!exportable) {
      const key = sourceId ?? "unknown";
      withheldBySource.set(key, (withheldBySource.get(key) ?? 0) + 1);
      if (row.audit.temporalClass === "projection_due") projectionRows += 1;
      continue;
    }
    data.push({
      id: row.election.id,
      conceptualEventKey: row.audit.conceptualEventKey,
      disposition: row.audit.disposition,
      jurisdiction: {
        id: row.jurisdiction.id,
        slug: row.jurisdiction.slug,
        name: row.jurisdiction.name,
        iso2: row.jurisdiction.iso2,
        iso3: row.jurisdiction.iso3,
        status: row.jurisdiction.status.type,
        statusLabel: row.jurisdiction.status.label,
        disputed: row.jurisdiction.status.disputed,
      },
      event: {
        name: row.election.electionName,
        type: row.audit.normalizedType,
        date: {
          value: row.election.electionDate,
          representation: "date_only" as const,
          time: null,
          timeZone: null,
          timeZoneStatus: "not_provided_by_source" as const,
          basis: row.audit.dateBasis,
          precision: row.audit.datePrecision,
          role: row.audit.dateRole,
          temporalClass: row.audit.temporalClass,
          sourceStatus: row.audit.sourceEventStatus,
        },
        electoralSystem: null,
      },
      provenance: {
        sourceId,
        sourceUrl: row.eventSourceUrl,
        license: row.audit.evidence.license,
        retrievedAt: row.audit.evidence.retrievedAt,
        rightsReview: row.audit.evidence.rightsReview,
      },
    });
  }

  const bySource = [...withheldBySource]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sourceId, count]) => ({
      sourceId,
      count,
      reason:
        sourceId === "ipu_parline"
          ? "IPU Parline export rights remain pending and non-commercial-only."
          : sourceId === "international_idea"
            ? "International IDEA export rights remain pending and non-commercial-only."
            : "The event source is not verified for public export.",
    }));

  return {
    schemaVersion: ELECTION_RESEARCH_EXPORT_VERSION,
    generatedAt: input.generatedAt,
    audit: { version: input.auditVersion, asOf: input.auditAsOf },
    dateSemantics: {
      representation: "date_only" as const,
      time: null,
      timeZone: null,
      note: "Publisher records provide calendar dates without a time of day or source time zone; UTC is not asserted.",
    },
    filters: input.filters,
    data,
    withheld: {
      rows: filtered.length - data.length,
      projectionRows,
      bySource,
      fields: withheldFields,
      reason:
        "Only qualified Wikidata rows with verified CC0 export rights are emitted. IPU, IDEA, projections derived from IPU, and unknown-source rows are withheld.",
    },
    rights: {
      manifest: "/api/rights-manifest" as const,
      policy: "source-row-filtered" as const,
    },
    meta: {
      auditedRowsMatchingFilters: filtered.length,
      qualifiedEventOrContestRowsMatchingFilters: filtered.filter(
        (row) =>
          row.audit.disposition === "qualified_event" ||
          row.audit.disposition === "qualified_contest",
      ).length,
      projectionRowsMatchingFilters: filtered.filter(
        (row) => row.audit.disposition === "projection_only",
      ).length,
      emittedRows: data.length,
    },
  };
}

export const ELECTION_RESEARCH_CSV_HEADER = [
  "row_kind",
  "id",
  "jurisdiction_slug",
  "jurisdiction_name",
  "jurisdiction_status",
  "event_type",
  "event_name",
  "date",
  "date_representation",
  "time",
  "time_zone",
  "time_zone_status",
  "date_basis",
  "date_precision",
  "date_role",
  "temporal_class",
  "source_status",
  "source_id",
  "source_url",
  "license",
  "retrieved_at",
  "withheld_count",
  "withheld_reason",
].join(",");

export function electionResearchExportCsv(
  document: ReturnType<typeof buildElectionResearchExport>,
) {
  const rows = document.data.map((row) => [
    "record",
    row.id,
    row.jurisdiction.slug,
    row.jurisdiction.name,
    row.jurisdiction.status,
    row.event.type,
    row.event.name,
    row.event.date.value,
    row.event.date.representation,
    "",
    "",
    row.event.date.timeZoneStatus,
    row.event.date.basis,
    row.event.date.precision,
    row.event.date.role,
    row.event.date.temporalClass,
    row.event.date.sourceStatus,
    row.provenance.sourceId,
    row.provenance.sourceUrl,
    row.provenance.license,
    row.provenance.retrievedAt,
    "",
    "",
  ]);
  for (const withheld of document.withheld.bySource) {
    rows.push([
      "withheld_summary",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      withheld.sourceId,
      "",
      "",
      "",
      String(withheld.count),
      withheld.reason,
    ]);
  }
  for (const withheld of document.withheld.fields) {
    rows.push([
      "withheld_field_summary",
      "",
      "",
      "",
      "",
      "",
      withheld.field,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      String(withheld.count),
      withheld.reason,
    ]);
  }
  return `${ELECTION_RESEARCH_CSV_HEADER}\n${rows
    .map((row) => row.map(spreadsheetSafeCsvCell).join(","))
    .join("\n")}\n`;
}
