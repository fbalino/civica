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

type Db = NeonHttpDatabase<typeof schema>;

export interface CorroborateSummary {
  examined: number;
  updated: number;
  averageConfidence: number;
}

interface EventRow {
  id: string;
  jurisdictionId: string;
  iso3: string | null;
  severityTier: SeverityTier;
  classifierAgreement: ClassifierAgreement;
  category: string;
  pressPinned: number | null;
}

interface SourceCounts {
  specialist: Set<string>;
  news: Set<string>;
}

export async function corroborateEvents(
  db: Db,
  opts: { onlyUnpinned?: boolean } = {}
): Promise<CorroborateSummary> {
  const events = await loadEvents(db, opts);

  let updated = 0;
  let totalConfidence = 0;

  for (const event of events) {
    const counts = await loadSourceCounts(db, event.id);
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

    await db
      .update(pulseEventsV2)
      .set({
        corroborationConfidence: confidence,
        pressFreedomScoreAtClassification: press,
        updatedAt: new Date(),
      })
      .where(eq(pulseEventsV2.id, event.id));
    updated++;
  }

  return {
    examined: events.length,
    updated,
    averageConfidence: events.length ? totalConfidence / events.length : 0,
  };
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
