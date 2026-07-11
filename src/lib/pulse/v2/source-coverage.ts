import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { SOURCE_INPUT_SPECS } from "@/lib/data/source-input-manifest";
import { sourceRights } from "@/lib/rights/manifest";
import { pulseConnectorMetricKey } from "./ingest";
import {
  CURRENT_PULSE_RUNTIME_METHOD,
  type PulseConnectorFact,
} from "./runtime-contract";

export const PULSE_SOURCE_COVERAGE_SCHEMA_VERSION =
  "pulse-source-coverage/v1" as const;

export type PulseFeedOperatingState = "operating" | "degraded" | "inactive";

export interface PulseIngestRunObservation {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  counts: Record<string, number>;
}

export interface PulseSourceEvidenceAggregate {
  sourceId: string;
  retainedRows: number;
  lastDataAt: string | null;
  languages: string[];
  jurisdictionIso3s: string[];
  unresolvedJurisdictionRows: number;
}

export interface PulseFeedCoverage {
  feedId: string;
  connectorId: string;
  sourceIds: string[];
  role: "specialist" | "news";
  state: PulseFeedOperatingState;
  stateReason: string;
  retrieval: {
    observedRuns: number;
    successfulRuns: number;
    failedRuns: number;
    latestAttemptAt: string | null;
    latestOutcome: "successful" | "failed" | "not_observed";
    latestFetched: number | null;
    latestYield: number | null;
    latestInserted: number | null;
    latestSkippedDuplicate: number | null;
    latestUnmatchedCountry: number | null;
  };
  evidence: {
    retainedRows: number;
    lastDataAt: string | null;
    languages: string[];
    observedJurisdictions: number;
    jurisdictionIso3s: string[];
    unresolvedJurisdictionRows: number;
  };
  rights: Array<{
    sourceId: string;
    licenseId: string;
    termsUrl: string | null;
    reviewStatus: "verified" | "pending" | "missing";
    publicExport: string;
    redistributionPosture: string;
    restrictions: string[];
  }>;
  activation: string;
  blindSpots: string[];
}

export interface PulseSourceCoverageReport {
  schemaVersion: typeof PULSE_SOURCE_COVERAGE_SCHEMA_VERSION;
  generatedAt: string;
  standing: "operational_observability_not_retrieval_validation";
  feeds: PulseFeedCoverage[];
  summary: {
    operating: number;
    degraded: number;
    inactive: number;
  };
}

function metric(
  run: PulseIngestRunObservation,
  connectorId: string,
  name: Parameters<typeof pulseConnectorMetricKey>[1],
): number | null {
  const value = run.counts[pulseConnectorMetricKey(connectorId, name)];
  return Number.isFinite(value) ? value : null;
}

function maxIso(values: Array<string | null>): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

function feedCoverage(
  connector: PulseConnectorFact,
  runs: readonly PulseIngestRunObservation[],
  evidenceRows: readonly PulseSourceEvidenceAggregate[],
): PulseFeedCoverage {
  const declaredOperating =
    connector.status === "active_observed" && connector.observedInProduction;
  const observedRuns = declaredOperating
    ? runs.filter(
        (run) => metric(run, connector.connectorId, "failed") !== null,
      )
    : [];
  const latest = observedRuns[0] ?? null;
  const latestFailed = latest
    ? metric(latest, connector.connectorId, "failed") === 1
    : false;
  const evidence = evidenceRows.filter(({ sourceId }) =>
    connector.sourceIds.includes(sourceId),
  );
  const retainedRows = evidence.reduce((sum, row) => sum + row.retainedRows, 0);
  const rightsComplete = connector.sourceIds.every(
    (sourceId) =>
      sourceRights(sourceId) &&
      SOURCE_INPUT_SPECS.some((row) => row.sourceId === sourceId),
  );
  let state: PulseFeedOperatingState;
  let stateReason: string;
  if (!declaredOperating) {
    state = "inactive";
    stateReason = connector.activation;
  } else if (!latest) {
    state = "degraded";
    stateReason =
      "No connector-level retrieval telemetry has been retained yet.";
  } else if (latestFailed) {
    state = "degraded";
    stateReason = "The latest observed connector retrieval failed.";
  } else if (!rightsComplete) {
    state = "degraded";
    stateReason = "A complete source-input and rights contract is missing.";
  } else if (retainedRows === 0) {
    state = "degraded";
    stateReason =
      "The connector ran, but no retained evidence rows establish coverage.";
  } else {
    state = "operating";
    stateReason =
      "The latest connector attempt succeeded and retained evidence exists.";
  }

  const languages = [
    ...new Set(evidence.flatMap((row) => row.languages)),
  ].sort();
  const jurisdictionIso3s = [
    ...new Set(evidence.flatMap((row) => row.jurisdictionIso3s)),
  ].sort();
  const rights = connector.sourceIds.map((sourceId) => {
    const record = sourceRights(sourceId);
    const spec = SOURCE_INPUT_SPECS.find((row) => row.sourceId === sourceId);
    if (!record || !spec)
      return {
        sourceId,
        licenseId: "unregistered",
        termsUrl: null,
        reviewStatus: "missing" as const,
        publicExport: "blocked",
        redistributionPosture: "unregistered",
        restrictions: ["No source-input and rights contract is registered."],
      };
    return {
      sourceId,
      licenseId: record.licenseId,
      termsUrl: record.termsUrl,
      reviewStatus: record.reviewStatus,
      publicExport: record.publicExport,
      redistributionPosture: spec.redistributionPosture,
      restrictions: [...record.restrictions],
    };
  });

  return {
    feedId: connector.feedId,
    connectorId: connector.connectorId,
    sourceIds: [...connector.sourceIds],
    role: connector.role,
    state,
    stateReason,
    retrieval: {
      observedRuns: observedRuns.length,
      successfulRuns: observedRuns.filter(
        (run) => metric(run, connector.connectorId, "failed") === 0,
      ).length,
      failedRuns: observedRuns.filter(
        (run) => metric(run, connector.connectorId, "failed") === 1,
      ).length,
      latestAttemptAt: latest?.startedAt ?? null,
      latestOutcome: !latest
        ? "not_observed"
        : latestFailed
          ? "failed"
          : "successful",
      latestFetched: latest
        ? metric(latest, connector.connectorId, "fetched")
        : null,
      latestYield: latest
        ? metric(latest, connector.connectorId, "wouldWrite")
        : null,
      latestInserted: latest
        ? metric(latest, connector.connectorId, "inserted")
        : null,
      latestSkippedDuplicate: latest
        ? metric(latest, connector.connectorId, "skippedDuplicate")
        : null,
      latestUnmatchedCountry: latest
        ? metric(latest, connector.connectorId, "unmatchedCountry")
        : null,
    },
    evidence: {
      retainedRows,
      lastDataAt: maxIso(evidence.map((row) => row.lastDataAt)),
      languages,
      observedJurisdictions: jurisdictionIso3s.length,
      jurisdictionIso3s,
      unresolvedJurisdictionRows: evidence.reduce(
        (sum, row) => sum + row.unresolvedJurisdictionRows,
        0,
      ),
    },
    rights,
    activation: connector.activation,
    blindSpots: [...connector.blindSpots],
  };
}

export function buildPulseSourceCoverageReport(input: {
  generatedAt: string;
  runs: readonly PulseIngestRunObservation[];
  evidence: readonly PulseSourceEvidenceAggregate[];
  connectors?: readonly PulseConnectorFact[];
}): PulseSourceCoverageReport {
  const connectors =
    input.connectors ?? CURRENT_PULSE_RUNTIME_METHOD.feeds.connectors;
  const feeds = connectors
    .map((connector) => feedCoverage(connector, input.runs, input.evidence))
    .sort((a, b) => a.feedId.localeCompare(b.feedId));
  return {
    schemaVersion: PULSE_SOURCE_COVERAGE_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    standing: "operational_observability_not_retrieval_validation",
    feeds,
    summary: {
      operating: feeds.filter(({ state }) => state === "operating").length,
      degraded: feeds.filter(({ state }) => state === "degraded").length,
      inactive: feeds.filter(({ state }) => state === "inactive").length,
    },
  };
}

function rows(result: unknown): Array<Record<string, unknown>> {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? [])
  ) as Array<Record<string, unknown>>;
}

function databaseTimestamp(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  const normalized = /(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(raw)
    ? raw
    : `${raw.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function loadPulseSourceCoverageReport(): Promise<PulseSourceCoverageReport> {
  const db = getDb();
  const [runResult, evidenceResult] = await Promise.all([
    db.execute(sql`
      SELECT id::text, status, started_at::text, completed_at::text, counts
      FROM pulse_pipeline_runs
      WHERE stage = 'ingest' AND status <> 'legacy'
      ORDER BY started_at DESC
      LIMIT 30
    `),
    db.execute(sql`
      SELECT r.source_id,
        COUNT(*)::int AS retained_rows,
        MAX(r.retrieved_at)::text AS last_data_at,
        ARRAY_AGG(DISTINCT r.evidence_language ORDER BY r.evidence_language) AS languages,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT j.iso3 ORDER BY j.iso3), NULL) AS jurisdiction_iso3s,
        COUNT(*) FILTER (WHERE r.jurisdiction_id IS NULL)::int AS unresolved_jurisdiction_rows
      FROM raw_events r
      LEFT JOIN jurisdictions j ON j.id = r.jurisdiction_id
      GROUP BY r.source_id
      ORDER BY r.source_id
    `),
  ]);
  return buildPulseSourceCoverageReport({
    generatedAt: new Date().toISOString(),
    runs: rows(runResult).map((row) => ({
      id: String(row.id),
      status: String(row.status),
      startedAt: databaseTimestamp(row.started_at) ?? String(row.started_at),
      completedAt: databaseTimestamp(row.completed_at),
      counts: (row.counts ?? {}) as Record<string, number>,
    })),
    evidence: rows(evidenceResult).map((row) => ({
      sourceId: String(row.source_id),
      retainedRows: Number(row.retained_rows),
      lastDataAt: databaseTimestamp(row.last_data_at),
      languages: (row.languages ?? []) as string[],
      jurisdictionIso3s: (row.jurisdiction_iso3s ?? []) as string[],
      unresolvedJurisdictionRows: Number(row.unresolved_jurisdiction_rows),
    })),
  });
}
