"use client";

import {
  SortableDataTable,
  type SortableColumn,
} from "@/components/editorial/SortableDataTable";
import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";
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
const formatScore = (n: number) => n.toFixed(1);

// Governance dimensions + composite are normalized 0-100 (beta Civica Index).
const GOVERNANCE_COLUMNS: MetricColumn[] = [
  { id: "civica_index", label: "Civica Index", unit: "0–100", format: formatScore },
  { id: "democratic_quality", label: "Democracy", unit: "0–100", format: formatScore },
  { id: "freedom_rights", label: "Freedom & Rights", unit: "0–100", format: formatScore },
  { id: "rule_of_law", label: "Rule of Law", unit: "0–100", format: formatScore },
  { id: "corruption_control", label: "Corruption Control", unit: "0–100", format: formatScore },
];

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

const METRIC_COLUMNS: MetricColumn[] = [...GOVERNANCE_COLUMNS, ...MATERIAL_COLUMNS];

function bandColor(letter: string | null | undefined): string {
  switch (letter) {
    case "A":
      return "var(--tier-exceptional)";
    case "B":
      return "var(--tier-strong)";
    case "C":
      return "var(--tier-mixed)";
    case "D":
      return "var(--tier-weak)";
    case "E":
    case "F":
      return "var(--tier-failed)";
    default:
      return "var(--color-text-primary)";
  }
}

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
        const isCivicaIndex = metric.id === "civica_index";
        return (
          <span className="sortable-data-table__value">
            <span
              style={
                isCivicaIndex
                  ? { color: bandColor(cell.band), fontWeight: "var(--font-weight-semibold)" }
                  : undefined
              }
            >
              {metric.format(cell.value)}
            </span>
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
        initialSort={{ columnId: "civica_index", direction: "desc" }}
        caption={`${rows.length} sovereign states · click a column header to re-sort`}
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

  return (
    <span className="rankings-col-meta">
      {unit && <span className="rankings-col-unit">{unit}</span>}
      {source && (
        <SourceDot source={source} retrievedAt={winner?.retrievedAt ?? null} />
      )}
    </span>
  );
}
