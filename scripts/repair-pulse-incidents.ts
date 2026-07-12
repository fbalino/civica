/**
 * PUL-031 bounded duplicate-incident repair.
 *
 * Default is zero-write planning. Applying requires the exact plan key printed
 * by a preceding dry run:
 *   npm run repair:pulse-incidents -- --apply --expected-plan-key=<key>
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { writeFileSync } from "node:fs";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import {
  PULSE_INCIDENT_RESOLUTION_VERSION,
  planIncidentResolution,
} from "../src/lib/pulse/v2/incident-resolution";
import { buildIncidentMergeGroups } from "../src/lib/pulse/v2/incident-repair";
import {
  buildIncidentResolutionKey,
  loadActiveIncidentCandidates,
  type IncidentResolutionRecordPlan,
} from "../src/lib/pulse/v2/incident-store";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
} from "../src/lib/pulse/v2/pipeline-version";
import { corroborateEvents } from "../src/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "../src/lib/pulse/v2/score";

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function state(sqlClient: NeonQueryFunction<false, false>) {
  const result = await sqlClient`
    SELECT
      (SELECT count(*)::int FROM pulse_incidents WHERE status = 'active') AS active_incidents,
      (SELECT count(*)::int FROM pulse_incidents WHERE status = 'merged') AS merged_incidents,
      (SELECT count(*)::int FROM pulse_events_v2 WHERE projection_status = 'current') AS current_projections,
      (SELECT count(*)::int FROM pulse_events_v2 WHERE projection_status = 'superseded_duplicate') AS superseded_projections,
      (SELECT count(*)::int FROM pulse_events_v2 WHERE published AND btrim(headline) = '') AS published_blank_headlines,
      (SELECT count(*)::int FROM raw_events WHERE cluster_id IS NOT NULL AND incident_id IS NULL) AS clustered_without_incident
  `;
  return result[0];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const apply = process.argv.includes("--apply");
  const expectedPlanKey = arg("expected-plan-key");
  if (apply && !expectedPlanKey) {
    throw new Error("--apply requires --expected-plan-key from a preceding zero-write plan");
  }

  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle({ client: sqlClient, schema });
  const boundsResult = await sqlClient`
    SELECT
      min(coalesce(p.event_date, i.event_date_start, i.event_date_end))::text AS first_date,
      max(coalesce(p.event_date, i.event_date_end, i.event_date_start))::text AS last_date
    FROM pulse_incidents i
    LEFT JOIN pulse_events_v2 p
      ON p.incident_id = i.id AND p.projection_status = 'current'
    WHERE i.status = 'active'
  `;
  const firstDate = String(boundsResult[0]?.first_date ?? new Date().toISOString().slice(0, 10));
  const lastDate = String(boundsResult[0]?.last_date ?? firstDate);
  const candidates = await loadActiveIncidentCandidates(db, {
    windowStart: firstDate,
    windowEnd: lastDate,
    comparisonWindowHours: 0,
  });
  const plan = planIncidentResolution(candidates, { mode: "backfill" });
  const groups = buildIncidentMergeGroups(candidates, plan.findings);
  const collisionCandidates = plan.findings.filter(
    ({ disposition }) => disposition === "candidate_merge",
  );
  const before = await state(sqlClient);
  const baseReport = {
    schemaVersion: "pulse-incident-repair-report/v1",
    mode: apply ? "apply" : "dry_run",
    writesPerformed: apply ? undefined : 0,
    resolutionVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
    planKey: plan.planKey,
    candidateCount: candidates.length,
    comparisonCount: plan.findings.filter(({ candidateIds }) => candidateIds.length === 2).length,
    confirmedGroupCount: groups.length,
    confirmedDuplicateCount: groups.reduce(
      (total, group) => total + group.duplicateIncidentIds.length,
      0,
    ),
    collisionCandidateCount: collisionCandidates.length,
    invalidCandidateCount: plan.findings.filter(({ disposition }) => disposition === "invalid").length,
    groups,
    collisionCandidates,
    before,
  };

  if (!apply) {
    const report = { ...baseReport, writesPerformed: 0 };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    const output = arg("out");
    if (output) writeFileSync(output, serialized);
    process.stdout.write(serialized);
    return;
  }
  if (expectedPlanKey !== plan.planKey) {
    throw new Error(`incident repair plan changed: expected ${expectedPlanKey}, observed ${plan.planKey}`);
  }

  const run = createPulsePipelineRunRef("cluster");
  await startPulsePipelineRun(db, run);
  try {
    const decidedAt = new Date().toISOString();
    const transactionStatementCount =
      collisionCandidates.length +
      groups.reduce(
        (total, group) => total + group.duplicateIncidentIds.length * 4,
        0,
      );
    if (transactionStatementCount) {
      await sqlClient.transaction((transaction) => {
        const queries = [];
        for (const finding of collisionCandidates) {
          const [leftIncidentId, rightIncidentId] = finding.candidateIds;
          const payload = {
            leftIncidentId,
            rightIncidentId,
            outcome: "candidate" as const,
            canonicalIncidentId: null,
            signals: {
              planKey: plan.planKey,
              findingKey: finding.findingKey,
              reasonCode: finding.reasonCode,
              hoursApart: finding.hoursApart,
              exactNormalizedMatch: finding.exactNormalizedMatch,
              exactNormalizedHeadlineMatch:
                finding.exactNormalizedHeadlineMatch,
              tokenSimilarity: finding.tokenSimilarity,
              anchorOverlap: finding.anchorOverlap,
              semanticSimilarity: finding.semanticSimilarity,
              classificationCompatible: finding.classificationCompatible,
            },
            methodVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
            stageRunId: run.id,
            actor: { type: "controlled_backfill", task: "PUL-031" },
            rationale:
              "Identity evidence suggests a collision, but the automatic-merge rule was not met.",
            evidenceRefs: finding.candidateIds.map(
              (id) => `incident:${id}`,
            ),
            decidedAt,
          };
          const resolution: IncidentResolutionRecordPlan = {
            schemaVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
            resolutionKey: buildIncidentResolutionKey(payload),
            ...payload,
          };
          queries.push(transaction.query(
            `INSERT INTO pulse_incident_resolutions
               (schema_version, resolution_key, left_incident_id, right_incident_id,
                outcome, canonical_incident_id, signals, method_version,
                stage_run_id, actor, rationale, evidence_refs, decided_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12::text[],$13::timestamp)
             ON CONFLICT (resolution_key) DO NOTHING`,
            [
              resolution.schemaVersion,
              resolution.resolutionKey,
              resolution.leftIncidentId,
              resolution.rightIncidentId,
              resolution.outcome,
              resolution.canonicalIncidentId,
              JSON.stringify(resolution.signals),
              resolution.methodVersion,
              resolution.stageRunId,
              JSON.stringify(resolution.actor),
              resolution.rationale,
              resolution.evidenceRefs,
              resolution.decidedAt,
            ],
          ));
        }
        for (const group of groups) {
          for (const duplicateIncidentId of group.duplicateIncidentIds) {
            const payload = {
          leftIncidentId: [group.canonicalIncidentId, duplicateIncidentId].sort()[0],
          rightIncidentId: [group.canonicalIncidentId, duplicateIncidentId].sort()[1],
          outcome: "confirmed_merge" as const,
          canonicalIncidentId: group.canonicalIncidentId,
          signals: {
            planKey: plan.planKey,
            findingKeys: group.findingKeys,
            rule: "exact_full_identity_or_exact_headline_same_country_date_with_compatible_labels",
          },
          methodVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
          stageRunId: run.id,
          actor: { type: "controlled_backfill", task: "PUL-031" },
          rationale: "Exact normalized incident identity was confirmed by the prereviewed PUL-031 repair plan.",
          evidenceRefs: group.findingKeys.map((key) => `incident-finding:${key}`),
          decidedAt,
        };
            const resolution: IncidentResolutionRecordPlan = {
              schemaVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
              resolutionKey: buildIncidentResolutionKey(payload),
              ...payload,
            };
            queries.push(transaction.query(
          `INSERT INTO pulse_incident_resolutions
             (schema_version, resolution_key, left_incident_id, right_incident_id,
              outcome, canonical_incident_id, signals, method_version,
              stage_run_id, actor, rationale, evidence_refs, decided_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12::text[],$13::timestamp)
           ON CONFLICT (resolution_key) DO NOTHING`,
          [
            resolution.schemaVersion,
            resolution.resolutionKey,
            resolution.leftIncidentId,
            resolution.rightIncidentId,
            resolution.outcome,
            resolution.canonicalIncidentId,
            JSON.stringify(resolution.signals),
            resolution.methodVersion,
            resolution.stageRunId,
            JSON.stringify(resolution.actor),
            resolution.rationale,
            resolution.evidenceRefs,
            resolution.decidedAt,
          ],
            ));
            queries.push(transaction.query(
          `UPDATE pulse_events_v2
           SET incident_id = $1,
               projection_status = CASE WHEN projection_status = 'current'
                 THEN 'superseded_duplicate' ELSE projection_status END,
               published = false,
               publication_run_id = NULL,
               updated_at = now()
           WHERE incident_id = $2`,
          [group.canonicalIncidentId, duplicateIncidentId],
            ));
            queries.push(transaction.query(
          "UPDATE raw_events SET incident_id = $1 WHERE incident_id = $2",
          [group.canonicalIncidentId, duplicateIncidentId],
            ));
            queries.push(transaction.query(
          `UPDATE pulse_incidents
           SET status = 'merged', merged_into_incident_id = $1, updated_at = now()
           WHERE id = $2 AND status = 'active'`,
          [group.canonicalIncidentId, duplicateIncidentId],
            ));
          }
        }
        return queries;
      });
    }

    const corroboration = groups.length ? await corroborateEvents(db) : null;
    const scoring = groups.length ? await calculateDimensionalDeltas(db) : null;
    const after = await state(sqlClient);
    await finishPulsePipelineRun(db, run.id, {
      status: "completed",
      counts: {
        candidates: candidates.length,
        confirmedGroups: groups.length,
        mergedIncidents: groups.reduce(
          (total, group) => total + group.duplicateIncidentIds.length,
          0,
        ),
        collisionCandidates: collisionCandidates.length,
      },
    });
    const report = {
      ...baseReport,
      writesPerformed: transactionStatementCount,
      repairRunId: run.id,
      corroborationRunId: corroboration?.runId ?? null,
      scoringRunId: scoring?.runId ?? null,
      after,
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    const output = arg("out");
    if (output) writeFileSync(output, serialized);
    process.stdout.write(serialized);
  } catch (error) {
    await finishPulsePipelineRun(db, run.id, {
      status: "failed",
      counts: { candidates: candidates.length, confirmedGroups: groups.length },
      failures: [
        {
          component: "incident_repair",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
