import type { IndicatorHistorySeries } from "@/lib/db/queries";
import type { SourceRightsRecord } from "@/lib/rights/manifest";
import {
  INDICATOR_HISTORY_CATALOG_VERSION,
  indicatorHistoryCatalogEntry,
} from "@/lib/indicators/history-catalog";
import { spreadsheetSafeCsvCell } from "@/lib/exports/csv";

export const INDICATOR_HISTORY_EXPORT_VERSION =
  "indicator-history-country-export/v1" as const;

export interface IndicatorHistoryExportSource {
  id: string;
  name: string;
  baseUrl: string | null;
  lastSyncAt: string | null;
}

export interface IndicatorHistoryExportDocument {
  schemaVersion: typeof INDICATOR_HISTORY_EXPORT_VERSION;
  catalogVersion: typeof INDICATOR_HISTORY_CATALOG_VERSION;
  generatedAt: string;
  jurisdiction: { id: string; slug: string; name: string; iso3: string | null };
  series: Array<{
    indicator: string;
    dimension: string;
    label: string;
    unit: string;
    nativeScale: string;
    source: {
      id: string;
      name: string;
      baseUrl: string | null;
      lastSyncAt: string | null;
      license: string;
      termsUrl: string;
    };
    nativeMin: number;
    nativeMax: number;
    isInverted: boolean;
    lineage: IndicatorHistorySeries["lineage"];
    observations: Array<{
      year: number;
      value: number | null;
      status: string;
      statusReason: string | null;
    }>;
  }>;
  withheld: Array<{
    indicator: string;
    sourceId: string;
    reason: string;
  }>;
  rights: {
    manifest: "/api/rights-manifest";
    policy: "source-row-filtered";
  };
}

export function buildIndicatorHistoryExport(input: {
  generatedAt: string;
  jurisdiction: IndicatorHistoryExportDocument["jurisdiction"];
  series: IndicatorHistorySeries[];
  sources: Map<string, IndicatorHistoryExportSource>;
  rights: Map<string, SourceRightsRecord>;
}): IndicatorHistoryExportDocument {
  const allowedSeries: IndicatorHistoryExportDocument["series"] = [];
  const withheld: IndicatorHistoryExportDocument["withheld"] = [];

  for (const series of [...input.series].sort(
    (a, b) =>
      a.sourceId.localeCompare(b.sourceId) ||
      a.indicator.localeCompare(b.indicator),
  )) {
    const rights = input.rights.get(series.sourceId);
    if (!rights || rights.publicExport !== "allowed") {
      withheld.push({
        indicator: series.indicator,
        sourceId: series.sourceId,
        reason:
          rights?.reviewStatus === "pending"
            ? "Source-specific redistribution terms remain pending review."
            : "The source rights record does not permit public observation export.",
      });
      continue;
    }
    const source = input.sources.get(series.sourceId);
    if (!source)
      throw new Error(`Missing source metadata for ${series.sourceId}`);
    const catalog = indicatorHistoryCatalogEntry(
      series.sourceId,
      series.indicator,
    );
    const observations = [
      ...series.points.map((point) => ({
        year: point.year,
        value: point.value,
        status: "observed",
        statusReason: null,
      })),
      ...series.availability.map((row) => ({
        year: row.year,
        value: null,
        status: row.status,
        statusReason: row.reason,
      })),
    ].sort((a, b) => a.year - b.year || a.status.localeCompare(b.status));
    allowedSeries.push({
      indicator: series.indicator,
      dimension: series.dimension,
      label: catalog?.label ?? series.indicator,
      unit: catalog?.unit ?? "source-native units",
      nativeScale:
        catalog?.nativeScale ?? `${series.nativeMin}–${series.nativeMax}`,
      source: {
        id: source.id,
        name: source.name,
        baseUrl: source.baseUrl,
        lastSyncAt: source.lastSyncAt,
        license: rights.licenseId,
        termsUrl: rights.termsUrl,
      },
      nativeMin: series.nativeMin,
      nativeMax: series.nativeMax,
      isInverted: series.isInverted,
      lineage: series.lineage,
      observations,
    });
  }

  return {
    schemaVersion: INDICATOR_HISTORY_EXPORT_VERSION,
    catalogVersion: INDICATOR_HISTORY_CATALOG_VERSION,
    generatedAt: input.generatedAt,
    jurisdiction: input.jurisdiction,
    series: allowedSeries,
    withheld,
    rights: {
      manifest: "/api/rights-manifest",
      policy: "source-row-filtered",
    },
  };
}

const CSV_COLUMNS = [
  "schema_version",
  "catalog_version",
  "generated_at",
  "jurisdiction_id",
  "jurisdiction_slug",
  "jurisdiction_name",
  "iso3",
  "indicator",
  "dimension",
  "indicator_label",
  "unit",
  "native_scale",
  "native_min",
  "native_max",
  "is_inverted",
  "year",
  "value",
  "value_status",
  "value_status_reason",
  "source_id",
  "source_name",
  "source_url",
  "source_license",
  "source_terms_url",
  "source_last_synced_at",
  "lineage_json",
] as const;

export function indicatorHistoryExportCsv(
  document: IndicatorHistoryExportDocument,
): string {
  const rows = document.series.flatMap((series) =>
    series.observations.map((observation) => [
      document.schemaVersion,
      document.catalogVersion,
      document.generatedAt,
      document.jurisdiction.id,
      document.jurisdiction.slug,
      document.jurisdiction.name,
      document.jurisdiction.iso3 ?? "",
      series.indicator,
      series.dimension,
      series.label,
      series.unit,
      series.nativeScale,
      series.nativeMin,
      series.nativeMax,
      series.isInverted,
      observation.year,
      observation.value,
      observation.status,
      observation.statusReason ?? "",
      series.source.id,
      series.source.name,
      series.source.baseUrl ?? "",
      series.source.license,
      series.source.termsUrl,
      series.source.lastSyncAt ?? "",
      JSON.stringify(series.lineage),
    ]),
  );
  return (
    [
      CSV_COLUMNS.join(","),
      ...rows.map((row) => row.map(spreadsheetSafeCsvCell).join(",")),
    ].join("\n") + "\n"
  );
}
