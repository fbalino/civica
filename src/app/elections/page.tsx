import type { Metadata } from "next";
import {
  getUpcomingElections,
  getRecentElectionsWithResults,
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
  let recent: Awaited<ReturnType<typeof getRecentElectionsWithResults>> = [];
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
  let electionDataAvailable = false;
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

  try {
    [upcoming, recent] = await Promise.all([
      getUpcomingElections(500),
      // Load every past election that carries compiled results (≈195 today) so
      // the hero country filter is honest — a country's older results-bearing
      // election must still surface when a reader narrows to it, not fall
      // outside a short recency window. Grouped by year in the client.
      getRecentElectionsWithResults(400),
    ]);
    electionDataAvailable = true;

  } catch (err) {
    console.error("[elections] stats query failed:", err);
  }

  // The full-bleed engraving hero (with the country typeahead) lives inside
  // ElectionsClient so the hero search can drive the client-side filter.
  return (
    <ElectionsClient
      upcoming={upcoming}
      recent={recent}
      stats={stats}
      coverage={coverage}
      dataAvailable={electionDataAvailable}
    />
  );
}
