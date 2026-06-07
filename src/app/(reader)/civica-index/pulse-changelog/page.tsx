import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import {
  getPulseV2Changelog,
  type PulseV2ChangelogRow,
} from "@/lib/db/queries-pulse-v2";
import { pulse } from "@/lib/content/site-state";
import { PulseChangelogFilterClient } from "./PulseChangelogFilterClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pulse changelog (Beta) — Civica Index",
  description:
    "Every governance event classified by the Civica Pulse Beta pipeline. Filterable by country, dimension, and severity, with full source attribution and human-review status.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/pulse-changelog",
  },
};

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

  return (
    <EditorialPage width="wide">
      <nav className="editorial-breadcrumbs">
        <Link href="/civica-index">← Civica Index</Link>
        <span>/</span>
        Pulse changelog
      </nav>

      <h1 className="editorial-page-title">
        Pulse changelog
        {pulse.status === "beta" ? (
          <span className="editorial-beta-tag">Beta</span>
        ) : null}
      </h1>
      <p className="editorial-page-subtitle">
        Every governance event classified by the Civica Pulse Beta pipeline.
        Updated daily.
      </p>

      <div className="editorial-warning">
        The Civica Pulse Beta is a real-time governance shock monitor under
        active validation. Events queued for human review (
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
