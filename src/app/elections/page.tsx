import type { Metadata } from "next";
import {
  getFactbookCountryOptions,
  getQualifiedElectionResearchRows,
  getUpcomingElections,
} from "@/lib/db/queries";
import ElectionsClient from "./ElectionsClient";
import { withOg } from "@/lib/og";
import {
  ELECTION_CORPUS_AUDIT,
  getElectionProjectionDisplayGroupCount,
} from "@/lib/elections/corpus-audit-runtime";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cross-national Election Records — Calendar & Results",
  description:
    "An audited multi-source collection of national election records: legislative contests from IPU Parline, uneven presidential records from Wikidata, turnout from International IDEA, and separately labelled term-length projections.",
  alternates: { canonical: "https://civicaatlas.org/elections" },
  openGraph: withOg({
    title: "Cross-national Election Records — Calendar & Results · Civica Atlas",
    description:
      "An audited multi-source collection of legislative contests, uneven presidential records, turnout, and separately labelled term-length projections.",
    url: "https://civicaatlas.org/elections",
  }),
};

export default async function ElectionsPage() {
  let upcoming: Awaited<ReturnType<typeof getUpcomingElections>> = [];
  type ResearchRow = Awaited<
    ReturnType<typeof getQualifiedElectionResearchRows>
  >[number];
  let recent: Array<ResearchRow & { relatedContests: ResearchRow[] }> = [];
  let countryOptions: Awaited<ReturnType<typeof getFactbookCountryOptions>> = [];
  const stats: {
    qualifiedEvents: number;
    sovereignJurisdictions: number;
    sourceDatedUpcoming: number;
    projectionGroups: number;
  } = {
    qualifiedEvents: ELECTION_CORPUS_AUDIT.qualified.conceptualEvents,
    sovereignJurisdictions:
      ELECTION_CORPUS_AUDIT.qualified.sovereignJurisdictions,
    sourceDatedUpcoming:
      ELECTION_CORPUS_AUDIT.qualified.sourceDatedUpcomingEvents,
    projectionGroups: getElectionProjectionDisplayGroupCount(),
  };
  let upcomingDataAvailable = false;
  let historicalDataAvailable = false;
  const sourceById = new Map(
    ELECTION_CORPUS_AUDIT.sourceRights.map((source) => [
      source.sourceId,
      source,
    ]),
  );
  const coverage = {
    asOf: ELECTION_CORPUS_AUDIT.asOf,
    baselineRows: ELECTION_CORPUS_AUDIT.raw.rows,
    qualifiedEvents: ELECTION_CORPUS_AUDIT.qualified.conceptualEvents,
    quarantinedRows: ELECTION_CORPUS_AUDIT.qualified.quarantinedRows,
    legislativeJurisdictions:
      ELECTION_CORPUS_AUDIT.qualified.legislativeJurisdictions,
    presidentialJurisdictions:
      ELECTION_CORPUS_AUDIT.qualified.presidentialJurisdictions,
    turnoutRows: ELECTION_CORPUS_AUDIT.qualified.turnoutEligibleRows,
    projectionGroups: getElectionProjectionDisplayGroupCount(),
    limitedRecognitionJurisdictions:
      ELECTION_CORPUS_AUDIT.qualified.limitedRecognitionJurisdictions,
    ipuRightsReview: sourceById.get("ipu_parline")?.reviewStatus ?? "pending",
    ideaRightsReview:
      sourceById.get("international_idea")?.reviewStatus ?? "pending",
  };

  const [upcomingResult, recentResult, countryOptionsResult] =
    await Promise.allSettled([
      getUpcomingElections(500),
      // Load every past election that carries compiled results (≈195 today) so
      // the hero country filter is honest — a country's older results-bearing
      // election must still surface when a reader narrows to it, not fall
      // outside a short recency window. Grouped by year in the client.
      getQualifiedElectionResearchRows(),
      getFactbookCountryOptions(),
    ]);

  if (upcomingResult.status === "fulfilled") {
    upcoming = upcomingResult.value;
    upcomingDataAvailable = true;
  } else {
    console.error("[elections] future query failed:", upcomingResult.reason);
  }
  if (recentResult.status === "fulfilled") {
    const historicalRows = recentResult.value.filter(
      (row) => row.audit.temporalClass === "historical",
    );
    recent = historicalRows
      .filter((row) => row.audit.primaryRowId === row.election.id)
      .map((row) => ({
        ...row,
        relatedContests: historicalRows.filter(
          (candidate) =>
            candidate.election.id !== row.election.id &&
            candidate.audit.primaryRowId === row.election.id,
        ),
      }))
      .sort((a, b) =>
        (b.election.electionDate ?? "").localeCompare(
          a.election.electionDate ?? "",
        ),
      );
    historicalDataAvailable = true;
  } else {
    console.error("[elections] historical query failed:", recentResult.reason);
  }
  if (countryOptionsResult.status === "fulfilled") {
    countryOptions = countryOptionsResult.value;
  } else {
    console.error(
      "[elections] jurisdiction catalog query failed:",
      countryOptionsResult.reason,
    );
  }

  const countryCoverage = Object.fromEntries(
    countryOptions.map((country) => {
      const rows = ELECTION_CORPUS_AUDIT.rows.filter(
        (row) => row.jurisdiction.slug === country.slug,
      );
      const publicRows = rows.filter(
        (row) =>
          row.disposition === "qualified_event" ||
          row.disposition === "qualified_contest",
      );
      return [
        country.slug,
        {
          historicalRecords: publicRows.filter(
            (row) => row.temporalClass === "historical",
          ).length,
          sourceDatedFuture: publicRows.filter(
            (row) => row.temporalClass === "source_dated_upcoming",
          ).length,
          hasProjection: rows.some(
            (row) => row.disposition === "projection_only",
          ),
          compiledResults: publicRows.filter(
            (row) => row.fieldEligibility.results,
          ).length,
          quarantinedRecords: rows.filter(
            (row) => row.disposition === "quarantined",
          ).length,
        },
      ];
    }),
  );

  // The full-bleed engraving hero (with the country typeahead) lives inside
  // ElectionsClient so the hero search can drive the client-side filter.
  return (
    <ElectionsClient
      upcoming={upcoming}
      recent={recent}
      stats={stats}
      coverage={coverage}
      countryOptions={countryOptions}
      countryCoverage={countryCoverage}
      upcomingDataAvailable={upcomingDataAvailable}
      historicalDataAvailable={historicalDataAvailable}
    />
  );
}
