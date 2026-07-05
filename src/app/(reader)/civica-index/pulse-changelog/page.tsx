import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { BetaChip } from "@/components/editorial/BetaChip";
import {
  getPulseV2Changelog,
  type PulseV2ChangelogRow,
} from "@/lib/db/queries-pulse-v2";
import { pulse } from "@/lib/content/site-state";
import { PulseChangelogFilterClient } from "./PulseChangelogFilterClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica Pulse Changelog — Classified Events (Beta)",
  description:
    "Every governance event classified by the Civica Pulse Beta pipeline, filterable by country, dimension, and severity, with full source attribution and human-review status.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/pulse-changelog",
  },
};

/** Format an event date string as an editorial "3 May 2026" label.
 *  UTC-pinned so the rendered value is deterministic regardless of
 *  server timezone, and never drifts to today's clock date. */
function formatAsOfDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function PulseChangelogPage() {
  let countries: Array<{ slug: string; name: string }> = [];
  let events: PulseV2ChangelogRow[] = [];

  try {
    const [countryRows, published, review] = await Promise.all([
      db
        .select({ slug: jurisdictions.slug, name: jurisdictions.name })
        .from(jurisdictions)
        .orderBy(jurisdictions.name),
      getPulseV2Changelog({ publishedOnly: true, limit: 2500 }),
      getPulseV2Changelog({ publishedOnly: false, limit: 2500 }),
    ]);

    countries = countryRows;
    const seen = new Set<string>();
    events = [...published.rows, ...review.rows].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  } catch {
    // Keep the public changelog shell renderable during DB outages.
  }

  // Honest freshness label. The automated daily Pulse refresh is
  // currently paused, so surface the date of the most recent classified
  // event (the real as-of value) instead of implying a live daily feed.
  // Falls back to neutral phrasing when no events are loaded (DB outage).
  const mostRecentEventDate = events.reduce<string | null>((latest, e) => {
    if (!e.eventDate) return latest;
    return !latest || e.eventDate > latest ? e.eventDate : latest;
  }, null);
  const freshnessNote = mostRecentEventDate
    ? `The automated daily refresh is currently paused; the most recent classified event is dated ${formatAsOfDate(mostRecentEventDate)}.`
    : "The automated daily refresh is currently paused; showing the latest available data.";

  return (
    <EditorialPage width="wide">
      <nav className="editorial-breadcrumbs">
        <Link href="/civica-index">← Civica Index</Link>
        <span>/</span>
        Pulse changelog
      </nav>

      <h1 className="editorial-page-title">
        Pulse changelog
        {pulse.status === "beta" ? <BetaChip inHeading /> : null}
      </h1>
      <p className="editorial-page-subtitle">
        Every governance event classified by the Civica Pulse Beta pipeline.
        {freshnessNote}
      </p>

      <div className="editorial-warning">
        The Civica Pulse Beta is an event-sensitive governance shock monitor
        under active validation. Its automated daily refresh is currently
        paused, so the events below reflect the most recent computation rather
        than a live feed. Events queued for human review (
        <strong>severe and catastrophic severity tiers</strong>, plus events
        where the classifier didn&apos;t reach consensus) do{" "}
        <strong>not</strong> drive published Pulse scores until a reviewer
        confirms them. See the{" "}
        <Link href="/civica-index/methodology/pulse">Pulse methodology</Link>{" "}
        for the full pipeline.
      </div>

      <Suspense fallback={null}>
        <PulseChangelogFilterClient events={events} countries={countries} />
      </Suspense>
    </EditorialPage>
  );
}
