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
// Provider abstraction — the engine (Anthropic / DeepSeek / GLM / OpenAI) is
// env-driven. The published two-pass classify→verify methodology is
// unchanged; only which model(s) run the classify pass moves here.
// See plan/pulse-classifier-cost-resolution-v1.md (cost resolution) and
// plan/pulse-ensemble-classifier-implementation-2026-07-05.md (ensemble).
import {
  callClassifier,
  resolveClassifyEnsemble,
  resolveEnsembleVerifyConfig,
  resolveProviderConfig,
  type ResolvedProviderConfig,
} from "./provider";
import { clampSeverityToTier, computeConsensus } from "./ensemble";
import type { EnsembleRun } from "./ensemble";

const SYSTEM_PROMPT = CLASSIFIER_SYSTEM_PROMPT;

// Resolve the classify ENSEMBLE once per module load (lazy client init
// happens inside the provider layer). Owner decision 2026-07-05: the classify
// pass runs one call per independent vendor so their errors are uncorrelated.
// Default set: DeepSeek v4-flash + GLM 4.7-flashx + Anthropic Haiku 4.5.
// Overridable via PULSE_CLASSIFY_ENSEMBLE (comma list of provider:model). When
// that names exactly ONE pair, the pipeline runs in single-engine mode (the
// prior classify→verify behavior) — no consensus, no extra calls.
const CLASSIFY_ENSEMBLE: ResolvedProviderConfig[] = resolveClassifyEnsemble();
const IS_ENSEMBLE = CLASSIFY_ENSEMBLE.length > 1;

// Single-engine mode: the one classify engine, plus a separate verify engine
// (defaults preserved from the cost-resolution work via PULSE_VERIFY_*).
const CLASSIFY_CONFIG: ResolvedProviderConfig = IS_ENSEMBLE
  ? CLASSIFY_ENSEMBLE[0]
  : resolveProviderConfig("classify");
const SINGLE_VERIFY_CONFIG: ResolvedProviderConfig =
  resolveProviderConfig("verify");

// Ensemble verify engine (the adversarial pass on a majority verdict).
// Defaults to Anthropic Haiku 4.5 (cheap, same-vendor as the prompts).
const ENSEMBLE_VERIFY_CONFIG: ResolvedProviderConfig =
  resolveEnsembleVerifyConfig();

// The verify config actually used by the active mode.
const VERIFY_CONFIG: ResolvedProviderConfig = IS_ENSEMBLE
  ? ENSEMBLE_VERIFY_CONFIG
  : SINGLE_VERIFY_CONFIG;

/** Verify-run ordinal in classifierRuns (kept distinct from the classify
 *  runs' 1..N ordinals so React keys and audit rows never collide). */
const VERIFY_RUN_ORDINAL = 10;

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
  return IS_ENSEMBLE
    ? classifyOneEnsemble(cluster)
    : classifyOneSingle(cluster);
}

/**
 * Single-engine classify→verify (the prior behavior). Retained verbatim for
 * when PULSE_CLASSIFY_ENSEMBLE names exactly one engine (or for A/B backtests).
 */
async function classifyOneSingle(
  cluster: ClusterToClassify
): Promise<ClassifyOneResult | { category: "none" } | null> {
  const userContent = buildUserContent(cluster);

  // Pass 1 — classify (category, severity, runner-up).
  const first = await runClassify(CLASSIFY_CONFIG, userContent);
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
  const severityValue = clampSeverityToTier(
    first.severityValue,
    first.severityTier
  );

  // Pass 2 — verify (refute). Independent re-read that tries to knock the
  // first pass down; yields the published high/medium/low confidence.
  const verify = await runVerify(VERIFY_CONFIG, userContent, {
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
    provider: CLASSIFY_CONFIG.provider,
    model: CLASSIFY_CONFIG.model,
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
    provider: VERIFY_CONFIG.provider,
    model: VERIFY_CONFIG.model,
    category: first.category,
    dimension: cat.dimension,
    severityTier: first.severityTier,
    severityValue,
    selfConfidence: first.selfConfidence,
    confidence,
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

/**
 * Cross-model ensemble classify (owner decision 2026-07-05).
 *
 * Runs one classify call per configured engine IN PARALLEL
 * (`Promise.allSettled` — one engine erroring degrades to the survivors,
 * recorded), computes the consensus, then places the verify pass by the
 * published-gate semantics:
 *   - 'all' consensus       → verify STILL runs (one engine) as the
 *     adversarial check; a low confidence still routes to review.
 *   - 'two_of_three'        → verify runs; a REFUTED verdict downgrades to
 *     review.
 *   - 'none' (deadlock / no quorum) → skip verify, straight to review.
 *
 * Every engine's classify run + the verify run are recorded in
 * classifierRuns for audit.
 */
async function classifyOneEnsemble(
  cluster: ClusterToClassify
): Promise<ClassifyOneResult | { category: "none" } | null> {
  const userContent = buildUserContent(cluster);

  // --- Fan out one classify call per engine, in parallel ---
  const settled = await Promise.allSettled(
    CLASSIFY_ENSEMBLE.map((cfg) => runClassify(cfg, userContent))
  );

  const runs: EnsembleRun[] = [];
  const classifyRuns: ClassifierRun[] = [];
  settled.forEach((outcome, i) => {
    const cfg = CLASSIFY_ENSEMBLE[i];
    const result =
      outcome.status === "fulfilled" ? outcome.value : null;
    if (outcome.status === "rejected") {
      console.error(
        `[classify] ensemble engine ${cfg.provider}/${cfg.model} rejected:`,
        outcome.reason
      );
    }
    if (!result) return; // dropped voter (error or unparseable answer)
    runs.push({ config: cfg, result });
    // Record every successful classify run for audit (ordinals 1..N).
    const cat = EVENT_CATEGORY_INDEX[result.category];
    classifyRuns.push({
      run: classifyRuns.length + 1,
      temp: 0,
      provider: cfg.provider,
      model: cfg.model,
      category: result.category,
      dimension: cat?.dimension ?? "stability",
      severityTier: result.severityTier,
      severityValue: result.severityValue,
      selfConfidence: result.selfConfidence,
      rationale: result.rationale,
      raw: JSON.stringify({ pass: "classify", ...result }),
    });
  });

  // No engine returned anything usable — treat as a hard failure.
  if (runs.length === 0) return null;

  const consensus = computeConsensus(runs, CLASSIFY_ENSEMBLE.length);

  // Majority "none" (or a plurality "none" deadlock resolving to none) means
  // the ensemble agrees this is not a governance event — drop the cluster.
  // (A deadlock among REAL categories returns category="none" too, but with
  // agreement "none"; those must NOT be silently dropped — they route to
  // review below.)
  if (consensus.category === "none" && consensus.agreement !== "none") {
    return { category: "none" };
  }

  // Deadlock / no quorum → straight to review, verify skipped.
  if (consensus.agreement === "none") {
    return buildEnsembleResult(cluster, consensus, classifyRuns, {
      verify: null,
      verifySkipped: true,
      forceReview: true,
    });
  }

  // A real majority category — validate it against the taxonomy.
  const cat = EVENT_CATEGORY_INDEX[consensus.category];
  if (!cat) {
    console.warn(
      `[classify] cluster ${cluster.clusterId}: consensus category "${consensus.category}" not in taxonomy → review`
    );
    return buildEnsembleResult(cluster, consensus, classifyRuns, {
      verify: null,
      verifySkipped: true,
      forceReview: true,
    });
  }
  // If the consensus tier isn't allowed for the category, snap to the nearest
  // allowed tier rather than dropping the whole (agreed-upon) event.
  const severityTier: SeverityTier = cat.allowedTiers.includes(
    consensus.severityTier
  )
    ? consensus.severityTier
    : cat.allowedTiers[0];
  const severityValue = clampSeverityToTier(
    consensus.severityValue,
    severityTier
  );

  // --- Verify pass (adversarial). Runs for 'all' and 'two_of_three'. ---
  const verify = await runVerify(VERIFY_CONFIG, userContent, {
    category: consensus.category,
    runnerUp: consensus.runnerUp,
    dimension: cat.dimension,
    severityTier,
    severityValue,
    rationale: `ensemble ${consensus.agreement} (${consensus.agreeingCount}/${consensus.voterCount})`,
  });

  return buildEnsembleResult(
    cluster,
    { ...consensus, severityTier, severityValue },
    classifyRuns,
    { verify, verifySkipped: false, forceReview: false, dimension: cat.dimension }
  );
}

/**
 * Assemble the final ClassifyOneResult for the ensemble path: append the
 * verify run to the audit trail and apply the published gate.
 *
 * Gate for the ensemble:
 *   - severity tier in HUMAN_REVIEW_TIERS   → review (unchanged invariant)
 *   - deadlock/no-quorum (forceReview)      → review, no auto-publish
 *   - verify confidence "low" OR verify failed → review
 *   - verify REFUTED (is_event=false / verdict "rejected") → review
 *   - otherwise                              → auto-publish
 */
function buildEnsembleResult(
  cluster: ClusterToClassify,
  consensus: EnsembleConsensusLike,
  classifyRuns: ClassifierRun[],
  opts: {
    verify: Awaited<ReturnType<typeof runVerify>>;
    verifySkipped: boolean;
    forceReview: boolean;
    dimension?: PulseDimension;
  }
): ClassifyOneResult {
  const dimension: PulseDimension =
    opts.dimension ??
    EVENT_CATEGORY_INDEX[consensus.category]?.dimension ??
    "stability";

  const verify = opts.verify;
  // Verify confidence (only meaningful when the pass ran). A failed verify on
  // a pass that WAS supposed to run is conservative → treated as low.
  const verifyConfidence = opts.verifySkipped
    ? null
    : (verify?.confidence ?? "low");
  const verifyRefuted =
    !opts.verifySkipped &&
    verify != null &&
    (verify.isEvent === false || verify.verdict === "rejected");

  const allClassifierRuns: ClassifierRun[] = [...classifyRuns];
  if (!opts.verifySkipped) {
    allClassifierRuns.push({
      run: VERIFY_RUN_ORDINAL,
      temp: 0,
      provider: VERIFY_CONFIG.provider,
      model: VERIFY_CONFIG.model,
      category: consensus.category,
      dimension,
      severityTier: consensus.severityTier,
      severityValue: consensus.severityValue,
      selfConfidence: consensus.selfConfidence,
      confidence: verifyConfidence ?? "low",
      rationale: verify
        ? `verify (${verify.verdict}, ${verifyConfidence}): ${verify.rationale}`
        : "verify pass failed — treated as low confidence",
      raw: JSON.stringify({
        pass: "verify",
        ...(verify ?? { confidence: verifyConfidence }),
      }),
    });
  }

  const classified: ClassifiedEvent = {
    jurisdictionId: cluster.jurisdictionId,
    eventDate: cluster.eventDate,
    category: consensus.category,
    dimension,
    severityTier: consensus.severityTier,
    severityValue: consensus.severityValue,
    classifierRuns: allClassifierRuns,
    classifierAgreement: consensus.agreement,
    headline: cluster.title.slice(0, 200),
    description: cluster.body.slice(0, 1500),
  };

  const requiresReview =
    opts.forceReview ||
    HUMAN_REVIEW_TIERS.has(consensus.severityTier) ||
    verifyConfidence === "low" ||
    verifyRefuted;

  return { classified, autoPublished: !requiresReview };
}

/** The subset of EnsembleConsensus that buildEnsembleResult consumes (after
 *  the caller has snapped tier/value to the taxonomy). */
type EnsembleConsensusLike = {
  category: string;
  runnerUp: string;
  severityTier: SeverityTier;
  severityValue: number;
  selfConfidence: number;
  agreement: ClassifierAgreement;
  voterCount: number;
  agreeingCount: number;
  degraded: boolean;
};

async function runClassify(
  config: ResolvedProviderConfig,
  userContent: string
): Promise<ClassifyResultLite | null> {
  let response;
  try {
    response = await callClassifier(config, {
      system: SYSTEM_PROMPT,
      user: userContent,
      maxTokens: 800,
      expectJson: true,
    });
  } catch (err) {
    console.error(
      `[classify] classify call failed (${config.provider}/${config.model}):`,
      err
    );
    return null;
  }
  const parsed = parseClassify(response.text);
  if (!parsed) {
    console.warn(
      `[classify] classify parse failed (${config.provider}/${config.model}): ${response.text.slice(0, 100)}`
    );
    return null;
  }
  return parsed;
}

async function runVerify(
  config: ResolvedProviderConfig,
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
  const verifyContent = `${userContent}

FIRST-PASS CLASSIFICATION TO VERIFY:
- category: ${first.category} (dimension ${first.dimension})
- runner-up considered: ${first.runnerUp}
- severity: ${first.severityTier} (${first.severityValue})
- rationale: ${first.rationale}`;
  let response;
  try {
    response = await callClassifier(config, {
      system: VERIFY_SYSTEM_PROMPT,
      user: verifyContent,
      maxTokens: 500,
      expectJson: true,
    });
  } catch (err) {
    console.error(
      `[classify] verify call failed (${config.provider}/${config.model}):`,
      err
    );
    return null;
  }
  const parsed = parseVerify(response.text);
  if (!parsed) {
    console.warn(
      `[classify] verify parse failed: ${response.text.slice(0, 100)}`
    );
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
// Imported for parity with the prompt module / prior inline use; the ensemble
// refactor routes tier math through ensemble.ts helpers.
void EVENT_CATEGORIES;
void SEVERITY_TIER_RANGES;
