/**
 * Phase 5.5 — corroboration confidence for pulse_events_v2 rows.
 *
 * Implements spec §3.4 (asymmetric scoring — positive events require
 * stronger corroboration) + §3.5 (press-freedom-informed rules).
 *
 * For each pulse_events_v2 row, this pass:
 *   1. Counts distinct specialist + news source attributions in
 *      pulse_sources.
 *   2. Computes a source-diversity score (specialist sources weighted
 *      higher than news).
 *   3. Combines with classifier_agreement to produce a baseline
 *      corroboration_confidence in [0, 1].
 *   4. Applies the asymmetric rule for positive-direction events using
 *      distinct recorded source IDs. State ownership and source-family
 *      relationships are not represented by the current data model.
 *   5. Applies the press-freedom rule using the country's iso3 ↔
 *      RSF score lookup.
 *   6. Stores the latest provisional press-freedom context applied by this
 *      recomputation. Scheduled runs may overwrite the prior value.
 *
 * Updates only — no inserts. Run after classify.ts.
 */

import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  jurisdictions,
  pulseEventsV2,
  pulseSources,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { isPositiveTier } from "./taxonomy";
import {
  pressFreedomScore,
  pressFreedomTier,
} from "./press-freedom";
import type { ClassifierAgreement, SeverityTier } from "./types";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

export interface CorroborateSummary {
  runId: string;
  versionKey: string;
  examined: number;
  updated: number;
  averageConfidence: number;
  dryRun: boolean;
  planned: CorroborationPlan[];
}

export interface EventRow {
  id: string;
  jurisdictionId: string;
  iso3: string | null;
  severityTier: SeverityTier;
  classifierAgreement: ClassifierAgreement;
  category: string;
  pressPinned: number | null;
  classificationRunId: string;
}

export interface SourceCounts {
  specialist: Set<string>;
  news: Set<string>;
}

export interface CorroborationPlan {
  eventId: string;
  confidence: number;
  pressFreedomScore: number | null;
  corroborationRunId: string;
}

export interface CorroborateOptions {
  onlyUnpinned?: boolean;
  dryRun?: boolean;
  events?: EventRow[];
  sourceCounts?: ReadonlyMap<string, SourceCounts>;
  write?: (db: Db, plan: CorroborationPlan) => Promise<void>;
  now?: Date;
  runRef?: PulsePipelineRunRef;
}

export async function corroborateEvents(
  db: Db,
  opts: CorroborateOptions = {}
): Promise<CorroborateSummary> {
  const events = opts.events ?? await loadEvents(db, opts);
  validateEvents(events);
  const resolvedCounts = new Map<string, SourceCounts>();
  for (const event of events) {
    const fixtureCounts = opts.sourceCounts?.get(event.id);
    if (opts.sourceCounts && !fixtureCounts) throw new Error(`missing source-count fixture for event: ${event.id}`);
    resolvedCounts.set(
      event.id,
      fixtureCounts ?? (await loadSourceCounts(db, event.id)),
    );
  }
  const run =
    opts.runRef ??
    createPulsePipelineRunRef("corroborate", {
      sourceIds: events.length
        ? [...resolvedCounts.values()].flatMap((counts) => [
            ...counts.specialist,
            ...counts.news,
          ])
        : undefined,
      upstreamRunIds: events.map(({ classificationRunId }) => classificationRunId),
    });
  const persistRun = !opts.dryRun && !opts.events && !opts.runRef;
  if (persistRun) await startPulsePipelineRun(db, run);

  let updated = 0;
  let totalConfidence = 0;
  const planned: CorroborationPlan[] = [];

  for (const event of events) {
    const counts = resolvedCounts.get(event.id)!;
    const press = pressFreedomScore(event.iso3);
    const tier = pressFreedomTier(press);

    let confidence = baselineConfidence(
      counts,
      event.classifierAgreement
    );

    // Asymmetric scoring (spec §3.4)
    if (isPositiveTier(event.severityTier)) {
      // Positive events without specialist corroboration get penalised
      if (counts.specialist.size === 0) confidence *= 0.6;
      // In low-press-freedom environments, require ≥2 recorded source IDs.
      // This is not a state-origin or source-independence test.
      if (tier === "restricted") {
        const distinctRecordedSources = counts.specialist.size + counts.news.size;
        if (distinctRecordedSources < 2) confidence *= 0.5;
      }
    }

    // Press-freedom rule (spec §3.5)
    if (tier === "partial") confidence *= 0.8;
    if (tier === "restricted" && counts.specialist.size === 0) {
      // News-only in restricted press → don't drive scoring at all
      confidence *= 0.3;
    }

    confidence = Math.max(0, Math.min(1, confidence));
    totalConfidence += confidence;
    const plan = {
      eventId: event.id,
      confidence,
      pressFreedomScore: press,
      corroborationRunId: run.id,
    };
    planned.push(plan);
    if (!opts.dryRun) {
      if (opts.write) await opts.write(db, plan);
      else await writeCorroboration(db, plan, opts.now ?? new Date());
      updated++;
    }
  }

  if (persistRun) {
    await finishPulsePipelineRun(db, run.id, {
      status: "completed",
      counts: { examined: events.length, updated },
    });
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    examined: events.length,
    updated,
    averageConfidence: events.length ? totalConfidence / events.length : 0,
    dryRun: opts.dryRun ?? false,
    planned: planned.sort((a, b) => a.eventId.localeCompare(b.eventId)),
  };
}

function validateEvents(events: EventRow[]): void {
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.id.trim() || !event.jurisdictionId.trim()) throw new Error("corroboration fixture has a blank event or jurisdiction id");
    if (!event.classificationRunId.trim()) throw new Error(`corroboration fixture has no classification run: ${event.id}`);
    if (ids.has(event.id)) throw new Error(`duplicate corroboration event id: ${event.id}`);
    ids.add(event.id);
  }
}

async function writeCorroboration(db: Db, plan: CorroborationPlan, now: Date): Promise<void> {
  await db
    .update(pulseEventsV2)
    .set({
      corroborationConfidence: plan.confidence,
      pressFreedomScoreAtClassification: plan.pressFreedomScore,
      updatedAt: now,
      corroborationRunId: plan.corroborationRunId,
    })
    .where(eq(pulseEventsV2.id, plan.eventId));
}

function baselineConfidence(
  counts: SourceCounts,
  agreement: ClassifierAgreement
): number {
  // Source-diversity score: specialist=1.0, news=0.6, with cap.
  const specWeight = Math.min(counts.specialist.size, 3) * 0.25;
  const newsWeight = Math.min(counts.news.size, 4) * 0.10;
  const diversity = Math.min(1, specWeight + newsWeight);

  const agreementBoost =
    agreement === "all" ? 0.2 : agreement === "two_of_three" ? 0.0 : -0.3;

  // Floor at 0.2 so a single specialist source still contributes
  // something to scoring.
  const base = 0.4 + diversity * 0.4 + agreementBoost;
  return Math.max(0, Math.min(1, base));
}

async function loadEvents(
  db: Db,
  opts: { onlyUnpinned?: boolean }
): Promise<EventRow[]> {
  const where = opts.onlyUnpinned
    ? sql`p.press_freedom_score_at_classification IS NULL`
    : sql`TRUE`;

  const result = await db.execute(sql`
    SELECT
      p.id,
      p.jurisdiction_id,
      j.iso3,
      p.severity_tier,
      p.classifier_agreement,
      p.category,
      p.press_freedom_score_at_classification AS press_pinned
      ,p.classification_run_id
    FROM pulse_events_v2 p
    JOIN jurisdictions j ON j.id = p.jurisdiction_id
    WHERE ${where}
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    jurisdictionId: String(r.jurisdiction_id),
    iso3: r.iso3 ? String(r.iso3) : null,
    severityTier: r.severity_tier as SeverityTier,
    classifierAgreement: r.classifier_agreement as ClassifierAgreement,
    category: String(r.category),
    pressPinned: r.press_pinned !== null ? Number(r.press_pinned) : null,
    classificationRunId: String(r.classification_run_id),
  }));
}

async function loadSourceCounts(
  db: Db,
  eventId: string
): Promise<SourceCounts> {
  const rows = await db
    .select({
      sourceId: pulseSources.sourceId,
      sourceType: pulseSources.sourceType,
    })
    .from(pulseSources)
    .where(eq(pulseSources.eventId, eventId));

  const out: SourceCounts = { specialist: new Set(), news: new Set() };
  for (const row of rows) {
    if (row.sourceType === "specialist") out.specialist.add(row.sourceId);
    else if (row.sourceType === "news") out.news.add(row.sourceId);
  }
  return out;
}

// Suppress unused (kept for potential future direct lookups)
void jurisdictions;
