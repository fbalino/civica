/**
 * `<ScoresAndRankings>` — the country Civica Data "Rankings" section
 * (CLM-020, publisher-attribution/v1).
 *
 * A server-rendered `DataTable` of the two publisher measures held in the
 * frozen Civica Index release, with three columns:
 *   - Measure: the publisher measure plus a chip naming the Civica release
 *     that holds the row;
 *   - Value: the publisher's own figure (V-Dem 0.769) or the Freedom House
 *     status with its edition ("Free · Freedom in the World 2024"). A value
 *     produced by applying the publisher's published rule carries a
 *     `ValueOriginNote`;
 *   - Observation year: the year the publisher's figure describes, with a
 *     `SourceDot` naming the manifest retrieval time and the publisher edition.
 *
 * The table carries no Civica calculation: no rescale, rank, trend, or
 * composite. Styling comes from the canonical `DataTable`, `Chip`,
 * `ValueOriginNote`, and `SourceDot` primitives (no local CSS). The two
 * "temporarily unavailable" banners keep a query outage distinct from an empty
 * result.
 */

import { Chip } from "@/components/editorial/Pill";
import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { SourceDot } from "@/components/SourceDot";
import { ValueOriginNote } from "@/components/provenance/ValueOriginNote";
import { scoreFreshnessPresentation } from "@/components/scores/freshness-label";
import type { ScoreRow } from "@/lib/ci/publisher-scores";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";

export interface ScoresAndRankingsProps {
  /** UUID jurisdictionId or slug. */
  jurisdictionId: string;
  /** Country name — used in empty-state copy. */
  countryName: string;
  /** Pre-fetched rows. When present the component skips the DB call; null
   *  means the query was unavailable. */
  rows?: ScoreRow[] | null;
}

export async function ScoresAndRankings({
  jurisdictionId,
  countryName,
  rows: prefetched,
}: ScoresAndRankingsProps) {
  if (prefetched === null) {
    return (
      <Banner variant="warn">
        Source-native score records are temporarily unavailable. Civica is not
        treating this as evidence that {countryName} has no published measures.
      </Banner>
    );
  }
  let rows: ScoreRow[];
  if (prefetched !== undefined) {
    rows = prefetched;
  } else {
    try {
      rows = await getScoresForJurisdiction(jurisdictionId);
    } catch {
      return (
        <Banner variant="warn">
          Source-native score records are temporarily unavailable. Civica is
          not treating this as evidence that {countryName} has no published
          measures.
        </Banner>
      );
    }
  }

  return <ScoresAndRankingsView rows={rows} countryName={countryName} />;
}

/** Pure presentational table; server-renderable without a database. */
export function ScoresAndRankingsView({
  rows,
  countryName,
}: {
  rows: readonly ScoreRow[];
  countryName: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="editorial-empty">
        Civica&apos;s frozen release holds no V-Dem or Freedom House row for{" "}
        {countryName}. This is a coverage state, not a judgment about the
        country.
      </p>
    );
  }

  return (
    <DataTable
      className="editorial-data-table--compact"
      aria-label={`Publisher measures for ${countryName}`}
    >
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th scope="col">Value</th>
          <th scope="col" className="num">
            Observation year
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const freshness = scoreFreshnessPresentation(row);
          return (
            <tr key={row.id}>
              <th scope="row">
                {row.label}{" "}
                <Chip
                  variant={freshness.variant}
                  size="sm"
                  aria-label={freshness.ariaLabel}
                >
                  {freshness.label}
                </Chip>
              </th>
              <td>
                {row.scoreFormatted}
                <ValueOriginNote origin={row.valueOrigin} />
              </td>
              <td className="num">
                {row.observationPeriod}{" "}
                <SourceDot
                  source={row.source}
                  retrievedAt={row.retrievedAt}
                  upstreamVintage={`${row.publisherEdition}, ${row.observationPeriodLabel}`}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
