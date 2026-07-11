import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { neon } from "@neondatabase/serverless";
import {
  deriveSourceIndependence,
  publisherFamily,
  PULSE_SOURCE_INDEPENDENCE_VERSION,
  type SourceEvidenceReport,
} from "../src/lib/pulse/v2/source-independence";

type EvidencePublisher = {
  sourceFamilyId?: string;
  itemPublisherHost?: string | null;
};

type Row = {
  eventId: string;
  rawEventId: string;
  sourceId: string;
  sourceType: "specialist" | "news";
  sourceUrl: string | null;
  title: string;
  body: string | null;
  evidencePublisher: EvidencePublisher;
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const rows = (await sql`
    SELECT
      ps.event_id::text AS "eventId",
      r.id::text AS "rawEventId",
      ps.source_id AS "sourceId",
      ps.source_type AS "sourceType",
      ps.source_url AS "sourceUrl",
      r.title,
      r.body,
      r.evidence_publisher AS "evidencePublisher"
    FROM pulse_sources ps
    JOIN raw_events r ON r.id = ps.raw_event_id
    ORDER BY ps.event_id, r.id
  `) as Row[];

  const byEvent = new Map<string, SourceEvidenceReport[]>();
  for (const row of rows) {
    const publisher = row.evidencePublisher ?? {};
    const report: SourceEvidenceReport = {
      rawEventId: row.rawEventId,
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      sourceFamilyId: publisher.sourceFamilyId ?? row.sourceId,
      itemPublisherHost: publisher.itemPublisherHost ?? null,
      title: row.title,
      body: row.body,
    };
    byEvent.set(row.eventId, [...(byEvent.get(row.eventId) ?? []), report]);
  }

  const reasonCounts: Record<string, number> = {};
  let independentEvidenceGroups = 0;
  let dependentPairs = 0;
  let eventsCollapsed = 0;
  let unresolvedPublisherReports = 0;
  let specialistGroups = 0;
  let newsGroups = 0;
  let maximumReportsPerEvent = 0;
  let maximumGroupsPerEvent = 0;

  for (const reports of byEvent.values()) {
    const result = deriveSourceIndependence(reports);
    independentEvidenceGroups += result.groups.length;
    specialistGroups += result.groups.filter(
      ({ sourceType }) => sourceType === "specialist",
    ).length;
    newsGroups += result.groups.filter(
      ({ sourceType }) => sourceType === "news",
    ).length;
    if (result.groups.length < reports.length) eventsCollapsed++;
    maximumReportsPerEvent = Math.max(maximumReportsPerEvent, reports.length);
    maximumGroupsPerEvent = Math.max(
      maximumGroupsPerEvent,
      result.groups.length,
    );
    unresolvedPublisherReports += reports.filter(
      (report) => publisherFamily(report) === "unresolved-publisher",
    ).length;
    for (const relation of result.relations) {
      if (!relation.dependent) continue;
      dependentPairs++;
      reasonCounts[relation.reason] = (reasonCounts[relation.reason] ?? 0) + 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        version: PULSE_SOURCE_INDEPENDENCE_VERSION,
        generatedAt: new Date().toISOString(),
        standing: "descriptive_live_audit_not_validation",
        eventsWithEvidence: byEvent.size,
        reports: rows.length,
        independentEvidenceGroups,
        specialistGroups,
        newsGroups,
        dependentPairs,
        eventsCollapsed,
        unresolvedPublisherReports,
        maximumReportsPerEvent,
        maximumGroupsPerEvent,
        dependenceReasons: reasonCounts,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
