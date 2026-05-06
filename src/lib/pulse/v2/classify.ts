/**
 * Phase 5.5 — multi-run cluster classifier.
 *
 * For each unclassified cluster (a `cluster_id` in raw_events that
 * doesn't yet have a `pulse_events_v2` row), build a representative
 * title+body, run it through Claude THREE times with different
 * temperatures, compare agreement, and write the consensus result
 * to `pulse_events_v2`. Spec §5.2 — multi-model agreement is the
 * primary confidence signal because LLM self-reported confidence
 * isn't calibrated.
 *
 * Agreement rules (spec §5.2):
 *   - All 3 agree on category + tier  → confidence boost +0.2
 *   - 2 of 3 agree                    → neutral
 *   - No agreement                    → confidence penalty -0.3,
 *                                        flag for human review
 *
 * Auto-publish gating per spec §5.1:
 *   - Severity tier in HUMAN_REVIEW_TIERS  → review required
 *   - classifierAgreement === "none"      → review required
 *   - low_pos / low_neg + agreement       → auto-publish
 *
 * Reviewer UI lands in Phase 5.7. For 5.5 the review queue is just
 * `pulse_events_v2` rows where `published = false`.
 */

import Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  pulseEventsV2,
  pulseSources,
  rawEvents,
  sources,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_INDEX,
  HUMAN_REVIEW_TIERS,
  SEVERITY_TIER_RANGES,
} from "./taxonomy";
import type {
  ClassifiedEvent,
  ClassifierAgreement,
  ClassifierRun,
  PulseDimension,
  SeverityTier,
} from "./types";

type Db = NeonHttpDatabase<typeof schema>;

const MODEL = "claude-sonnet-4-6";
const TEMPERATURES = [0.0, 0.4, 0.8] as const;

/** Lazy-init the Anthropic client per the project convention.
 *  Module-level `new Anthropic()` evaluates before dotenv. */
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_PULSE_CLASSIFIER });
  }
  return _anthropic;
}

// Single source of truth for the classifier prompt — shared with
// backtest.ts so both paths classify identically.
import { CLASSIFIER_SYSTEM_PROMPT } from "./classifier-prompt";

const SYSTEM_PROMPT = CLASSIFIER_SYSTEM_PROMPT;

interface ClassifierResultLite {
  category: string;
  severity_tier: SeverityTier;
  severity_value: number;
  self_confidence: number;
  rationale: string;
}

interface ClusterToClassify {
  clusterId: string;
  jurisdictionId: string;
  eventDate: string;
  title: string;
  body: string;
  /** raw_events row ids contributing to this cluster */
  rawEventIds: string[];
  /** distinct source ids contributing */
  sourceIds: string[];
  sourceTypes: string[];
  /** distinct (sourceId, sourceUrl, sourceName, rawEventId) tuples for pulse_sources */
  attributions: Array<{
    sourceId: string;
    sourceType: string;
    sourceName: string;
    sourceUrl: string | null;
    rawEventId: string;
  }>;
}

export interface ClassifySummary {
  clustersExamined: number;
  classified: number;
  publishedAuto: number;
  flaggedForReview: number;
  noneCategory: number;
  failed: number;
}

/**
 * Pull all clusters that don't yet have a pulse_events_v2 row, then
 * classify each one. Returns a summary.
 */
export async function classifyClusters(
  db: Db,
  opts: { limit?: number } = {}
): Promise<ClassifySummary> {
  const limit = opts.limit ?? 200;

  const clusters = await loadUnclassifiedClusters(db, limit);

  const summary: ClassifySummary = {
    clustersExamined: clusters.length,
    classified: 0,
    publishedAuto: 0,
    flaggedForReview: 0,
    noneCategory: 0,
    failed: 0,
  };

  for (const cluster of clusters) {
    try {
      const result = await classifyOne(cluster);
      if (!result) {
        summary.failed++;
        continue;
      }
      if ("category" in result && result.category === "none") {
        summary.noneCategory++;
        // Marked as examined would prevent future retries, but a
        // cluster_examined_at table is out of scope for 5.5. The
        // loadUnclassified query excludes clusters that already have
        // a pulse_events_v2 row, so re-runs will retry "none" clusters
        // — which is fine because LLM cost is small (3 calls).
        continue;
      }
      // Narrowed: result is ClassifyOneResult here
      const ok = result as ClassifyOneResult;
      await writeEvent(db, cluster, ok);
      summary.classified++;
      if (ok.autoPublished) summary.publishedAuto++;
      else summary.flaggedForReview++;
    } catch (err) {
      console.error(`[classify] cluster ${cluster.clusterId} failed:`, err);
      summary.failed++;
    }
  }

  return summary;
}

interface ClassifyOneResult {
  classified: ClassifiedEvent;
  autoPublished: boolean;
}

async function classifyOne(
  cluster: ClusterToClassify
): Promise<ClassifyOneResult | { category: "none" } | null> {
  const userContent = buildUserContent(cluster);

  // Three runs in parallel
  const runs: ClassifierRun[] = [];
  const noneVotes: number[] = [];

  const promises = TEMPERATURES.map(async (temp, idx) => {
    const result = await runOnce(userContent, temp);
    if (!result) return { idx, run: null as ClassifierRun | null, none: false };
    if (result.category === "none") {
      return { idx, run: null as ClassifierRun | null, none: true };
    }
    const cat = EVENT_CATEGORY_INDEX[result.category];
    if (!cat) {
      console.warn(
        `[classify] cluster ${cluster.clusterId} run ${idx + 1}: invalid category "${result.category}"`
      );
      return { idx, run: null as ClassifierRun | null, none: false };
    }
    if (!cat.allowedTiers.includes(result.severity_tier)) {
      console.warn(
        `[classify] cluster ${cluster.clusterId} run ${idx + 1}: tier ${result.severity_tier} not allowed for ${result.category}`
      );
      return { idx, run: null as ClassifierRun | null, none: false };
    }
    const range = SEVERITY_TIER_RANGES[result.severity_tier];
    const clamped = Math.max(range.min, Math.min(range.max, Math.round(result.severity_value)));
    const run: ClassifierRun = {
      run: (idx + 1) as 1 | 2 | 3,
      temp,
      model: MODEL,
      category: result.category,
      dimension: cat.dimension,
      severityTier: result.severity_tier,
      severityValue: clamped,
      selfConfidence: result.self_confidence,
      rationale: result.rationale,
      raw: JSON.stringify(result),
    };
    return { idx, run, none: false };
  });

  for (const r of await Promise.all(promises)) {
    if (r.none) noneVotes.push(r.idx);
    if (r.run) runs.push(r.run);
  }

  // Majority "none" → not a Pulse event
  if (noneVotes.length >= 2) {
    return { category: "none" };
  }

  if (runs.length === 0) {
    return null;
  }

  // Compute agreement on (category, severityTier) tuple
  const keys = runs.map((r) => `${r.category}::${r.severityTier}`);
  const allMatch = keys.every((k) => k === keys[0]) && runs.length === 3;
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());

  let agreement: ClassifierAgreement;
  if (runs.length === 3 && allMatch) agreement = "all";
  else if (maxCount >= 2) agreement = "two_of_three";
  else agreement = "none";

  // Pick the majority run (or run #1 on tie)
  const majorityKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const consensus = runs.find(
    (r) => `${r.category}::${r.severityTier}` === majorityKey
  )!;

  // Average severity_value across the runs that picked the majority key
  const matchingRuns = runs.filter(
    (r) => `${r.category}::${r.severityTier}` === majorityKey
  );
  const avgSeverity = Math.round(
    matchingRuns.reduce((sum, r) => sum + r.severityValue, 0) /
      matchingRuns.length
  );

  const classified: ClassifiedEvent = {
    jurisdictionId: cluster.jurisdictionId,
    eventDate: cluster.eventDate,
    category: consensus.category,
    dimension: consensus.dimension as PulseDimension,
    severityTier: consensus.severityTier,
    severityValue: avgSeverity,
    classifierRuns: runs,
    classifierAgreement: agreement,
    headline: cluster.title.slice(0, 200),
    description: cluster.body.slice(0, 1500),
  };

  // Auto-publish gate per spec §5.1
  const requiresReview =
    agreement === "none" ||
    HUMAN_REVIEW_TIERS.has(consensus.severityTier);

  return {
    classified,
    autoPublished: !requiresReview,
  };
}

async function runOnce(
  userContent: string,
  temperature: number
): Promise<ClassifierResultLite | null> {
  const client = getAnthropic();
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (err) {
    console.error(`[classify] LLM call failed at temp=${temperature}:`, err);
    return null;
  }

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  // Strip leading/trailing fences if present
  const cleaned = text.trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");

  try {
    const parsed = JSON.parse(cleaned) as Partial<ClassifierResultLite>;
    if (!parsed.category) return null;
    if (parsed.category === "none") {
      return {
        category: "none",
        severity_tier: "low_neg",
        severity_value: 0,
        self_confidence: 0,
        rationale: parsed.rationale ?? "",
      };
    }
    return {
      category: parsed.category,
      severity_tier: parsed.severity_tier as SeverityTier,
      severity_value: Number(parsed.severity_value ?? 0),
      self_confidence: Number(parsed.self_confidence ?? 0),
      rationale: String(parsed.rationale ?? ""),
    };
  } catch (err) {
    console.warn(
      `[classify] JSON parse failed at temp=${temperature}: ${cleaned.slice(0, 100)}`
    );
    return null;
  }
}

function buildUserContent(cluster: ClusterToClassify): string {
  const sourcesLine = cluster.sourceIds.join(", ");
  return `Country jurisdiction id: ${cluster.jurisdictionId}
Event date: ${cluster.eventDate}
Sources: ${sourcesLine}

Headline: ${cluster.title}

Body / context:
${cluster.body}`;
}

async function loadUnclassifiedClusters(
  db: Db,
  limit: number
): Promise<ClusterToClassify[]> {
  // Find cluster ids in raw_events that don't yet have a pulse_events_v2
  // row and have a resolved jurisdiction.
  const result = await db.execute(sql`
    SELECT
      r.cluster_id,
      r.jurisdiction_id,
      MIN(COALESCE(r.event_date, CURRENT_DATE)) AS event_date,
      ARRAY_AGG(r.id) AS raw_event_ids,
      ARRAY_AGG(r.source_id) AS source_ids,
      ARRAY_AGG(r.source_type) AS source_types,
      ARRAY_AGG(r.source_url) AS source_urls,
      (ARRAY_AGG(r.title))[1] AS first_title,
      (ARRAY_AGG(COALESCE(r.body, ''))) AS bodies,
      (ARRAY_AGG(r.title)) AS titles
    FROM raw_events r
    WHERE r.cluster_id IS NOT NULL
      AND r.jurisdiction_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pulse_sources ps
        WHERE ps.raw_event_id = r.id
      )
    GROUP BY r.cluster_id, r.jurisdiction_id
    LIMIT ${limit}
  `);

  const rows = (result as unknown as {
    rows?: Array<{
      cluster_id: string;
      jurisdiction_id: string;
      event_date: string;
      raw_event_ids: string[];
      source_ids: string[];
      source_types: string[];
      source_urls: (string | null)[];
      first_title: string;
      bodies: string[];
      titles: string[];
    }>;
  }).rows ?? (result as unknown as Array<{
    cluster_id: string;
    jurisdiction_id: string;
    event_date: string;
    raw_event_ids: string[];
    source_ids: string[];
    source_types: string[];
    source_urls: (string | null)[];
    first_title: string;
    bodies: string[];
    titles: string[];
  }>);

  return rows.map((row) => {
    // Build a representative body by concatenating distinct titles +
    // bodies, capped at 1500 chars.
    const allText = row.titles
      .map((t, i) => `- ${t}${row.bodies[i] ? ` (${row.bodies[i]})` : ""}`)
      .join("\n")
      .slice(0, 1500);

    const distinctSources = Array.from(new Set(row.source_ids));
    const distinctTypes = Array.from(new Set(row.source_types));

    const attributions = row.raw_event_ids.map((rawId, i) => ({
      sourceId: row.source_ids[i],
      sourceType: row.source_types[i],
      sourceName: row.source_ids[i],
      sourceUrl: row.source_urls[i],
      rawEventId: rawId,
    }));

    return {
      clusterId: row.cluster_id,
      jurisdictionId: row.jurisdiction_id,
      eventDate: row.event_date,
      title: row.first_title,
      body: allText,
      rawEventIds: row.raw_event_ids,
      sourceIds: distinctSources,
      sourceTypes: distinctTypes,
      attributions,
    };
  });
}

async function writeEvent(
  db: Db,
  cluster: ClusterToClassify,
  result: ClassifyOneResult
): Promise<void> {
  // Initial corroborationConfidence — provisional. Phase 5.7's
  // corroborate.ts can recompute. For now use a baseline based on
  // agreement and the LLM's averaged self-confidence.
  const provisionalConfidence =
    result.classified.classifierAgreement === "all"
      ? 0.85
      : result.classified.classifierAgreement === "two_of_three"
        ? 0.65
        : 0.4;

  const eventRows = await db
    .insert(pulseEventsV2)
    .values({
      jurisdictionId: result.classified.jurisdictionId,
      eventDate: result.classified.eventDate,
      category: result.classified.category,
      dimension: result.classified.dimension,
      severityTier: result.classified.severityTier,
      severityValue: result.classified.severityValue,
      corroborationConfidence: provisionalConfidence,
      classifierRuns: result.classified.classifierRuns,
      classifierAgreement: result.classified.classifierAgreement,
      reviewStatus: result.autoPublished ? "approved" : "pending",
      published: result.autoPublished,
      headline: result.classified.headline,
      description: result.classified.description,
    })
    .returning({ id: pulseEventsV2.id });

  const eventId = eventRows[0]?.id;
  if (!eventId) return;

  // Insert pulse_sources rows for every contributing raw_event
  for (const attr of cluster.attributions) {
    await db.insert(pulseSources).values({
      eventId,
      sourceId: attr.sourceId,
      sourceType: attr.sourceType,
      sourceName: attr.sourceName,
      sourceUrl: attr.sourceUrl,
      rawEventId: attr.rawEventId,
    });
  }

  // Stamp the sources we touched (already done at ingest, but stamp
  // again for the classifier pass — useful for debugging "when was
  // this event first classified?").
  const distinctSources = Array.from(new Set(cluster.attributions.map((a) => a.sourceId)));
  for (const sourceId of distinctSources) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, sourceId));
  }
}

// Suppress unused imports the build doesn't strip:
void rawEvents;
void and;
void isNull;
