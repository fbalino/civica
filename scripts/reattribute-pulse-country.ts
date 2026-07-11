/**
 * Re-evaluate retained Pulse events with the current versioned jurisdiction
 * attribution contract. Dry-run is the default. Apply mode appends a new
 * subject-attribution decision and updates only the primary event projection;
 * it never overwrites decision history.
 */
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import {
  resolveSubjectJurisdiction,
  subjectAttributionDecisionPayload,
  type ResolvedSubjectAttribution,
} from "../src/lib/pulse/v2/country-attribution";
import { persistPulseDecisions, latestPulseDecisionKeys } from "../src/lib/pulse/v2/decision-ledger-store";
import type { PulseDecisionInput } from "../src/lib/pulse/v2/decision-ledger";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
} from "../src/lib/pulse/v2/pipeline-version";
import { PULSE_RUNTIME_METHOD_VERSION } from "../src/lib/pulse/v2/runtime-contract";
import { PULSE_JURISDICTION_ATTRIBUTION_VERSION } from "../src/lib/pulse/v2/jurisdiction-entities";
import { calculateDimensionalDeltas } from "../src/lib/pulse/v2/score";
import { versioned } from "../src/lib/research/derivation-version";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 6;

interface EventRow {
  id: string;
  clusterId: string;
  currentJurisdictionId: string;
  currentIso3: string | null;
  currentName: string;
  eventDate: string;
  headline: string;
  description: string;
  classificationRunId: string;
  rawEventIds: string[];
}

function rows(result: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function main() {
  console.log(`Pulse jurisdiction re-attribution — ${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  const events: EventRow[] = rows(
    await db.execute(sql`
      SELECT
        e.id::text,
        e.cluster_id::text,
        e.jurisdiction_id::text AS current_jurisdiction_id,
        j.iso3 AS current_iso3,
        j.name AS current_name,
        e.event_date,
        e.headline,
        e.description,
        e.classification_run_id::text,
        COALESCE(
          array_agg(ps.raw_event_id::text ORDER BY ps.raw_event_id)
            FILTER (WHERE ps.raw_event_id IS NOT NULL),
          ARRAY[]::text[]
        ) AS raw_event_ids
      FROM pulse_events_v2 e
      JOIN jurisdictions j ON j.id = e.jurisdiction_id
      LEFT JOIN pulse_sources ps ON ps.event_id = e.id
      GROUP BY e.id, j.iso3, j.name
      ORDER BY e.event_date DESC, e.id
    `),
  ).map((row) => ({
    id: String(row.id),
    clusterId: String(row.cluster_id),
    currentJurisdictionId: String(row.current_jurisdiction_id),
    currentIso3: row.current_iso3 == null ? null : String(row.current_iso3),
    currentName: String(row.current_name),
    eventDate: String(row.event_date),
    headline: String(row.headline),
    description: String(row.description ?? ""),
    classificationRunId: String(row.classification_run_id),
    rawEventIds: (row.raw_event_ids as string[]) ?? [],
  }));

  const attributions = await pool(events, CONCURRENCY, (event) =>
    resolveSubjectJurisdiction(
      db,
      event.headline,
      event.description,
      event.currentJurisdictionId,
    ),
  );
  const resolved = events
    .map((event, index) => ({ event, attribution: attributions[index] }))
    .filter(
      (row): row is { event: EventRow; attribution: ResolvedSubjectAttribution & { primaryJurisdictionId: string } } =>
        Boolean(row.attribution.primaryJurisdictionId),
    );
  const unresolved = events.length - resolved.length;
  const changed = resolved.filter(
    ({ event, attribution }) =>
      attribution.primaryJurisdictionId !== event.currentJurisdictionId,
  );

  const report = [
    `# Pulse jurisdiction re-attribution — ${APPLY ? "APPLIED" : "DRY-RUN"}`,
    "",
    `Events: ${events.length}; resolved: ${resolved.length}; primary changes: ${changed.length}; unresolved: ${unresolved}.`,
    "",
    "## Proposed primary changes",
    "",
    ...changed.map(({ event, attribution }) => {
      const primary = attribution.attributions.find((row) => row.role === "primary");
      const affected = attribution.attributions
        .filter((row) => row.role === "affected")
        .map((row) => row.entity.iso3)
        .join(", ");
      return `- ${event.currentIso3 ?? "unknown"} → ${primary?.entity.iso3 ?? "unresolved"}${affected ? `; affected: ${affected}` : ""} — ${event.headline}\n  ${attribution.rationale}`;
    }),
    "",
    "Unresolved results are retained for review and are never replaced by the provisional ingest guess in the decision ledger.",
  ];
  const outPath =
    process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ??
    resolve(process.cwd(), "plan", "pulse-reattribution-current.md");
  await writeFile(outPath, `${report.join("\n")}\n`);
  console.log(`Events ${events.length}; resolved ${resolved.length}; changed ${changed.length}; unresolved ${unresolved}`);
  console.log(`Report: ${outPath}`);

  if (!APPLY) return;
  const runRef = createPulsePipelineRunRef("classify", {
    upstreamRunIds: events.map((event) => event.classificationRunId),
    models: [
      {
        role: "subject_attribution",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
      },
    ],
    prompt: versioned(PULSE_JURISDICTION_ATTRIBUTION_VERSION),
    algorithm: versioned(PULSE_JURISDICTION_ATTRIBUTION_VERSION),
  });
  await startPulsePipelineRun(db, runRef);
  const decidedAt = new Date().toISOString();
  for (const [index, event] of events.entries()) {
    const attribution = attributions[index];
    const kinds = attribution.primaryJurisdictionId
      ? (["subject_attribution"] as const)
      : (["subject_attribution", "publication"] as const);
    const latest = await latestPulseDecisionKeys(db, event.id, kinds);
    const decisions: PulseDecisionInput[] = [
      {
        clusterId: event.clusterId,
        eventId: event.id,
        kind: "subject_attribution",
        verdict: attribution.primaryJurisdictionId
          ? "affirmed" as const
          : "unresolved" as const,
        payload: subjectAttributionDecisionPayload(attribution),
        actor: {
          type: "subject_attributor",
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          reviewerId: null,
        },
        stageRunId: runRef.id,
        methodVersion: PULSE_RUNTIME_METHOD_VERSION,
        rationale: attribution.rationale,
        evidenceRefs: event.rawEventIds.length
          ? event.rawEventIds.map((id) => `raw-event:${id}`)
          : ["event-projection"],
        supersedesDecisionKey: latest.subject_attribution ?? null,
        decidedAt,
      },
    ];
    if (!attribution.primaryJurisdictionId) {
      decisions.push({
        clusterId: event.clusterId,
        eventId: event.id,
        kind: "publication",
        verdict: "refuted",
        payload: {
          eligible: false,
          origin: "queued",
          gateReasons: ["subject_attribution_unresolved"],
        },
        actor: {
          type: "publication_gate",
          provider: null,
          model: null,
          reviewerId: null,
        },
        stageRunId: runRef.id,
        methodVersion: PULSE_RUNTIME_METHOD_VERSION,
        rationale: "The current subject-attribution pass did not resolve one primary jurisdiction.",
        evidenceRefs: event.rawEventIds.length
          ? event.rawEventIds.map((id) => `raw-event:${id}`)
          : ["event-projection"],
        supersedesDecisionKey: latest.publication ?? null,
        decidedAt,
      });
    }
    await persistPulseDecisions(db, decisions);
    if (
      attribution.primaryJurisdictionId &&
      attribution.primaryJurisdictionId !== event.currentJurisdictionId
    ) {
      await db.execute(sql`
        UPDATE pulse_events_v2
        SET jurisdiction_id = ${attribution.primaryJurisdictionId}::uuid,
            updated_at = now()
        WHERE id = ${event.id}::uuid
      `);
    } else if (!attribution.primaryJurisdictionId) {
      await db.execute(sql`
        UPDATE pulse_events_v2
        SET published = false,
            review_status = 'pending',
            publication_run_id = NULL,
            updated_at = now()
        WHERE id = ${event.id}::uuid
      `);
    }
  }
  await finishPulsePipelineRun(db, runRef.id, {
    status: unresolved > 0 ? "partial" : "completed",
    counts: { events: events.length, resolved: resolved.length, changed: changed.length, unresolved },
    failures:
      unresolved > 0
        ? [{ component: "subject_attribution", message: `${unresolved} event(s) abstained or failed resolution.` }]
        : [],
  });
  if (changed.length || unresolved > 0) await calculateDimensionalDeltas(db);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
