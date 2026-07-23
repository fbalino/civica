/**
 * PUL-037 — explicit, append-only CI/Pulse absorption evidence.
 *
 * This compatibility entry point no longer mutates corroboration confidence.
 * It assesses only caller-supplied event links against two closed,
 * sequential, fixed-scale Index releases and stores the decision separately.
 */

import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  ciDimensionScores,
  pulseEventAbsorptions,
  pulseEventsV2,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { CURRENT_CI_RELEASE_ID } from "@/lib/ci/current-release";
import {
  CI_RELEASE_CONTRACTS,
  resolveCiRelease,
  type CiReleaseContract,
} from "@/lib/ci/release-selection";
import {
  assessEventAbsorption,
  comparableFixedScaleReleaseReasons,
  type AbsorptionAssessment,
  type ExplicitAbsorptionLink,
} from "./absorption";
import type { PulseDimension } from "./types";

type Db = NeonHttpDatabase<typeof schema>;
const ABSORBABLE_DIMENSIONS = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
] as const;

export interface DecoupleSummary {
  noComparableRelease: boolean;
  explicitLinksExamined: number;
  decisionsPlanned: number;
  decisionsWritten: number;
  eventsAbsorbed: number;
  eventsZeroed: 0;
  byDimension: Record<string, number>;
  planned: AbsorptionAssessment[];
  dryRun: boolean;
}

export interface DecoupleOptions {
  links?: ExplicitAbsorptionLink[];
  dryRun?: boolean;
  now?: Date;
  write?: (db: Db, plan: AbsorptionAssessment, decidedAt: Date) => Promise<void>;
}

function priorComparableRelease(
  current: CiReleaseContract,
  dimension: string,
): CiReleaseContract | null {
  return [...CI_RELEASE_CONTRACTS]
    .filter(
      (candidate) =>
        candidate.series.observationPeriodEnd < current.series.observationPeriodEnd &&
        comparableFixedScaleReleaseReasons(candidate, current, dimension).length === 0,
    )
    .sort((a, b) =>
      b.series.observationPeriodEnd.localeCompare(a.series.observationPeriodEnd),
    )[0] ?? null;
}

async function loadReleaseScore(
  db: Db,
  release: CiReleaseContract,
  jurisdictionId: string,
  dimension: string,
): Promise<number> {
  const rules = release.dimensions
    .filter((rule) => rule.dimension === dimension)
    .sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    const rows = await db
      .select({ score: ciDimensionScores.normalizedScore })
      .from(ciDimensionScores)
      .where(
        and(
          eq(ciDimensionScores.jurisdictionId, jurisdictionId),
          eq(ciDimensionScores.dimension, dimension),
          eq(ciDimensionScores.quarter, release.quarter),
          eq(ciDimensionScores.methodologyVersion, release.methodologyVersion),
          eq(ciDimensionScores.sourceId, rule.sourceId),
          eq(ciDimensionScores.indicatorId, rule.indicatorId),
          eq(ciDimensionScores.artifactHash, rule.artifactSha256),
        ),
      );
    if (rows.length > 1)
      throw new Error(
        `${release.releaseId}/${jurisdictionId}/${dimension} has duplicate closed-release rows`,
      );
    if (rows[0]) return Number(rows[0].score);
  }
  throw new Error(
    `${release.releaseId}/${jurisdictionId}/${dimension} has no closed-release observation`,
  );
}

async function loadLinkedEvent(
  db: Db,
  link: ExplicitAbsorptionLink,
) {
  const rows = await db
    .select({
      id: pulseEventsV2.id,
      jurisdictionId: pulseEventsV2.jurisdictionId,
      dimension: pulseEventsV2.dimension,
      eventDate: pulseEventsV2.eventDate,
      severityValue: pulseEventsV2.severityValue,
    })
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.id, link.eventId));
  if (rows.length !== 1)
    throw new Error(`explicit absorption link has no unique event: ${link.eventId}`);
  return {
    ...rows[0],
    dimension: rows[0].dimension as PulseDimension,
    eventDate: String(rows[0].eventDate),
  };
}

async function writeAbsorption(
  db: Db,
  plan: AbsorptionAssessment,
  decidedAt: Date,
): Promise<void> {
  await db
    .insert(pulseEventAbsorptions)
    .values({
      schemaVersion: plan.schemaVersion,
      absorptionKey: plan.absorptionKey,
      eventId: plan.eventId,
      jurisdictionId: plan.jurisdictionId,
      dimension: plan.dimension,
      outcome: plan.outcome,
      previousCiReleaseId: plan.previousCiReleaseId,
      currentCiReleaseId: plan.currentCiReleaseId,
      previousScore: plan.previousScore,
      currentScore: plan.currentScore,
      scoreDelta: plan.scoreDelta,
      threshold: plan.threshold,
      fixedScaleId: plan.fixedScaleId,
      linkStanding: plan.linkStanding,
      linkActorType: plan.linkActorType,
      linkMethodVersion: plan.linkMethodVersion,
      methodVersion: plan.methodVersion,
      asOf: plan.asOf,
      rationale: plan.rationale,
      evidenceRefs: plan.evidenceRefs,
      reasons: plan.reasons,
      supersedesAbsorptionKey: plan.supersedesAbsorptionKey,
      decidedAt,
    })
    .onConflictDoNothing({ target: pulseEventAbsorptions.absorptionKey });
}

/**
 * Assess explicit links for a closed Index release. With no supplied links,
 * the operation is an intentional no-op. Aggregate country/dimension movement
 * can never select events by itself.
 */
export async function decoupleAbsorbedEvents(
  db: Db,
  currentReleaseId: string = CURRENT_CI_RELEASE_ID,
  opts: DecoupleOptions = {},
): Promise<DecoupleSummary> {
  const currentRelease = resolveCiRelease(currentReleaseId);
  const links = opts.links ?? [];
  const now = opts.now ?? new Date();
  const byDimension: Record<string, number> = {};
  const planned: AbsorptionAssessment[] = [];
  const hasComparable = ABSORBABLE_DIMENSIONS.some((dimension) =>
    priorComparableRelease(currentRelease, dimension),
  );

  for (const link of links) {
    if (link.currentReleaseId !== currentRelease.releaseId)
      throw new Error(
        `link ${link.eventId} names ${link.currentReleaseId}, expected ${currentRelease.releaseId}`,
      );
    const previousRelease = priorComparableRelease(currentRelease, link.dimension);
    if (!previousRelease) continue;
    const event = await loadLinkedEvent(db, link);
    const [previousScore, currentScore] = await Promise.all([
      loadReleaseScore(db, previousRelease, event.jurisdictionId, event.dimension),
      loadReleaseScore(db, currentRelease, event.jurisdictionId, event.dimension),
    ]);
    const plan = assessEventAbsorption({
      event,
      previousRelease,
      currentRelease,
      previousScore,
      currentScore,
      link,
      asOf: currentRelease.series.calculatedAt.slice(0, 10),
    });
    planned.push(plan);
    byDimension[plan.dimension] = (byDimension[plan.dimension] ?? 0) + 1;
  }

  let decisionsWritten = 0;
  if (!opts.dryRun) {
    for (const plan of planned) {
      if (opts.write) await opts.write(db, plan, now);
      else await writeAbsorption(db, plan, now);
      decisionsWritten++;
    }
  }

  return {
    noComparableRelease: !hasComparable,
    explicitLinksExamined: links.length,
    decisionsPlanned: planned.length,
    decisionsWritten,
    eventsAbsorbed: planned.filter((plan) => plan.outcome === "absorbed").length,
    eventsZeroed: 0,
    byDimension,
    planned: planned.sort((a, b) => a.absorptionKey.localeCompare(b.absorptionKey)),
    dryRun: opts.dryRun ?? false,
  };
}
