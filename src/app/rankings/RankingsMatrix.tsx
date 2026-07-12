"use client";

import {
  SortableDataTable,
  type SortableColumn,
} from "@/components/editorial/SortableDataTable";
import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";
import { sourceLabel } from "@/lib/data/sources";
import type { RankingCountryRow } from "@/lib/db/queries";

/**
 * Multi-column sortable rankings table. Every column is one metric Civica
 * tracks with broad country coverage; click a header to re-sort. Each metric
 * column ties to its source via a `<SourceDot>` in the header. A country that
 * lacks a metric renders an em-dash (handled by `<SortableDataTable>`).
 */

type MetricFormat = (value: number) => string;

type MetricColumn = {
  id: string;
  label: string;
  /** Short unit / provenance note under the header. */
  unit?: string;
  format: MetricFormat;
};

// ── Formatters (design-system: Inter tabular figures) ──
const compactNumber = (n: number): string => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return Math.round(n).toLocaleString();
};

const formatPopulation = (n: number) => compactNumber(n);
const formatGdp = (n: number) => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n).toLocaleString()}`;
};
const formatUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const formatArea = (n: number) => `${Math.round(n).toLocaleString()}`;
const formatYears = (n: number) => n.toFixed(1);
const formatDecimal2 = (n: number) => n.toFixed(2);
const formatPercent = (n: number) => `${n.toFixed(1)}%`;
const MATERIAL_COLUMNS: MetricColumn[] = [
  { id: "population", label: "Population", unit: "people", format: formatPopulation },
  { id: "gdp_ppp", label: "GDP (PPP)", unit: "USD", format: formatGdp },
  { id: "gdp_per_capita_ppp", label: "GDP / capita", unit: "USD PPP", format: formatUsd },
  { id: "total_area", label: "Area", unit: "km²", format: formatArea },
  { id: "hdi_score", label: "HDI", unit: "0–1", format: formatDecimal2 },
  { id: "life_expectancy", label: "Life Expectancy", unit: "years", format: formatYears },
  { id: "literacy_rate", label: "Literacy", unit: "%", format: formatPercent },
  { id: "median_age", label: "Median Age", unit: "years", format: formatYears },
];

const METRIC_COLUMNS: MetricColumn[] = MATERIAL_COLUMNS;

export function RankingsMatrix({ rows }: { rows: RankingCountryRow[] }) {
  const columns: SortableColumn<RankingCountryRow>[] = [
    // Country identity column (not numeric; A→Z sort).
    {
      id: "country",
      label: "Country",
      sortValue: (row) => row.name,
      render: (row) => (
        <a href={`/country/${row.slug}`} className="rankings-country-cell">
          <CountryFlag iso2={row.iso2} size={20} />
          <span className="rankings-country-name">{row.name}</span>
        </a>
      ),
    },
    // Metric columns.
    ...METRIC_COLUMNS.map((metric): SortableColumn<RankingCountryRow> => ({
      id: metric.id,
      label: metric.label,
      numeric: true,
      meta: <ColumnMeta rows={rows} metricId={metric.id} unit={metric.unit} />,
      sortValue: (row) => row.metrics[metric.id]?.value ?? null,
      render: (row) => {
        const cell = row.metrics[metric.id];
        if (!cell) return null;
        return (
          <span className="sortable-data-table__value">
            <span>{metric.format(cell.value)}</span>
            <SourceDot source={cell.source} retrievedAt={cell.retrievedAt} />
          </span>
        );
      },
    })),
  ];

  return (
    <div className="editorial-table-scroll">
      <SortableDataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.slug}
        initialSort={{ columnId: "population", direction: "desc" }}
        caption={`${rows.length} jurisdictions · click a column header to re-sort`}
      />
    </div>
  );
}

/**
 * Per-column provenance shown under the header label: the unit plus a single
 * `<SourceDot>` for the source that backs the column.
 *
 * A metric is single-source per country in this matrix, so a column is normally
 * backed by one source — but rather than sampling "the first present cell" (whose
 * order depends on a non-deterministic query row order), we pick the MODAL source
 * across all cells and, within it, the most recent `retrievedAt`. That makes the
 * displayed provenance deterministic and, if a column ever does mix sources,
 * representative of the dominant one.
 */
function ColumnMeta({
  rows,
  metricId,
  unit,
}: {
  rows: RankingCountryRow[];
  metricId: string;
  unit?: string;
}) {
  // Tally sources, remembering the newest retrievedAt seen per source.
  const bySource = new Map<string, { count: number; retrievedAt?: string }>();
  for (const row of rows) {
    const cell = row.metrics[metricId];
    if (!cell) continue;
    const entry = bySource.get(cell.source) ?? { count: 0 };
    entry.count += 1;
    if (
      cell.retrievedAt &&
      (!entry.retrievedAt || cell.retrievedAt > entry.retrievedAt)
    ) {
      entry.retrievedAt = cell.retrievedAt;
    }
    bySource.set(cell.source, entry);
  }

  // Deterministic winner: highest count, ties broken by source id (stable).
  let source: string | undefined;
  let winner: { count: number; retrievedAt?: string } | undefined;
  for (const [src, entry] of bySource) {
    if (
      !winner ||
      entry.count > winner.count ||
      (entry.count === winner.count && src < source!)
    ) {
      source = src;
      winner = entry;
    }
  }

  const mixed = bySource.size > 1;

  return (
    <span className="rankings-col-meta">
      {unit && <span className="rankings-col-unit">{unit}</span>}
      {source && (
        <>
          <span
            className={
              mixed
                ? "rankings-col-source rankings-col-source--mixed"
                : "rankings-col-source"
            }
          >
            {/* Name the publisher the column orders by; flag columns whose
                cells do not all share it (EXP-042). */}
            {mixed ? `mixed · mostly ${sourceLabel(source)}` : sourceLabel(source)}
          </span>
          <SourceDot source={source} retrievedAt={winner?.retrievedAt ?? null} />
        </>
      )}
    </span>
  );
}
