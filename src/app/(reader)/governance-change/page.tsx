import type { Metadata } from "next";
import Link from "next/link";

import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { DataTable } from "@/components/editorial/DataTable";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Chip } from "@/components/editorial/Pill";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { SourceDot } from "@/components/SourceDot";
import {
  buildGovernanceChangeResult,
  GOVERNANCE_CHANGE_MIN_COMPARABLE,
  GOVERNANCE_CHANGE_MIN_COVERAGE,
} from "@/lib/governance-change/explorer";
import { getGovernanceChangeDataset } from "@/lib/governance-change/query";
import {
  INDICATOR_HISTORY_CATALOG,
  indicatorHistoryCatalogEntry,
} from "@/lib/indicators/history-catalog";
import { sourceLabel } from "@/lib/data/sources";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Governance Change Explorer",
  description:
    "Compare declared source-native governance indicator changes across exact time windows, with endpoint sensitivity and honest no-ranking states.",
  alternates: {
    canonical: "https://civicaatlas.org/governance-change",
  },
};

const CHANGE_SERIES = INDICATOR_HISTORY_CATALOG.filter((entry) =>
  [
    "vdem:v2x_libdem",
    "worldbank_wgi:rl.est",
    "freedom_house:fh_total_score",
    "transparency_intl:score",
  ].includes(`${entry.sourceId}:${entry.indicator}`),
);

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDelta(value: number): string {
  const rendered = formatValue(Math.abs(value));
  return value > 0 ? `+${rendered}` : value < 0 ? `−${rendered}` : "0";
}

function defaultStartYear(years: number[], endYear: number): number {
  const target = endYear - 10;
  return (
    [...years].reverse().find((year) => year <= target) ??
    years.find((year) => year < endYear) ??
    years[0]
  );
}

export default async function GovernanceChangePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedSeries = one(params.series);
  const selected =
    CHANGE_SERIES.find(
      (entry) =>
        `${entry.sourceId}:${entry.indicator}` === requestedSeries,
    ) ?? CHANGE_SERIES[0];
  const requestedView = one(params.view);
  const view =
    requestedView === "increases" || requestedView === "decreases"
      ? requestedView
      : "all";

  let dataset: Awaited<ReturnType<typeof getGovernanceChangeDataset>> | null =
    null;
  try {
    dataset = await getGovernanceChangeDataset(
      selected.sourceId,
      selected.indicator,
    );
  } catch {
    // The page distinguishes source-data unavailability from zero coverage.
  }
  const years = dataset?.years ?? [];
  const latestYear = years.at(-1);
  const requestedStart = Number(one(params.start));
  const requestedEnd = Number(one(params.end));
  const endYear =
    Number.isInteger(requestedEnd) && years.includes(requestedEnd)
      ? requestedEnd
      : latestYear;
  const fallbackStart =
    endYear === undefined ? undefined : defaultStartYear(years, endYear);
  const startYear =
    Number.isInteger(requestedStart) &&
    years.includes(requestedStart) &&
    endYear !== undefined &&
    requestedStart < endYear
      ? requestedStart
      : fallbackStart;
  const result =
    dataset && startYear !== undefined && endYear !== undefined
      ? buildGovernanceChangeResult({
          observations: dataset.observations,
          startYear,
          endYear,
          isInverted: dataset.isInverted,
        })
      : null;

  let visibleRows = result?.rows ?? [];
  if (result?.status === "ranked") {
    if (view === "increases") {
      visibleRows = visibleRows.filter(
        (row) => row.publisherAlignedDelta > 0,
      );
    } else if (view === "decreases") {
      visibleRows = [...visibleRows]
        .filter((row) => row.publisherAlignedDelta < 0)
        .reverse();
    }
  }
  const upstreamVintage = dataset?.upstreamReleases.join(", ") || null;

  return (
    <EditorialPage
      width="full"
      breadcrumbs={
        <ol className="editorial-breadcrumbs-list">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/governance-evidence">Governance Evidence</Link>
          </li>
          <li aria-current="page">Governance change</li>
        </ol>
      }
      title="Governance change"
      meta="Source-native longitudinal evidence · no Civica score"
    >
      <section className="editorial-section">
        <SectionHeader
          eyebrow="Longitudinal explorer"
          title="What changed on a declared publisher series?"
          dek="Choose one external indicator and exact start and end years. Civica reports the publisher-native difference and adjacent-year endpoint sensitivity; it does not combine indicators or assign country grades."
        />

        <Banner variant="info">
          “Increase” and “decrease” refer only to the selected publisher scale
          and its documented orientation. Historical observations come from
          one captured release, so publishers may revise earlier estimates.
          Observation-level uncertainty is shown only when retained; this
          archive currently carries point estimates, not confidence
          intervals.
        </Banner>

        <form className="editorial-filter-bar" method="get">
          <div className="editorial-filter-row">
            <label className="editorial-filter-form">
              <span className="editorial-filter-label">Series</span>
              <select name="series" defaultValue={`${selected.sourceId}:${selected.indicator}`}>
                {CHANGE_SERIES.map((entry) => (
                  <option
                    key={`${entry.sourceId}:${entry.indicator}`}
                    value={`${entry.sourceId}:${entry.indicator}`}
                  >
                    {entry.shortLabel} · {sourceLabel(entry.sourceId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="editorial-filter-form">
              <span className="editorial-filter-label">Start year</span>
              <select name="start" defaultValue={startYear}>
                {years
                  .filter((year) => endYear === undefined || year < endYear)
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
              </select>
            </label>
            <label className="editorial-filter-form">
              <span className="editorial-filter-label">End year</span>
              <select name="end" defaultValue={endYear}>
                {years
                  .filter(
                    (year) => startYear === undefined || year > startYear,
                  )
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
              </select>
            </label>
            <label className="editorial-filter-form">
              <span className="editorial-filter-label">View</span>
              <select name="view" defaultValue={view}>
                <option value="all">All comparable countries</option>
                <option value="increases">Largest increases</option>
                <option value="decreases">Largest decreases</option>
              </select>
            </label>
            <Button type="submit" variant="secondary" size="sm">
              Apply window
            </Button>
          </div>
        </form>

        {!dataset ? (
          <Banner variant="warn">
            The longitudinal source archive is temporarily unavailable. This
            outage is not a no-change or no-coverage result.
          </Banner>
        ) : !result ? (
          <Banner variant="info">
            This series has no valid two-endpoint window in the retained
            archive.
          </Banner>
        ) : (
          <>
            <div className="editorial-card">
              <div className="editorial-card-head">
                <div className="editorial-card-head-left">
                  <strong>{selected.label}</strong>
                  <Chip
                    variant={
                      result.status === "ranked" ? "sage" : "sand"
                    }
                  >
                    {result.status === "ranked"
                      ? "Comparable ranking available"
                      : "No ranking"}
                  </Chip>
                </div>
                <span>
                  <SourceDot
                    source={selected.sourceId}
                    retrievedAt={dataset.sourceLastSyncAt}
                    upstreamVintage={upstreamVintage}
                  />{" "}
                  {sourceLabel(selected.sourceId)}
                </span>
              </div>
              <p className="editorial-card-desc">
                {selected.definition} Window: {result.startYear}–
                {result.endYear}. Exact endpoints exist for{" "}
                {result.comparableJurisdictions} of{" "}
                {result.eligibleJurisdictions} sovereign-state records with
                any retained observation (
                {Math.round(result.coverageRatio * 100)}%).
              </p>
              <p className="editorial-card-desc">
                Native scale: {selected.nativeScale}. Captured release
                {dataset.upstreamReleases.length === 1 ? "" : "s"}:{" "}
                {upstreamVintage ?? "not recorded"}. Method:{" "}
                {dataset.methodVersions.join(", ") || "not recorded"}.
              </p>
            </div>

            {result.status === "no_ranking" ? (
              <Banner variant="warn">
                Civica is withholding the movers ordering because{" "}
                {result.reason}. The table remains alphabetical and shows
                only countries with both exact endpoint observations. Ranking
                requires at least {GOVERNANCE_CHANGE_MIN_COMPARABLE} countries
                and{" "}
                {Math.round(GOVERNANCE_CHANGE_MIN_COVERAGE * 100)}% coverage
                of countries with any observation in this source series.
              </Banner>
            ) : null}

            <DataTable aria-label={`${selected.label} source-native changes`}>
              <thead>
                <tr>
                  <th scope="col">
                    {result.status === "ranked" ? "Position" : "Order"}
                  </th>
                  <th scope="col">Country</th>
                  <th scope="col">{result.startYear}</th>
                  <th scope="col">{result.endYear}</th>
                  <th scope="col">Native change</th>
                  <th scope="col">Adjacent-endpoint range</th>
                  <th scope="col">Direction sensitivity</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.jurisdictionId}>
                    <td>{result.status === "ranked" ? index + 1 : "—"}</td>
                    <th scope="row">
                      <Link href={`/country/${row.jurisdictionSlug}/civica-data#ci-long-run`}>
                        {row.jurisdictionName}
                      </Link>
                    </th>
                    <td>{formatValue(row.startValue)}</td>
                    <td>{formatValue(row.endValue)}</td>
                    <td>{formatDelta(row.rawDelta)}</td>
                    <td>
                      {formatDelta(row.sensitivityMin)} to{" "}
                      {formatDelta(row.sensitivityMax)}
                      <small>
                        {row.sensitivityWindowCount} observed endpoint
                        combinations
                      </small>
                    </td>
                    <td>
                      {row.directionStable
                        ? "Same direction"
                        : "Direction changes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            <Banner variant="info">
              Missing endpoint years exclude a country from this window; they
              never become zero or “no change.” The adjacent-endpoint range is
              a sensitivity check, not a statistical confidence interval.
              {indicatorHistoryCatalogEntry(
                selected.sourceId,
                selected.indicator,
              )?.comparabilityNote}
            </Banner>
          </>
        )}
      </section>
    </EditorialPage>
  );
}
