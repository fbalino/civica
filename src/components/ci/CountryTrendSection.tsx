import {
  getAllSources,
  getIndicatorHistoryForCountry,
  type IndicatorHistorySeries,
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { sourceLabel } from "@/lib/data/sources";
import { DataValueState } from "@/components/DataValueState";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { DataTable } from "@/components/editorial/DataTable";
import {
  indicatorHistoryCatalogEntry,
  indicatorObservationBreaks,
} from "@/lib/indicators/history-catalog";
import { sourceRights } from "@/lib/rights/manifest";
import {
  IndicatorTrendChart,
  type TrendSeriesInput,
} from "./IndicatorTrendChart";
import type { ReactNode } from "react";

function historySectionShell(children: ReactNode, embedded: boolean) {
  const Wrapper = embedded ? "div" : "section";
  return (
    <Wrapper id={embedded ? undefined : "ci-long-run"}>
      {embedded ? null : (
        <>
          <div className="ci-country-section-eyebrow">
            <span>Long-run indicators · source history</span>
            <small>Source-native observations</small>
          </div>
          <h3 className="ci-country-section-title">
            How published indicators have changed over time.
          </h3>
        </>
      )}
      {children}
    </Wrapper>
  );
}

export async function CountryTrendSection({
  slug,
  embedded = false,
  initialSeries,
  initialSources,
}: {
  slug: string;
  embedded?: boolean;
  initialSeries?: IndicatorHistorySeries[] | null;
  initialSources?: Awaited<ReturnType<typeof getAllSources>>;
}) {
  let series: IndicatorHistorySeries[];
  if (initialSeries === null) {
    return historySectionShell(
      <Banner variant="warn">
        Indicator history is temporarily unavailable. Civica has preserved the
        section so a database outage cannot appear to mean that no history
        exists.
      </Banner>,
      embedded,
    );
  }
  if (initialSeries !== undefined) {
    series = initialSeries;
  } else {
    try {
      series = await getIndicatorHistoryForCountry(slug);
    } catch {
      return historySectionShell(
        <Banner variant="warn">
          Indicator history is temporarily unavailable. Civica has preserved the
          section so a database outage cannot appear to mean that no history
          exists.
        </Banner>,
        embedded,
      );
    }
  }

  let sourceById = new Map<
    string,
    { name: string; lastSyncAt: string | null }
  >();
  try {
    const sources = initialSources ?? (await getAllSources());
    sourceById = new Map(
      sources.map(
        (source) =>
          [
            source.id,
            {
              name: source.name,
              lastSyncAt: source.lastSyncAt?.toISOString() ?? null,
            },
          ] as const,
      ),
    );
  } catch {
    // The observations remain usable. SourceDot renders an explicit unknown
    // retrieval state when source freshness cannot be loaded.
  }

  const drawable = series.filter((item) => item.points.length >= 2);
  const availability = series.flatMap((item) =>
    item.availability.map((state) => ({
      ...state,
      indicator: item.indicator,
      sourceId: item.sourceId,
    })),
  );
  if (drawable.length === 0 && availability.length === 0) {
    return historySectionShell(
      <div className="editorial-empty">
        No source-native longitudinal observations are recorded for this
        country. This is an Atlas coverage gap, not evidence of no change.
      </div>,
      embedded,
    );
  }

  const chartSeries: TrendSeriesInput[] = drawable.map((item) => ({
    seriesKey: `${item.sourceId}:${item.indicator}`,
    dimension: item.dimension,
    indicator: item.indicator,
    sourceId: item.sourceId,
    nativeMin: item.nativeMin,
    nativeMax: item.nativeMax,
    isInverted: item.isInverted,
    points: item.points,
    sourceLabel:
      sourceById.get(item.sourceId)?.name ?? sourceLabel(item.sourceId),
  }));

  const allYears = [
    ...drawable.flatMap((item) => item.points.map((point) => point.year)),
    ...availability.map((item) => item.year),
  ];
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);
  const downloadable = series.some(
    (item) => sourceRights(item.sourceId)?.publicExport === "allowed",
  );

  const Wrapper = embedded ? "div" : "section";
  return (
    <Wrapper id={embedded ? undefined : "ci-long-run"}>
      {embedded ? null : (
        <>
          <div className="ci-country-section-eyebrow">
            <span>Long-run indicators · source history</span>
            <small>
              {drawable.length} drawable series · {minYear}–{maxYear}
            </small>
          </div>
          <h3 className="ci-country-section-title">
            How published indicators have changed over time.
          </h3>
        </>
      )}

      <Banner variant="info">
        The chart rescales each publisher series to a shared visual axis. Hover
        or focus a year for the original value. Historical rows belong to the
        named captured release; they are not reconstructed historical
        as-published vintages.
      </Banner>

      {chartSeries.length > 0 ? (
        <IndicatorTrendChart series={chartSeries} />
      ) : null}

      {availability.length > 0 ? (
        <ul
          className="ci-country-long-run-sources"
          aria-label="Indicator availability states"
        >
          {availability.map((item) => (
            <li
              key={`${item.sourceId}-${item.indicator}-${item.year}-${item.status}`}
              className="ci-country-long-run-source"
            >
              <span>
                {item.indicator} · {item.year}
              </span>
              <DataValueState status={item.status} reason={item.reason} />
            </li>
          ))}
        </ul>
      ) : null}

      <DataTable
        className="ci-country-long-run-table"
        aria-label="Indicator history definitions and provenance"
      >
        <thead>
          <tr>
            <th>Indicator</th>
            <th>Source</th>
            <th>Native unit and scale</th>
            <th>Observed years</th>
            <th>Captured release</th>
            <th>Observation breaks</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {series.map((item) => {
            const catalog = indicatorHistoryCatalogEntry(
              item.sourceId,
              item.indicator,
            );
            const lineage = item.lineage[0] ?? null;
            const years = item.points.map((point) => point.year);
            const breaks = indicatorObservationBreaks(years);
            const rights = sourceRights(item.sourceId);
            const exportAllowed = rights?.publicExport === "allowed";
            return (
              <tr key={`${item.sourceId}:${item.indicator}`}>
                <td>
                  <strong>{catalog?.label ?? item.indicator}</strong>
                  {catalog ? <small>{catalog.definition}</small> : null}
                </td>
                <td>
                  <span className="ci-country-long-run-source">
                    <SourceDot
                      source={item.sourceId}
                      retrievedAt={
                        sourceById.get(item.sourceId)?.lastSyncAt ?? null
                      }
                    />
                    <span>
                      {sourceById.get(item.sourceId)?.name ??
                        sourceLabel(item.sourceId)}
                    </span>
                  </span>
                </td>
                <td>
                  {catalog?.unit ?? "source-native units"}
                  <small>
                    {catalog?.nativeScale ??
                      `${item.nativeMin}–${item.nativeMax}`}
                  </small>
                </td>
                <td>
                  {years.length > 0
                    ? `${Math.min(...years)}–${Math.max(...years)} · ${years.length} observations`
                    : "No observed values"}
                  {catalog ? <small>{catalog.expectedCadence}</small> : null}
                </td>
                <td>
                  {lineage?.upstreamRelease ?? "Release not recorded"}
                  {lineage ? (
                    <small>
                      {lineage.methodVersion} · {lineage.temporalCoverage}
                    </small>
                  ) : null}
                </td>
                <td>
                  {breaks.length === 0
                    ? "No breaks longer than two years"
                    : breaks
                        .map(
                          (gap) =>
                            `${gap.afterYear}–${gap.beforeYear} (${gap.unobservedYears} unobserved)`,
                        )
                        .join("; ")}
                  {catalog ? <small>{catalog.comparabilityNote}</small> : null}
                </td>
                <td>
                  {exportAllowed ? (
                    <Button
                      href={`/api/countries/${encodeURIComponent(slug)}/indicator-history?format=csv&indicator=${encodeURIComponent(item.indicator)}`}
                      variant="secondary"
                      size="sm"
                    >
                      CSV
                    </Button>
                  ) : (
                    <span>
                      Observation export unavailable
                      <small>
                        <a href="/licensing#rights-manifest">
                          Source terms pending
                        </a>
                      </small>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      {downloadable ? (
        <div className="ci-country-long-run-actions">
          <Button
            href={`/api/countries/${encodeURIComponent(slug)}/indicator-history?format=csv`}
            variant="secondary"
            size="sm"
            arrow
          >
            Download permitted observations
          </Button>
          <span>
            The file includes only sources whose checked rights record permits
            public observation export and names withheld series in JSON.
          </span>
        </div>
      ) : null}
    </Wrapper>
  );
}
