/**
 * Cluster classifier — classify, then verify.
 *
 * For each unclassified cluster (a `cluster_id` in raw_events that
 * doesn't yet have a `pulse_events_v2` row), build a representative
 * title+body, then run the two independent reasoning passes published
 * in `content/methodology-pulse.md` (§ "Classification confidence —
 * classify, then verify"):
 *
 *   1. CLASSIFY — one pass assigns category, severity, subject country,
 *      and the runner-up category it considered.
 *   2. VERIFY (refute) — a second, independent pass re-reads the source
 *      and actively tries to refute the first (right category vs.
 *      runner-up? severity justified? subject country correct? is it a
 *      discrete governance event at all?), yielding a high/medium/low
 *      confidence.
 *
 * The methodology explicitly rejects sampling the same prompt repeatedly
 * (the retired 3-temperature scheme): re-running one prompt only measures
 * decoding randomness, not correctness. Confidence comes from the
 * classify→verify passes plus real-world corroboration (corroborate.ts).
 *
 * Auto-publish gating:
 *   - Severity tier in HUMAN_REVIEW_TIERS  → review required
 *   - verify confidence === "low"          → review required
 *   - otherwise                            → auto-publish
 *
 * The persisted `classifier_agreement` column is retained for schema and
 * downstream compatibility (corroborate.ts, the review UI, the changelog):
 * the verify confidence maps onto it as high→"all", medium→"two_of_three",
 * low→"none", which lines up with the confidence boost/penalty those
 * readers already apply. The `classifier_runs` jsonb preserves both passes
 * for audit.
 *
 * The review queue is `pulse_events_v2` rows where `published = false`.
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

/** Lazy-init the Anthropic client per the project convention.
 *  Module-level `new Anthropic()` evaluates before dotenv. */
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_PULSE_CLASSIFIER });
  }
  return _anthropic;
}

// Single source of truth for the classifier prompts — shared with
// backtest.ts so both paths classify + verify identically.
import {
  CLASSIFIER_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  type ClassifyResultLite,
  type VerifyResultLite,
  agreementFromConfidence,
  parseClassify,
  parseVerify,
} from "./classifier-prompt";
import { resolveSubjectJurisdiction } from "./country-attribution";

const SYSTEM_PROMPT = CLASSIFIER_SYSTEM_PROMPT;

export interface ClusterToClassify {
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
        // A cluster_examined_at table would let us mark "none" clusters as
        // examined so they aren't re-tried, but it's out of scope here. The
        // loadUnclassified query excludes clusters that already have a
        // pulse_events_v2 row, so re-runs retry "none" clusters — fine
        // because a dropped cluster costs only the single classify call
        // (the verify + subject-attribution calls never fire for "none").
        continue;
      }
      // Narrowed: result is ClassifyOneResult here
      const ok = result as ClassifyOneResult;
      // Correct the country attribution to the event's SUBJECT country.
      // The cluster's jurisdiction came from the cheap mention/source-
      // language resolver, which mis-files e.g. a Chinese-language story
      // about US redistricting under Taiwan. Re-attribute by subject so
      // the scored/displayed event lands on the right country.
      const subject = await resolveSubjectJurisdiction(
        db,
        ok.classified.headline,
        ok.classified.description
      );
      if (subject) ok.classified.jurisdictionId = subject.jurisdictionId;
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

export interface ClassifyOneResult {
  classified: ClassifiedEvent;
  autoPublished: boolean;
}

async function classifyOne(
  cluster: ClusterToClassify
): Promise<ClassifyOneResult | { category: "none" } | null> {
  const userContent = buildUserContent(cluster);

  // Pass 1 — classify (category, severity, runner-up).
  const first = await runClassify(userContent);
  if (!first) return null;
  if (first.category === "none") return { category: "none" };

  const cat = EVENT_CATEGORY_INDEX[first.category];
  if (!cat) {
    console.warn(
      `[classify] cluster ${cluster.clusterId}: invalid category "${first.category}"`
    );
    return null;
  }
  if (!cat.allowedTiers.includes(first.severityTier)) {
    console.warn(
      `[classify] cluster ${cluster.clusterId}: tier ${first.severityTier} not allowed for ${first.category}`
    );
    return null;
  }
  const range = SEVERITY_TIER_RANGES[first.severityTier];
  const severityValue = Math.max(
    range.min,
    Math.min(range.max, Math.round(first.severityValue))
  );

  // Pass 2 — verify (refute). Independent re-read that tries to knock the
  // first pass down; yields the published high/medium/low confidence.
  const verify = await runVerify(userContent, {
    category: first.category,
    runnerUp: first.runnerUp,
    dimension: cat.dimension,
    severityTier: first.severityTier,
    severityValue,
    rationale: first.rationale,
  });
  // A failed verify pass is conservative: treat as low confidence so the
  // event routes to human review rather than auto-publishing unverified.
  const confidence = verify?.confidence ?? "low";
  const agreement: ClassifierAgreement = agreementFromConfidence(confidence);

  const classifyRun: ClassifierRun = {
    run: 1,
    temp: 0,
    model: MODEL,
    category: first.category,
    dimension: cat.dimension,
    severityTier: first.severityTier,
    severityValue,
    selfConfidence: first.selfConfidence,
    rationale: first.rationale,
    raw: JSON.stringify({ pass: "classify", ...first }),
  };
  const verifyRun: ClassifierRun = {
    run: 2,
    temp: 0,
    model: MODEL,
    category: first.category,
    dimension: cat.dimension,
    severityTier: first.severityTier,
    severityValue,
    selfConfidence: first.selfConfidence,
    rationale: verify
      ? `verify (${verify.verdict}, ${confidence}): ${verify.rationale}`
      : "verify pass failed — treated as low confidence",
    raw: JSON.stringify({ pass: "verify", ...(verify ?? { confidence }) }),
  };

  const classified: ClassifiedEvent = {
    jurisdictionId: cluster.jurisdictionId,
    eventDate: cluster.eventDate,
    category: first.category,
    dimension: cat.dimension,
    severityTier: first.severityTier,
    severityValue,
    classifierRuns: [classifyRun, verifyRun],
    classifierAgreement: agreement,
    headline: cluster.title.slice(0, 200),
    description: cluster.body.slice(0, 1500),
  };

  // Auto-publish gate: low-confidence events and review-gated severity
  // tiers always route to the human review queue.
  const requiresReview =
    confidence === "low" || HUMAN_REVIEW_TIERS.has(first.severityTier);

  return {
    classified,
    autoPublished: !requiresReview,
  };
}

async function runClassify(
  userContent: string
): Promise<ClassifyResultLite | null> {
  const client = getAnthropic();
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (err) {
    console.error(`[classify] classify call failed:`, err);
    return null;
  }
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const parsed = parseClassify(text);
  if (!parsed) {
    console.warn(`[classify] classify parse failed: ${text.slice(0, 100)}`);
    return null;
  }
  return parsed;
}

async function runVerify(
  userContent: string,
  first: {
    category: string;
    runnerUp: string;
    dimension: PulseDimension;
    severityTier: SeverityTier;
    severityValue: number;
    rationale: string;
  }
): Promise<VerifyResultLite | null> {
  const client = getAnthropic();
  const verifyContent = `${userContent}

FIRST-PASS CLASSIFICATION TO VERIFY:
- category: ${first.category} (dimension ${first.dimension})
- runner-up considered: ${first.runnerUp}
- severity: ${first.severityTier} (${first.severityValue})
- rationale: ${first.rationale}`;
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0,
      system: VERIFY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: verifyContent }],
    });
  } catch (err) {
    console.error(`[classify] verify call failed:`, err);
    return null;
  }
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const parsed = parseVerify(text);
  if (!parsed) {
    console.warn(`[classify] verify parse failed: ${text.slice(0, 100)}`);
    return null;
  }
  return parsed;
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

export async function loadUnclassifiedClusters(
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

export async function writeEvent(
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

  // NOTE: freshness is stamped ONLY at ingest time (upsert.ts), gated on
  // rows actually written. The classifier pass performs no upstream fetch,
  // so it must NOT advance sources.last_sync_at — doing so overstates how
  // fresh the underlying source data is (a load-bearing provenance signal).
}

// Suppress unused imports the build doesn't strip:
void rawEvents;
void and;
void sources;
void eq;
void isNull;
