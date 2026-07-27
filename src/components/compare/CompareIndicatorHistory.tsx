"use client";

import { useMemo, useState } from "react";

import { DataValueState } from "@/components/DataValueState";
import { Button } from "@/components/editorial/Button";
import { DataTable } from "@/components/editorial/DataTable";
import { IndicatorTrendChart } from "@/components/ci/IndicatorTrendChart";
import { ResearchVisualizationDisclosure } from "@/components/research/ResearchVisualizationDisclosure";
import { SourceDot } from "@/components/SourceDot";
import type { IndicatorHistorySeries } from "@/lib/db/queries";
import {
  indicatorHistoryCatalogEntry,
  indicatorObservationBreaks,
} from "@/lib/indicators/history-catalog";
import { sourceLabel } from "@/lib/data/sources";

export interface CompareIndicatorHistoryCountry {
  slug: string;
  name: string;
  colorVar: string;
  series: IndicatorHistorySeries[];
}

export function CompareIndicatorHistory({
  countries,
  downloadableSourceIds,
  sourceFreshness,
}: {
  countries: CompareIndicatorHistoryCountry[];
  downloadableSourceIds: string[];
  sourceFreshness: Record<string, string | null> | null;
}) {
  const options = useMemo(() => {
    const seen = new Map<
      string,
      { indicator: string; sourceId: string; dimension: string }
    >();
    for (const country of countries) {
      for (const series of country.series) {
        if (series.points.length < 2) continue;
        const key = `${series.sourceId}:${series.indicator}`;
        if (!seen.has(key)) {
          seen.set(key, {
            indicator: series.indicator,
            sourceId: series.sourceId,
            dimension: series.dimension,
          });
        }
      }
    }
    return [...seen.values()];
  }, [countries]);

  const [selectedKey, setSelectedKey] = useState(
    options[0] ? `${options[0].sourceId}:${options[0].indicator}` : "",
  );
  if (options.length === 0) {
    return (
      <div className="editorial-empty">
        No selected country has two or more observations in a shared
        longitudinal series. This is a coverage gap, not evidence of no change.
      </div>
    );
  }

  const selected =
    options.find(
      (option) => `${option.sourceId}:${option.indicator}` === selectedKey,
    ) ?? options[0];
  const catalog = indicatorHistoryCatalogEntry(
    selected.sourceId,
    selected.indicator,
  );
  const selectedByCountry = countries.map((country) => ({
    country,
    series:
      country.series.find(
        (series) =>
          series.sourceId === selected.sourceId &&
          series.indicator === selected.indicator,
      ) ?? null,
  }));
  const chartSeries = selectedByCountry.flatMap(({ country, series }) =>
    series && series.points.length >= 2
      ? [
          {
            seriesKey: `${country.slug}:${series.sourceId}:${series.indicator}`,
            label: country.name,
            colorVar: country.colorVar,
            dimension: series.dimension,
            indicator: series.indicator,
            sourceId: series.sourceId,
            sourceLabel: sourceLabel(series.sourceId),
            nativeMin: series.nativeMin,
            nativeMax: series.nativeMax,
            isInverted: series.isInverted,
            points: series.points,
          },
        ]
      : [],
  );
  const exportAllowed = downloadableSourceIds.includes(selected.sourceId);
  const sourceRetrievedAt = sourceFreshness?.[selected.sourceId];
  const sourceVintages = [
    ...new Set(
      selectedByCountry.flatMap(({ series }) =>
        series?.lineage.map((lineage) => lineage.upstreamRelease) ?? [],
      ),
    ),
  ];
  const exportHref = (
    country: CompareIndicatorHistoryCountry,
    format: "json" | "csv",
  ) => {
    const params = new URLSearchParams({
      format,
      indicator: selected.indicator,
      source: selected.sourceId,
    });
    return `/api/countries/${encodeURIComponent(country.slug)}/indicator-history?${params.toString()}`;
  };

  return (
    <div className="compare-indicator-history">
      <div
        className="editorial-filter-row compare-indicator-history-options"
        role="group"
        aria-label="Choose a source-native indicator"
      >
        {options.map((option) => {
          const key = `${option.sourceId}:${option.indicator}`;
          const metadata = indicatorHistoryCatalogEntry(
            option.sourceId,
            option.indicator,
          );
          const active = key === `${selected.sourceId}:${selected.indicator}`;
          return (
            <button
              type="button"
              key={key}
              className={`editorial-chip${active ? " editorial-chip--active" : ""}`}
              aria-pressed={active}
              onClick={() => setSelectedKey(key)}
            >
              {metadata?.shortLabel ?? option.indicator}
            </button>
          );
        })}
      </div>

      <div className="compare-indicator-history-definition">
        <strong>{catalog?.label ?? selected.indicator}</strong>
        <span>{catalog?.definition}</span>
        <span>
          {catalog?.unit ?? "source-native units"} · {catalog?.nativeScale}
        </span>
        <span>
          Source: {sourceLabel(selected.sourceId)}
          {sourceFreshness ? (
            <SourceDot
              source={selected.sourceId}
              retrievedAt={sourceRetrievedAt ?? null}
            />
          ) : (
            " · freshness marker temporarily unavailable"
          )}
          {" · "}
          {catalog?.expectedCadence}
        </span>
      </div>

      <IndicatorTrendChart
        key={`${selected.sourceId}:${selected.indicator}`}
        series={chartSeries}
        title={`${catalog?.label ?? selected.indicator} comparison`}
      />

      <ResearchVisualizationDisclosure
        title={`${catalog?.label ?? selected.indicator} comparison`}
        description="The line chart keeps source-native values in the table below; its shared visual index is only a comparison aid."
        sources={[
          {
            id: selected.sourceId,
            label: sourceLabel(selected.sourceId),
            retrievedAt: sourceRetrievedAt,
            upstreamVintage:
              sourceVintages.length > 0
                ? sourceVintages.join(", ")
                : null,
          },
        ]}
        missingData="Years without a published observation stay absent from the line and table; they never become zero or no change."
        dataAccess={
          exportAllowed && selectedByCountry[0]
            ? {
                kind: "download",
                href: exportHref(selectedByCountry[0].country, "csv"),
                label: `Download ${selectedByCountry[0].country.name} CSV`,
              }
            : {
                kind: "withheld",
                reason:
                  "Observation downloads are unavailable while this source's redistribution terms remain pending.",
              }
        }
        tableLabel="Show source-native observation table"
      >
        <DataTable aria-label={`${catalog?.label ?? selected.indicator} comparison data table`}>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Year</th>
              <th scope="col">Published value</th>
              <th scope="col">Captured release</th>
            </tr>
          </thead>
          <tbody>
            {selectedByCountry.flatMap(({ country, series }) =>
              (series?.points ?? []).map((point) => (
                <tr key={`${country.slug}-${point.year}`}>
                  <th scope="row">{country.name}</th>
                  <td>{point.year}</td>
                  <td>{point.value}</td>
                  <td>{series?.lineage[0]?.upstreamRelease ?? "Release not recorded"}</td>
                </tr>
              )),
            )}
          </tbody>
        </DataTable>
      </ResearchVisualizationDisclosure>

      <div className="compare-indicator-history-coverage">
        {selectedByCountry.map(({ country, series }) => {
          const years = series?.points.map((point) => point.year) ?? [];
          const breaks = indicatorObservationBreaks(years);
          const vintages = [
            ...new Set(
              series?.lineage.map((lineage) => lineage.upstreamRelease) ?? [],
            ),
          ];
          return (
            <div
              key={country.slug}
              className="compare-indicator-history-country"
            >
              <strong>{country.name}</strong>
              {years.length > 0 ? (
                <>
                  <span>
                    {Math.min(...years)}–{Math.max(...years)} · {years.length}{" "}
                    observations
                    {breaks.length > 0
                      ? ` · ${breaks.length} break${breaks.length === 1 ? "" : "s"}`
                      : " · no break longer than two years"}
                  </span>
                  {vintages.length > 0 ? (
                    <span>
                      Publisher vintage{vintages.length === 1 ? "" : "s"}: {vintages.join(", ")}
                    </span>
                  ) : null}
                </>
              ) : (
                <DataValueState
                  status="not_observed"
                  reason="No observation for this country in the selected source series."
                />
              )}
              {exportAllowed && years.length > 0 ? (
                <div className="compare-indicator-history-downloads">
                  <Button href={exportHref(country, "json")} variant="text" size="sm">
                    Download JSON
                  </Button>
                  <Button href={exportHref(country, "csv")} variant="text" size="sm">
                    Download CSV
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="indicator-trend-axis-note">
        {catalog?.comparabilityNote} Missing years remain gaps; they never
        become zero or “no change.”{" "}
        {exportAllowed
          ? "Observation downloads retain the source license and lineage."
          : "Observation downloads remain unavailable while source-specific redistribution terms are pending."}
      </p>
    </div>
  );
}
