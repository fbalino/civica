import type { Metadata } from "next";
import Link from "next/link";

import leaderRelease from "../../../../data/leaders-directory-release.v1.json";
import { Banner } from "@/components/editorial/Banner";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { WorldLeadersDirectoryClient } from "@/components/leaders/WorldLeadersDirectoryClient";
import {
  getWorldLeadersDirectory,
} from "@/lib/leaders/query";
import {
  leaderDirectoryCountSummary,
  type LeaderDirectoryRow,
} from "@/lib/leaders/directory";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "World Leaders Directory",
  description:
    "Verified current heads of state and heads of government, with sourced tenure dates and ambiguity disclosures.",
  alternates: { canonical: "https://civicaatlas.org/leaders" },
};

export default async function WorldLeadersDirectoryPage() {
  let rows: LeaderDirectoryRow[] = [];
  let available = false;
  const publicationReady = leaderRelease.publicationStatus === "ready";
  if (publicationReady) {
    try {
      rows = await getWorldLeadersDirectory();
      available = true;
    } catch {
      // The shell distinguishes a database outage from a verified zero-row result.
    }
  }
  const counts = leaderDirectoryCountSummary(rows);

  return (
    <EditorialPage
      width="full"
      breadcrumbs={
        <ol className="editorial-breadcrumbs-list">
          <li><Link href="/">Home</Link></li>
          <li aria-current="page">World leaders</li>
        </ol>
      }
      title="World leaders"
      meta={
        publicationReady && available
          ? `${counts.people.toLocaleString("en")} people · ${counts.jurisdictions.toLocaleString("en")} countries and areas · live verified records`
          : "Current-officeholder verification in progress"
      }
    >
      <section className="editorial-section">
        <SectionHeader
          eyebrow="Atlas directory"
          title="Current principal officeholders"
          dek="Search and sort source-backed heads of state and heads of government. Missing portraits, dates, or records remain missing; they never imply that a country lacks a leader."
        />
        <Banner variant="info">
          This is a live directory, not a rank. Acting, interim, and caretaker
          labels appear only when the retained source office title says so.
          Multiple people in the same principal role are marked as
          co-leadership; one person holding both principal roles is marked
          separately as dual office. Wikidata does not publish a named dataset
          vintage for this pipeline, so each record exposes its retained
          retrieval date instead.
        </Banner>
        {!publicationReady ? (
          <Banner variant="warn">
            Publication is paused while Civica refreshes the retained
            officeholder source and resolves stale or ambiguous current-term
            records. The directory does not publish the older roster as
            current.
          </Banner>
        ) : !available ? (
          <Banner variant="warn">
            Leadership records are temporarily unavailable. Civica is not
            treating this outage as an empty world-leaders directory.
          </Banner>
        ) : rows.length === 0 ? (
          <Banner variant="info">
            No source-verified current principal-office records are available.
          </Banner>
        ) : (
          <WorldLeadersDirectoryClient rows={rows} />
        )}
      </section>
    </EditorialPage>
  );
}
