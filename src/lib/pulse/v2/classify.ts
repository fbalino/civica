/**
 * Cluster classifier — classify, then verify.
 *
 * For each unclassified cluster (a `cluster_id` in raw_events that
 * doesn't yet have a `pulse_events_v2` row), build a representative
 * title+body, then run the two separate reasoning passes published
 * in `content/methodology-pulse.md` (§ "Classification confidence —
 * classify, then verify"):
 *
 *   1. CLASSIFY — one pass assigns category, severity, and the runner-up
 *      category it considered.
 *   2. VERIFY (refute) — a separate pass re-reads the source
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
 *   - Severity tier in HUMAN_REVIEW_TIERS  → review required (absolute)
 *   - verify failed/refuted/low on a WEAK consensus (bare majority with low
 *     self-confidence, or a degraded run) → review; confident majorities
 *     and unanimous verdicts publish over a lone refuter
 *   - otherwise                            → auto-publish
 *
 * The persisted `classifier_agreement` column is retained for schema and
 * downstream compatibility (corroborate.ts, the review UI, the changelog).
 * Ensemble mode stores voter agreement; retired/single-engine paths map verify
 * confidence onto the compatibility labels. `classifier_runs` preserves the
 * successful classify runs and verification result for audit. A separate
 * subject-country attribution call runs afterward.
 *
 * The review queue is `pulse_events_v2` rows where `published = false`.
 */

import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  pulseClassificationDeliveryBindings,
  pulseEventsV2,
  pulsePipelineRuns,
  rawEvents,
  sources,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_INDEX,
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
  parseClassify,
  parseVerify,
} from "./classifier-prompt";
import {
  resolveSubjectJurisdiction,
  subjectAttributionSupportsAutomaticPublication,
  subjectAttributionDecisionPayload,
  activeSubjectAttributionModel,
  SUBJECT_ATTRIBUTION_PROMPT_VERSION,
  SUBJECT_ATTRIBUTION_PROVIDER,
} from "./country-attribution";
// Provider abstraction — the engine (Anthropic / DeepSeek / GLM / OpenAI) is
// env-driven. The published two-pass classify→verify methodology is
// unchanged; only which model(s) run the classify pass moves here.
// See plan/pulse-classifier-cost-resolution-v1.md (cost resolution) and
// plan/pulse-ensemble-classifier-implementation-2026-07-05.md (ensemble).
import { voterFailureKind, type VoterFailureKind } from "./subscription-cli";
import {
  callClassifier,
  resolveClassifyEnsemble,
  resolveEnsembleVerifyConfig,
  resolveProviderConfig,
  subscriptionTransportActive,
  type ResolvedProviderConfig,
} from "./provider";
import { clampSeverityToTier } from "./ensemble";
import type { EnsembleRun } from "./ensemble";
import {
  ensembleRequiresReview,
  normalizeInvalidConsensusForReview,
  PULSE_PUBLICATION_GATE_VERSION,
  singleEngineRequiresReview,
} from "./publication-gate";
import {
  PULSE_CLASSIFICATION_ALGORITHM_VERSION,
  PULSE_CLASSIFIER_PROMPT_VERSION,
  pulseEventVersionEnvelope,
} from "./versioning";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  loadPulsePipelineRunState,
  pulseCronStageRunId,
  pulseStageInputFingerprint,
  pulseStageVersionKey,
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";
import {
  PULSE_RUNTIME_METHOD_VERSION,
  PULSE_TAXONOMY_VERSION,
} from "./runtime-contract";
import {
  reviewsFromVerifier,
  type PulseDecisionActor,
  type PulseDecisionInput,
  type PulseDecisionPayloads,
} from "./decision-ledger";
import { persistPulseDecisions } from "./decision-ledger-store";
import {
  PULSE_CLASSIFICATION_RETRY_POLICY,
  buildClassificationConfigHash,
  type ClassificationConfigInput,
} from "./classification-state";
import {
  claimClassificationAttempt,
  loadClassificationQueueMetrics,
  settleClassificationAttempt,
  type ClaimedClassificationAttempt,
  type ClassificationQueueMetricsRow,
} from "./classification-state-store";
import {
  publishClassifiedCluster,
  publishNonGovernanceCluster,
} from "./classification-publication";
import {
  finalizeClassificationPipelineRun,
  type ClassificationRunFinalizationResult,
  type FrozenClassificationCluster,
} from "./classification-run-finalizer";
import { PULSE_JURISDICTION_ATTRIBUTION_VERSION } from "./jurisdiction-entities";
import {
  deriveStoredEnsemble,
  storedRunsPermitAutomaticPublication,
} from "./stored-ensemble";
import {
  publisherTextHasIndirectInstruction,
  renderUntrustedPublisherEvidence,
  retainedEvidenceQuoteMatches,
} from "./retained-source-evidence";

const SYSTEM_PROMPT = CLASSIFIER_SYSTEM_PROMPT;

// Resolve the classify ENSEMBLE once per module load (lazy client init
// happens inside the provider layer). Owner decision 2026-07-05: the classify
// pass runs one call per configured vendor to diversify error sources;
// statistical independence is not established.
// Default set: DeepSeek v4-flash + GLM 4.7 + Anthropic Haiku 4.5 (the
// flashx tier was disqualified on latency — 60s+ per call stalls the cron).
// Overridable via PULSE_CLASSIFY_ENSEMBLE (comma list of provider:model). When
// that names exactly ONE pair, the pipeline runs in single-engine mode (the
// prior classify→verify behavior) — no consensus, no extra calls.
const CLASSIFY_ENSEMBLE: ResolvedProviderConfig[] = resolveClassifyEnsemble();
const IS_ENSEMBLE = CLASSIFY_ENSEMBLE.length > 1;

// Single-engine mode: the one classify engine, plus a separate verify engine
// (defaults preserved from the cost-resolution work via PULSE_VERIFY_*).
const CLASSIFY_CONFIG: ResolvedProviderConfig = IS_ENSEMBLE
  ? CLASSIFY_ENSEMBLE[0]
  : CLASSIFY_ENSEMBLE[0];
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

export function currentClassificationConfig(): ClassificationConfigInput {
  return {
    methodVersion: PULSE_RUNTIME_METHOD_VERSION,
    ontologyVersion: PULSE_TAXONOMY_VERSION,
    algorithmVersion: PULSE_CLASSIFICATION_ALGORITHM_VERSION,
    classifierPromptVersion: PULSE_CLASSIFIER_PROMPT_VERSION,
    publicationGateVersion: PULSE_PUBLICATION_GATE_VERSION,
    classifyEngines: CLASSIFY_ENSEMBLE,
    verifyEngine: VERIFY_CONFIG,
    subjectAttribution: {
      provider: SUBJECT_ATTRIBUTION_PROVIDER,
      model: activeSubjectAttributionModel(),
      attributionVersion: PULSE_JURISDICTION_ATTRIBUTION_VERSION,
      promptVersion: SUBJECT_ATTRIBUTION_PROMPT_VERSION,
    },
    // Subscription CLIs do not expose decoding parameters; the configuration
    // honestly records provider-default decoding (disclosed limitation in
    // pulse-subscription-runtime-resolution-v1 §4).
    decodeMode: subscriptionTransportActive()
      ? "provider-default-json"
      : "temperature-0-json",
    thinkingMode: "disabled",
    retryPolicy: PULSE_CLASSIFICATION_RETRY_POLICY,
  };
}

export const CURRENT_CLASSIFICATION_CONFIG = currentClassificationConfig();
export const CURRENT_CLASSIFICATION_CONFIG_HASH = buildClassificationConfigHash(
  CURRENT_CLASSIFICATION_CONFIG,
);

/** Verify-run ordinal in classifierRuns (kept distinct from the classify
 *  runs' 1..N ordinals so React keys and audit rows never collide). */
const VERIFY_RUN_ORDINAL = 10;

function runEvidence(role: "classify" | "verify") {
  return {
    role,
    promptVersion: PULSE_CLASSIFIER_PROMPT_VERSION,
    methodVersion: PULSE_RUNTIME_METHOD_VERSION,
    configurationHash: CURRENT_CLASSIFICATION_CONFIG_HASH,
    configuredEngineCount: CLASSIFY_ENSEMBLE.length,
  } as const;
}

export interface ClusterToClassify {
  clusterId: string;
  /** PUL-031 stable incident identity. Legacy/fixture callers may omit it
   * during migration; their cluster id is the compatibility identity. */
  incidentId?: string;
  jurisdictionId: string;
  eventDate: string;
  title: string;
  body: string;
  /** raw_events row ids contributing to this cluster */
  rawEventIds: string[];
  /** distinct source ids contributing */
  sourceIds: string[];
  sourceTypes: string[];
  /** Cluster-stage runs represented by this cluster's raw members. */
  clusterRunIds: string[];
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
  runId: string;
  versionKey: string;
  clustersExamined: number;
  classified: number;
  publishedAuto: number;
  flaggedForReview: number;
  noneCategory: number;
  failed: number;
  modelCalls: number;
  retryableFailures: number;
  terminalFailures: number;
  claimsSkipped: number;
  /**
   * Voter dropouts for this run, keyed `<provider>.<kind>` plus
   * `<provider>.<kind>.severity.<outcome>`. `content_filter` entries are
   * provider-side content-policy refusals, kept separate from ordinary
   * failures so content-correlated dropout is measurable.
   */
  voterFailures: Record<string, number>;
  configHash: string;
  queueBefore: ClassificationQueueMetricsRow | null;
  queueAfter: ClassificationQueueMetricsRow | null;
  dryRun: boolean;
  /** True when a delivery retry reused durable terminal run evidence. */
  reused: boolean;
  planned: Array<{
    clusterId: string;
    jurisdictionId: string;
    category: string;
    autoPublished: boolean;
  }>;
}

type ClassifierResult = ClassifyOneResult | { category: "none" } | null;

export interface ClassifyClustersOptions {
  limit?: number;
  dryRun?: boolean;
  clusters?: ClusterToClassify[];
  classify?: (cluster: ClusterToClassify) => Promise<ClassifierResult>;
  resolveSubject?: (
    db: Db,
    headline: string,
    description: string,
    provisionalJurisdictionId?: string | null,
  ) => Promise<Awaited<ReturnType<typeof resolveSubjectJurisdiction>> | null>;
  write?: (
    db: Db,
    cluster: ClusterToClassify,
    result: ClassifyOneResult,
    classificationRunId: string,
  ) => Promise<string | null | void>;
  writeNonEvent?: (
    db: Db,
    cluster: ClusterToClassify,
    classificationRunId: string,
  ) => Promise<void>;
  runRef?: PulsePipelineRunRef;
  /** Stable identity injected by the authenticated cron wrapper. */
  cronExecutionKey?: string;
  now?: Date;
  failOnError?: boolean;
}

function validateClusterFixtures(clusters: readonly ClusterToClassify[]): void {
  const ids = new Set<string>();
  for (const [index, cluster] of clusters.entries()) {
    if (
      !cluster.clusterId.trim() ||
      !cluster.jurisdictionId.trim() ||
      !cluster.title.trim()
    ) {
      throw new Error(
        `Invalid classification cluster at index ${index}: clusterId, jurisdictionId, and title are required`,
      );
    }
    if (
      !cluster.rawEventIds.length ||
      cluster.rawEventIds.length !== cluster.attributions.length
    ) {
      throw new Error(
        `Invalid classification cluster ${cluster.clusterId}: raw-event attribution is incomplete`,
      );
    }
    if (
      !cluster.clusterRunIds.length ||
      cluster.clusterRunIds.some((id) => !id.trim())
    ) {
      throw new Error(
        `Invalid classification cluster ${cluster.clusterId}: cluster-run lineage is missing`,
      );
    }
    if (ids.has(cluster.clusterId)) {
      throw new Error(
        `Invalid classification fixture: duplicate cluster id ${cluster.clusterId}`,
      );
    }
    ids.add(cluster.clusterId);
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Hash the exact model/publication values admitted by a classify run. */
export function classificationInputFingerprint(
  clusters: readonly ClusterToClassify[],
): string {
  return pulseStageInputFingerprint(
    [...clusters]
      .sort((left, right) => left.clusterId.localeCompare(right.clusterId))
      .map((cluster) => ({
        clusterId: cluster.clusterId,
        incidentId: cluster.incidentId ?? null,
        jurisdictionId: cluster.jurisdictionId,
        eventDate: cluster.eventDate,
        title: cluster.title,
        body: cluster.body,
        rawEventIds: [...cluster.rawEventIds].sort(),
        sourceIds: [...cluster.sourceIds].sort(),
        sourceTypes: [...cluster.sourceTypes].sort(),
        clusterRunIds: [...cluster.clusterRunIds].sort(),
        attributions: [...cluster.attributions].sort((left, right) =>
          left.rawEventId.localeCompare(right.rawEventId),
        ),
      })),
  );
}

function classificationInputIds(
  clusters: readonly ClusterToClassify[],
): string[] {
  return [
    `classification-config:${CURRENT_CLASSIFICATION_CONFIG_HASH}`,
    ...clusters.flatMap((cluster) => [
      `cluster:${cluster.clusterId}`,
      ...cluster.rawEventIds.map(
        (rawEventId) => `cluster-raw:${cluster.clusterId}:${rawEventId}`,
      ),
    ]),
  ];
}

function frozenClassificationClusters(
  inputIds: readonly string[] | undefined,
  runId: string,
): {
  configHash: string;
  clusters: FrozenClassificationCluster[];
} {
  if (!inputIds) {
    throw new Error(
      `Running classification run lacks an input snapshot: ${runId}`,
    );
  }
  const configInputs = inputIds.filter((id) =>
    id.startsWith("classification-config:"),
  );
  const configHash = configInputs[0]?.slice("classification-config:".length);
  if (
    configInputs.length !== 1 ||
    !configHash ||
    !/^pulse-classification-config\/v1\/sha256:[a-f0-9]{64}$/.test(configHash)
  ) {
    throw new Error(
      `Classification run has an invalid configuration input: ${runId}`,
    );
  }
  const clusters = new Map<string, string[]>();
  for (const inputId of inputIds) {
    if (inputId.startsWith("classification-config:")) continue;
    if (inputId.startsWith("cluster:")) {
      const clusterId = inputId.slice("cluster:".length);
      if (!UUID_PATTERN.test(clusterId) || clusters.has(clusterId)) {
        throw new Error(
          `Classification run has an invalid cluster input: ${runId}`,
        );
      }
      clusters.set(clusterId, []);
    }
  }
  for (const inputId of inputIds) {
    if (
      inputId.startsWith("classification-config:") ||
      inputId.startsWith("cluster:")
    ) {
      continue;
    }
    const [kind, clusterId, rawEventId, ...rest] = inputId.split(":");
    if (
      kind !== "cluster-raw" ||
      rest.length > 0 ||
      !UUID_PATTERN.test(clusterId) ||
      !UUID_PATTERN.test(rawEventId) ||
      !clusters.has(clusterId)
    ) {
      throw new Error(`Classification run has an invalid raw input: ${runId}`);
    }
    clusters.get(clusterId)!.push(rawEventId);
  }
  const frozen = [...clusters].map(([clusterId, rawEventIds]) => ({
    clusterId,
    rawEventIds: [...rawEventIds].sort(),
  }));
  if (
    frozen.some(({ rawEventIds }) => rawEventIds.length === 0) ||
    new Set(frozen.flatMap(({ rawEventIds }) => rawEventIds)).size !==
      frozen.reduce((count, { rawEventIds }) => count + rawEventIds.length, 0)
  ) {
    throw new Error(
      `Classification run has an incomplete input snapshot: ${runId}`,
    );
  }
  return {
    configHash,
    clusters: frozen.sort((left, right) =>
      left.clusterId.localeCompare(right.clusterId),
    ),
  };
}

function validatedFrozenClassificationRun(run: PulsePipelineRunRef): {
  configHash: string;
  clusters: FrozenClassificationCluster[];
  inputFingerprint: string;
} {
  const frozen = frozenClassificationClusters(run.versions.inputIds, run.id);
  const inputFingerprint = run.versions.inputFingerprint;
  if (
    !inputFingerprint ||
    !/^pulse-stage-input\/sha256:[a-f0-9]{64}$/.test(inputFingerprint)
  ) {
    throw new Error(
      `Classification run has an invalid input fingerprint: ${run.id}`,
    );
  }
  if (pulseStageVersionKey(run.versions) !== run.versionKey) {
    throw new Error(
      `Classification run has a mismatched version key: ${run.id}`,
    );
  }
  return { ...frozen, inputFingerprint };
}

async function reconstructFrozenClassificationSnapshot(
  db: Db,
  run: PulsePipelineRunRef,
  frozen: ReturnType<typeof validatedFrozenClassificationRun>,
  fallbackEventDate: string,
): Promise<ClusterToClassify[]> {
  const clusterIds = frozen.clusters.map(({ clusterId }) => clusterId);
  const rawEventIds = frozen.clusters.flatMap(({ rawEventIds }) => rawEventIds);
  const replayedSnapshot = await loadUnclassifiedClusters(
    db,
    Math.max(1, frozen.clusters.length),
    frozen.configHash,
    {
      clusterIds,
      rawEventIds,
      includeSettled: true,
      fallbackEventDate,
    },
  );
  validateClusterFixtures(replayedSnapshot);
  const replayedClusterIds = replayedSnapshot
    .map(({ clusterId }) => clusterId)
    .sort();
  const replayedRawEventIds = replayedSnapshot
    .flatMap(({ rawEventIds }) => rawEventIds)
    .sort();
  if (
    JSON.stringify(replayedClusterIds) !==
      JSON.stringify([...clusterIds].sort()) ||
    JSON.stringify(replayedRawEventIds) !==
      JSON.stringify([...rawEventIds].sort())
  ) {
    throw new Error(
      `Classification retry input snapshot is incomplete: ${run.id}`,
    );
  }
  if (
    classificationInputFingerprint(replayedSnapshot) !== frozen.inputFingerprint
  ) {
    throw new Error(`Classification retry input values changed: ${run.id}`);
  }
  return replayedSnapshot;
}

function reusedClassificationSummary(
  run: PulsePipelineRunRef,
  counts: Record<string, number>,
  configHash: string,
): ClassifySummary {
  return {
    runId: run.id,
    versionKey: run.versionKey,
    clustersExamined: counts.clustersExamined ?? 0,
    classified: counts.classified ?? 0,
    publishedAuto: counts.publishedAuto ?? 0,
    flaggedForReview: counts.flaggedForReview ?? 0,
    noneCategory: counts.nonGovernance ?? 0,
    failed: counts.failed ?? 0,
    modelCalls: counts.modelCalls ?? 0,
    retryableFailures: counts.retryableFailures ?? 0,
    terminalFailures: counts.terminalFailures ?? 0,
    claimsSkipped: counts.claimsSkipped ?? 0,
    voterFailures: Object.fromEntries(
      Object.entries(counts)
        .filter(([key]) => key.startsWith("voter."))
        .map(([key, value]) => [key.slice("voter.".length), value]),
    ),
    configHash,
    queueBefore: null,
    queueAfter: null,
    dryRun: false,
    reused: true,
    planned: [],
  };
}

function applyFinalizedCounts(
  summary: ClassifySummary,
  finalized: ClassificationRunFinalizationResult,
): void {
  summary.clustersExamined = finalized.counts.clustersExamined ?? 0;
  summary.classified = finalized.counts.classified ?? 0;
  summary.publishedAuto = finalized.counts.publishedAuto ?? 0;
  summary.flaggedForReview = finalized.counts.flaggedForReview ?? 0;
  summary.noneCategory = finalized.counts.nonGovernance ?? 0;
  summary.failed = finalized.counts.failed ?? 0;
  summary.modelCalls = finalized.counts.modelCalls ?? 0;
  summary.retryableFailures = finalized.counts.retryableFailures ?? 0;
  summary.terminalFailures = finalized.counts.terminalFailures ?? 0;
  summary.claimsSkipped = finalized.counts.claimsSkipped ?? 0;
}

async function loadSoleRunningClassificationRun(
  db: Db,
): Promise<Awaited<ReturnType<typeof loadPulsePipelineRunState>>> {
  const running = await db
    .select({ id: pulsePipelineRuns.id })
    .from(pulsePipelineRuns)
    .where(
      and(
        eq(pulsePipelineRuns.stage, "classify"),
        eq(pulsePipelineRuns.status, "running"),
      ),
    )
    .orderBy(pulsePipelineRuns.startedAt)
    .limit(2);
  if (running.length > 1) {
    throw new Error(
      "Multiple running classification runs require operator reconciliation",
    );
  }
  return running[0]
    ? loadPulsePipelineRunState(db, running[0].id, "classify")
    : null;
}

async function loadBoundClassificationRun(
  db: Db,
  executionKey: string,
): Promise<Awaited<ReturnType<typeof loadPulsePipelineRunState>>> {
  const rows = await db
    .select({
      classificationRunId:
        pulseClassificationDeliveryBindings.classificationRunId,
    })
    .from(pulseClassificationDeliveryBindings)
    .where(eq(pulseClassificationDeliveryBindings.executionKey, executionKey))
    .limit(1);
  const binding = rows[0];
  if (!binding) return null;
  const run = await loadPulsePipelineRunState(
    db,
    binding.classificationRunId,
    "classify",
  );
  if (!run) {
    throw new Error(
      `Classification delivery binding has no pipeline run: ${executionKey}`,
    );
  }
  return run;
}

async function bindClassificationDeliveryRun(
  db: Db,
  executionKey: string,
  classificationRunId: string,
): Promise<void> {
  await db
    .insert(pulseClassificationDeliveryBindings)
    .values({ executionKey, classificationRunId })
    .onConflictDoNothing({
      target: pulseClassificationDeliveryBindings.executionKey,
    });
  const rows = await db
    .select({
      classificationRunId:
        pulseClassificationDeliveryBindings.classificationRunId,
    })
    .from(pulseClassificationDeliveryBindings)
    .where(eq(pulseClassificationDeliveryBindings.executionKey, executionKey))
    .limit(1);
  if (rows[0]?.classificationRunId !== classificationRunId) {
    throw new Error(
      `Classification delivery identity collision: ${executionKey}`,
    );
  }
}

/**
 * Pull all clusters that don't yet have a pulse_events_v2 row, then
 * classify each one. Returns a summary.
 */
export async function classifyClusters(
  db: Db,
  opts: ClassifyClustersOptions = {},
): Promise<ClassifySummary> {
  // One cron execution is a bounded paid batch. The cluster cap plus the
  // provider contract are the local cost ceiling; provider workspaces carry
  // the monthly cap and alert threshold.
  const limit = Math.min(opts.limit ?? 50, 50);
  // A classify stage run owns its own voter-dropout tally.
  resetVoterFailures();
  const operationNow = opts.now ?? new Date();
  const persistRun = !opts.dryRun && !opts.clusters && !opts.runRef;
  const persistState = !opts.dryRun && !opts.clusters;
  const cronRunId = opts.cronExecutionKey
    ? pulseCronStageRunId(opts.cronExecutionKey, "classify")
    : null;
  if (cronRunId && opts.runRef && opts.runRef.id !== cronRunId) {
    throw new Error(
      "classification runRef conflicts with the cron delivery identity",
    );
  }
  let existingRun: Awaited<ReturnType<typeof loadPulsePipelineRunState>> = null;
  if (persistRun && cronRunId && opts.cronExecutionKey) {
    existingRun = await loadBoundClassificationRun(db, opts.cronExecutionKey);
    if (!existingRun) {
      existingRun =
        (await loadPulsePipelineRunState(db, cronRunId, "classify")) ??
        (await loadSoleRunningClassificationRun(db));
      if (existingRun) {
        // Persist the handoff before reading, finalizing, or invoking models.
        // If wrapper finalization fails afterward, the same delivery retry
        // still resolves to this exact adopted run.
        await bindClassificationDeliveryRun(
          db,
          opts.cronExecutionKey,
          existingRun.run.id,
        );
      }
    }
  }
  const frozen = existingRun
    ? validatedFrozenClassificationRun(existingRun.run)
    : null;
  if (
    existingRun?.status === "completed" ||
    existingRun?.status === "partial"
  ) {
    return reusedClassificationSummary(
      existingRun.run,
      existingRun.counts,
      frozen!.configHash,
    );
  }
  if (existingRun && existingRun.status !== "running") {
    throw new Error(
      `Terminal Pulse pipeline run cannot be resumed: ${existingRun.run.id} (${existingRun.status})`,
    );
  }
  const selectionTime = existingRun?.startedAt ?? operationNow;
  const fallbackEventDate = selectionTime.toISOString().slice(0, 10);

  if (existingRun && frozen) {
    await reconstructFrozenClassificationSnapshot(
      db,
      existingRun.run,
      frozen,
      fallbackEventDate,
    );
    const recovered = await finalizeClassificationPipelineRun(db, {
      runId: existingRun.run.id,
      configHash: frozen.configHash,
      clusters: frozen.clusters,
    });
    if (recovered) {
      return reusedClassificationSummary(
        existingRun.run,
        recovered.counts,
        frozen.configHash,
      );
    }
    if (frozen.configHash !== CURRENT_CLASSIFICATION_CONFIG_HASH) {
      throw new Error(
        `Classification retry configuration changed: ${existingRun.run.id}`,
      );
    }
  }

  let clusters: ClusterToClassify[];
  if (opts.clusters) {
    clusters = opts.clusters;
  } else if (existingRun && frozen) {
    const clusterIds = frozen.clusters.map(({ clusterId }) => clusterId);
    const rawEventIds = frozen.clusters.flatMap(
      ({ rawEventIds }) => rawEventIds,
    );
    clusters = await loadUnclassifiedClusters(
      db,
      Math.max(1, frozen.clusters.length),
      frozen.configHash,
      {
        clusterIds,
        rawEventIds,
        fallbackEventDate,
        eligibilityNow: operationNow,
      },
    );
  } else {
    clusters = await loadUnclassifiedClusters(
      db,
      limit,
      CURRENT_CLASSIFICATION_CONFIG_HASH,
      { fallbackEventDate, eligibilityNow: operationNow },
    );
  }
  validateClusterFixtures(clusters);
  const classify = opts.classify ?? classifyOne;
  const resolveSubject = opts.resolveSubject ?? resolveSubjectJurisdiction;
  const run =
    existingRun?.run ??
    opts.runRef ??
    createPulsePipelineRunRef("classify", {
      id: cronRunId ?? undefined,
      sourceIds: clusters.length
        ? clusters.flatMap(({ sourceIds }) => sourceIds)
        : undefined,
      upstreamRunIds: clusters.flatMap(({ clusterRunIds }) => clusterRunIds),
      models: [
        ...CLASSIFY_ENSEMBLE.map(({ provider, model }) => ({
          role: "classify" as const,
          provider,
          model,
        })),
        {
          role: "verify" as const,
          provider: VERIFY_CONFIG.provider,
          model: VERIFY_CONFIG.model,
        },
        {
          role: "subject_attribution" as const,
          provider: SUBJECT_ATTRIBUTION_PROVIDER,
          model: activeSubjectAttributionModel(),
        },
      ],
      inputIds: classificationInputIds(clusters),
      inputFingerprint: classificationInputFingerprint(clusters),
    });
  if (persistRun && !existingRun) {
    await startPulsePipelineRun(db, run, { startedAt: selectionTime });
    if (opts.cronExecutionKey) {
      await bindClassificationDeliveryRun(db, opts.cronExecutionKey, run.id);
    }
  }
  const queueBefore = persistState
    ? await loadClassificationQueueMetrics(
        db,
        CURRENT_CLASSIFICATION_CONFIG_HASH,
        operationNow,
      )
    : null;

  const summary: ClassifySummary = {
    runId: run.id,
    versionKey: run.versionKey,
    clustersExamined: clusters.length,
    classified: 0,
    publishedAuto: 0,
    flaggedForReview: 0,
    noneCategory: 0,
    failed: 0,
    modelCalls: 0,
    retryableFailures: 0,
    terminalFailures: 0,
    claimsSkipped: 0,
    voterFailures: {},
    configHash: CURRENT_CLASSIFICATION_CONFIG_HASH,
    queueBefore,
    queueAfter: null,
    dryRun: opts.dryRun ?? false,
    reused: false,
    planned: [],
  };

  for (const cluster of clusters) {
    let claim = null;
    try {
      claim = persistState
        ? await claimClassificationAttempt(db, {
            clusterId: cluster.clusterId,
            incidentId: cluster.incidentId,
            configHash: CURRENT_CLASSIFICATION_CONFIG_HASH,
            config: CURRENT_CLASSIFICATION_CONFIG,
            runId: run.id,
            now: operationNow,
          })
        : null;
    } catch (err) {
      console.error(
        `[classify] cluster ${cluster.clusterId} claim failed:`,
        err,
      );
      summary.failed++;
      continue;
    }
    if (persistState && !claim) {
      summary.claimsSkipped++;
      continue;
    }
    let claimSettled = false;
    let attemptedOutcome:
      | { kind: "classified"; result: ClassifyOneResult }
      | { kind: "none" }
      | null = null;
    try {
      summary.modelCalls++;
      const result = await classify(cluster);
      if (!result) {
        if (!opts.dryRun) {
          await persistClassificationFailureDecision(db, cluster, run.id);
        }
        if (claim) {
          const status = await settleClassificationAttempt(db, claim, {
            outcome: "failure",
            error: new Error("No usable classifier result was produced."),
            modelCallCount: 1,
          });
          claimSettled = true;
          if (status === "retryable_failure") summary.retryableFailures++;
          else if (status === "terminal_failure") summary.terminalFailures++;
          else {
            throw new Error(
              `Classifier produced no result after attempt ${cluster.clusterId} had already settled as ${status}`,
            );
          }
        }
        summary.failed++;
        continue;
      }
      if ("category" in result && result.category === "none") {
        attemptedOutcome = { kind: "none" };
        if (!opts.dryRun) {
          if (opts.writeNonEvent) {
            await opts.writeNonEvent(db, cluster, run.id);
          } else {
            await writeNonEventCluster(db, cluster, run.id, {
              decision: result,
              reason: "classifier returned category none",
              claim,
            });
            claimSettled = Boolean(claim);
          }
        }
        if (claim && opts.writeNonEvent) {
          await settleClassificationAttempt(db, claim, {
            outcome: "none",
            modelCallCount: 1,
          });
          claimSettled = true;
        }
        summary.noneCategory++;
        continue;
      }
      // Narrowed: result is ClassifyOneResult here
      const ok = result as ClassifyOneResult;
      // Correct the country attribution to the event's SUBJECT country.
      // The cluster's jurisdiction came from the cheap mention/source-
      // language resolver, which mis-files e.g. a Chinese-language story
      // about US redistricting under Taiwan. Re-attribute by subject so
      // the scored/displayed event lands on the right country.
      const subject = await resolveSubject(
        db,
        ok.classified.headline,
        ok.classified.description,
        cluster.jurisdictionId,
      );
      ok.subjectAttribution = subject;
      if (subject?.primaryJurisdictionId) {
        ok.classified.jurisdictionId = subject.primaryJurisdictionId;
      } else {
        ok.autoPublished = false;
      }
      if (
        ok.autoPublished &&
        !automaticPublicationHasRetainedEvidence(cluster, ok)
      ) {
        ok.autoPublished = false;
      }
      attemptedOutcome = { kind: "classified", result: ok };
      summary.planned.push({
        clusterId: cluster.clusterId,
        jurisdictionId: ok.classified.jurisdictionId,
        category: ok.classified.category,
        autoPublished: ok.autoPublished,
      });
      const writtenEventId = !opts.dryRun
        ? opts.write
          ? await opts.write(db, cluster, ok, run.id)
          : await writeEvent(db, cluster, ok, run.id, claim)
        : null;
      if (claim) {
        const eventId =
          typeof writtenEventId === "string"
            ? writtenEventId
            : await loadEventIdForCluster(db, cluster.clusterId);
        if (!eventId) {
          throw new Error(
            `Classified cluster ${cluster.clusterId} has no persisted event projection`,
          );
        }
        if (opts.write) {
          await settleClassificationAttempt(db, claim, {
            outcome: "classified",
            eventId,
            modelCallCount: 1,
          });
        }
        claimSettled = true;
      }
      summary.classified++;
      if (ok.autoPublished) summary.publishedAuto++;
      else summary.flaggedForReview++;
    } catch (err) {
      if (claim && !claimSettled) {
        const status = await settleClassificationAttempt(db, claim, {
          outcome: "failure",
          error: err,
          modelCallCount: 1,
        });
        claimSettled = true;
        if (
          status === "classified" &&
          attemptedOutcome?.kind === "classified"
        ) {
          summary.classified++;
          if (attemptedOutcome.result.autoPublished) summary.publishedAuto++;
          else summary.flaggedForReview++;
          continue;
        }
        if (status === "none" && attemptedOutcome?.kind === "none") {
          summary.noneCategory++;
          continue;
        }
        if (status === "retryable_failure") summary.retryableFailures++;
        else if (status === "terminal_failure") summary.terminalFailures++;
        else {
          throw new Error(
            `Classification attempt ${cluster.clusterId} settled as ${status} after a mismatched publication failure`,
            { cause: err },
          );
        }
      }
      if (opts.failOnError) {
        if (persistRun && !cronRunId) {
          await finishPulsePipelineRun(db, run.id, {
            status: "failed",
            counts: {
              clustersExamined: summary.clustersExamined,
              classified: summary.classified,
              failed: summary.failed + 1,
              modelCalls: summary.modelCalls,
            },
            failures: [
              {
                component: `classification:${cluster.clusterId}`,
                message: err instanceof Error ? err.message : String(err),
              },
            ],
          });
        }
        throw err;
      }
      console.error(`[classify] cluster ${cluster.clusterId} failed:`, err);
      summary.failed++;
    }
  }

  summary.planned.sort((left, right) =>
    left.clusterId.localeCompare(right.clusterId),
  );
  try {
    summary.queueAfter = persistState
      ? await loadClassificationQueueMetrics(
          db,
          CURRENT_CLASSIFICATION_CONFIG_HASH,
          operationNow,
        )
      : null;
  } catch (err) {
    if (persistRun && !cronRunId) {
      await finishPulsePipelineRun(db, run.id, {
        status: "failed",
        counts: {
          clustersExamined: summary.clustersExamined,
          classified: summary.classified,
          failed: summary.failed,
          modelCalls: summary.modelCalls,
        },
        failures: [
          {
            component: "classification_queue_metrics",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      });
    }
    throw err;
  }
  // Snapshot the run's voter dropouts before any finalization path persists
  // counts, so both the cron and direct paths carry the same tally.
  summary.voterFailures = voterFailureCounts();
  if (persistRun && cronRunId) {
    const runSnapshot = frozenClassificationClusters(
      run.versions.inputIds,
      run.id,
    );
    const finalized = await finalizeClassificationPipelineRun(db, {
      runId: run.id,
      configHash: runSnapshot.configHash,
      clusters: runSnapshot.clusters,
    });
    if (finalized) {
      applyFinalizedCounts(summary, finalized);
    } else if (summary.failed === 0) {
      throw new Error(
        `Classification delivery remains incomplete without a retryable failure: ${run.id}`,
      );
    }
  } else if (persistRun) {
    await finishPulsePipelineRun(db, run.id, {
      status: summary.failed > 0 ? "partial" : "completed",
      counts: {
        clustersExamined: summary.clustersExamined,
        classified: summary.classified,
        publishedAuto: summary.publishedAuto,
        flaggedForReview: summary.flaggedForReview,
        nonGovernance: summary.noneCategory,
        failed: summary.failed,
        modelCalls: summary.modelCalls,
        retryableFailures: summary.retryableFailures,
        terminalFailures: summary.terminalFailures,
        claimsSkipped: summary.claimsSkipped,
        ...Object.fromEntries(
          Object.entries(summary.voterFailures).map(([key, value]) => [
            `voter.${key}`,
            value,
          ]),
        ),
      },
      failures:
        summary.failed > 0
          ? [
              {
                component: "classification",
                message: `${summary.failed} cluster(s) failed classification or attribution.`,
              },
            ]
          : [],
    });
  }
  return summary;
}

export interface ClassifyOneResult {
  classified: ClassifiedEvent;
  autoPublished: boolean;
  verification: VerifyResultLite | null;
  subjectAttribution?: Awaited<
    ReturnType<typeof resolveSubjectJurisdiction>
  > | null;
}

async function classifyOne(
  cluster: ClusterToClassify,
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
  cluster: ClusterToClassify,
): Promise<ClassifyOneResult | { category: "none" } | null> {
  const userContent = buildUserContent(cluster);
  const sourceHasIndirectInstruction = publisherTextHasIndirectInstruction({
    headline: cluster.title,
    description: cluster.body,
  });

  // Pass 1 — classify (category, severity, runner-up).
  const first = await runClassify(CLASSIFY_CONFIG, userContent);
  if (!first) return null;
  if (first.category === "none") {
    return sourceHasIndirectInstruction ? null : { category: "none" };
  }

  const cat = EVENT_CATEGORY_INDEX[first.category];
  if (!cat) {
    console.warn(
      `[classify] cluster ${cluster.clusterId}: invalid category "${first.category}"`,
    );
    return null;
  }
  if (!cat.allowedTiers.includes(first.severityTier)) {
    console.warn(
      `[classify] cluster ${cluster.clusterId}: tier ${first.severityTier} not allowed for ${first.category}`,
    );
    return null;
  }
  const severityValue = clampSeverityToTier(
    first.severityValue,
    first.severityTier,
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

  const classifyRun: ClassifierRun = {
    run: 1,
    temp: 0,
    provider: CLASSIFY_CONFIG.provider,
    model: CLASSIFY_CONFIG.model,
    transport: CLASSIFY_CONFIG.transport,
    ...runEvidence("classify"),
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
    transport: VERIFY_CONFIG.transport,
    ...runEvidence("verify"),
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
    classifierAgreement: "none",
    headline: cluster.title.slice(0, 200),
    description: cluster.body.slice(0, 1500),
  };

  // Auto-publish gate: every verifier objection and review-gated severity
  // tier routes to the human review queue. Single-engine mode has no
  // independent majority signal that can outweigh an objection.
  const requiresReview =
    singleEngineRequiresReview(first.severityTier, verify) ||
    !classifierRunsHaveRetainedSourceEvidence(
      cluster,
      first.category,
      [classifyRun],
    );

  return {
    classified,
    // PUL-036: subscription-agent classifications always queue for human
    // review — the subscription-cli transport can never auto-publish.
    autoPublished: !requiresReview && !subscriptionTransportActive(),
    verification: verify,
  };
}

/**
 * Cross-model ensemble classify (owner decision 2026-07-05).
 *
 * Runs one classify call per configured engine IN PARALLEL
 * (`Promise.allSettled` — one engine erroring degrades to the survivors,
 * recorded), computes the consensus, then places the verify pass by the
 * published-gate semantics:
 *   - 'all' consensus       → verify STILL runs as an adversarial signal;
 *     verifier-only objections do not override a full-panel unanimity.
 *   - 'two_of_three'        → verify runs; a refuted verdict downgrades to
 *     review ONLY when the majority is weak (low self-confidence or a
 *     degraded run) — the verifier is a signal, not a veto.
 *   - 'none' (deadlock / no quorum) → skip verify, straight to review.
 *
 * Every engine's classify run + the verify run are recorded in
 * classifierRuns for audit.
 */
/**
 * Per-run tally of voter dropouts, keyed `<provider>.<kind>` and — once the
 * surviving voters agree an outcome — `<provider>.<kind>.severity.<tier>`.
 * The severity pairing is the point: it answers "does this voter fail more
 * often on the worst events?", which a bare failure count cannot.
 *
 * Module-scoped because a classify stage run is one process; `resetVoterFailures`
 * is called at the top of every `classifyClusters` so a second in-process run
 * (fixtures, tests) never inherits the previous tally.
 */
const voterFailureTally = new Map<string, number>();

export function resetVoterFailures(): void {
  voterFailureTally.clear();
}

export function recordVoterFailure(provider: string, kind: VoterFailureKind): void {
  const key = `${provider}.${kind}`;
  voterFailureTally.set(key, (voterFailureTally.get(key) ?? 0) + 1);
}

/** Pair this cluster's dropouts with the outcome the survivors agreed on. */
export function recordVoterFailureOutcome(
  dropouts: ReadonlyArray<{ provider: string; kind: VoterFailureKind }>,
  outcome: string,
): void {
  for (const { provider, kind } of dropouts) {
    const key = `${provider}.${kind}.severity.${outcome}`;
    voterFailureTally.set(key, (voterFailureTally.get(key) ?? 0) + 1);
  }
}

export function voterFailureCounts(): Record<string, number> {
  return Object.fromEntries([...voterFailureTally.entries()].sort());
}

async function classifyOneEnsemble(
  cluster: ClusterToClassify,
): Promise<ClassifyOneResult | { category: "none" } | null> {
  const userContent = buildUserContent(cluster);
  const sourceHasIndirectInstruction = publisherTextHasIndirectInstruction({
    headline: cluster.title,
    description: cluster.body,
  });

  // --- Fan out one classify call per engine, in parallel ---
  // Dropouts are captured per cluster so they can be paired with the outcome
  // the surviving voters agree on (see recordVoterFailureOutcome).
  const dropouts: Array<{ provider: string; kind: VoterFailureKind }> = [];
  const settled = await Promise.allSettled(
    CLASSIFY_ENSEMBLE.map((cfg) =>
      runClassify(cfg, userContent, (kind) =>
        dropouts.push({ provider: cfg.provider, kind }),
      ),
    ),
  );

  const runs: EnsembleRun[] = [];
  const classifyRuns: ClassifierRun[] = [];
  settled.forEach((outcome, i) => {
    const cfg = CLASSIFY_ENSEMBLE[i];
    const result = outcome.status === "fulfilled" ? outcome.value : null;
    if (outcome.status === "rejected") {
      const message =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      const kind = voterFailureKind(message);
      recordVoterFailure(cfg.provider, kind);
      dropouts.push({ provider: cfg.provider, kind });
      console.error(
        `[classify] ensemble engine ${cfg.provider}/${cfg.model} rejected (${kind}):`,
        outcome.reason,
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
      transport: cfg.transport,
      ...runEvidence("classify"),
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
  if (runs.length === 0) {
    recordVoterFailureOutcome(dropouts, "panel_failed");
    return null;
  }

  const storedDerivation = deriveStoredEnsemble(classifyRuns);
  if (!storedDerivation.valid) {
    throw new Error(
      `Stored ensemble evidence is invalid: ${storedDerivation.reasons.join(", ")}`,
    );
  }
  const consensus = storedDerivation.consensus;

  // Majority "none" (or a plurality "none" deadlock resolving to none) means
  // the ensemble agrees this is not a governance event — drop the cluster.
  // (A deadlock among REAL categories returns category="none" too, but with
  // agreement "none"; those must NOT be silently dropped — they route to
  // review below.)
  if (consensus.category === "none" && consensus.agreement !== "none") {
    recordVoterFailureOutcome(dropouts, "none");
    return sourceHasIndirectInstruction ? null : { category: "none" };
  }

  // Deadlock / no quorum → straight to review, verify skipped.
  if (consensus.agreement === "none") {
    recordVoterFailureOutcome(dropouts, "deadlock");
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
      `[classify] cluster ${cluster.clusterId}: consensus category "${consensus.category}" not in taxonomy → review`,
    );
    recordVoterFailureOutcome(dropouts, "invalid_category");
    return buildEnsembleResult(
      cluster,
      normalizeInvalidConsensusForReview(consensus),
      classifyRuns,
      {
        verify: null,
        verifySkipped: true,
        forceReview: true,
      },
    );
  }
  // If the consensus tier isn't allowed for the category, snap to the nearest
  // allowed tier rather than dropping the whole (agreed-upon) event.
  const severityTier: SeverityTier = cat.allowedTiers.includes(
    consensus.severityTier,
  )
    ? consensus.severityTier
    : cat.allowedTiers[0];
  // The measurement that matters: pair this cluster's dropouts with the
  // severity the surviving voters agreed on.
  recordVoterFailureOutcome(dropouts, severityTier);
  const severityValue = clampSeverityToTier(
    consensus.severityValue,
    severityTier,
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
    {
      verify,
      verifySkipped: false,
      forceReview: false,
      dimension: cat.dimension,
    },
  );
}

/**
 * Assemble the final ClassifyOneResult for the ensemble path: append the
 * verify run to the audit trail and apply the published gate.
 *
 * Gate for the ensemble:
 *   - severity tier in HUMAN_REVIEW_TIERS   → review (unchanged invariant)
 *   - deadlock/no-quorum (forceReview)      → review, no auto-publish
 *   - verify refuted/low/failed AND weak consensus → review
 *   - otherwise (incl. a lone refuter against a unanimous or confident
 *     majority verdict)                      → auto-publish
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
  },
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
  const allClassifierRuns: ClassifierRun[] = [...classifyRuns];
  if (!opts.verifySkipped) {
    allClassifierRuns.push({
      run: VERIFY_RUN_ORDINAL,
      temp: 0,
      provider: VERIFY_CONFIG.provider,
      model: VERIFY_CONFIG.model,
      transport: VERIFY_CONFIG.transport,
      ...runEvidence("verify"),
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

  // LOOSENED GATE (owner decision 2026-07-05): the adversarial verifier is a
  // signal, not a veto. A refuted or low-confidence verify routes to review
  // only when the consensus itself is weak — a bare majority with low
  // self-confidence, or a degraded run (an engine dropped out). Unanimous
  // verdicts and confident majorities publish over a lone refuter. The
  // severe-tier human gate stays absolute (published methodology promise),
  // as do deadlock/no-quorum routes.
  const requiresReview = ensembleRequiresReview(consensus, verify, {
    forceReview:
      opts.forceReview ||
      !classifierRunsHaveRetainedSourceEvidence(
        cluster,
        consensus.category,
        classifyRuns,
      ),
    verifySkipped: opts.verifySkipped,
  });

  return {
    classified,
    // PUL-036: subscription-agent classifications always queue for human
    // review — the subscription-cli transport can never auto-publish.
    autoPublished: !requiresReview && !subscriptionTransportActive(),
    verification: verify,
  };
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
  userContent: string,
  onFailure?: (kind: VoterFailureKind) => void,
): Promise<ClassifyResultLite | null> {
  let response;
  try {
    response = await callClassifier(
      config,
      {
        system: SYSTEM_PROMPT,
        user: userContent,
        maxTokens: 800,
        expectJson: true,
      },
      {},
      "pulse-classify",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const kind = voterFailureKind(message);
    recordVoterFailure(config.provider, kind);
    onFailure?.(kind);
    console.warn(
      `[pulse-classify] provider_call_failed ${config.provider}/${config.model} (${kind}): ${message.slice(0, 200)}`,
    );
    return null;
  }
  const parsed = parseClassify(response.text);
  if (!parsed) {
    recordVoterFailure(config.provider, "parse");
    onFailure?.("parse");
    console.warn(
      `[pulse-classify] provider_parse_failed ${config.provider}/${config.model}`,
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
  },
): Promise<VerifyResultLite | null> {
  const verifyContent = `${userContent}

FIRST-PASS CLASSIFICATION TO VERIFY:
- category: ${first.category} (dimension ${first.dimension})
- runner-up considered: ${first.runnerUp}
- severity: ${first.severityTier} (${first.severityValue})
- rationale: ${first.rationale}`;
  let response;
  try {
    response = await callClassifier(
      config,
      {
        system: VERIFY_SYSTEM_PROMPT,
        user: verifyContent,
        maxTokens: 500,
        expectJson: true,
      },
      {},
      "pulse-verify",
    );
  } catch (err) {
    console.warn(
      `[pulse-verify] provider_call_failed ${config.provider}/${config.model}: ${
        err instanceof Error ? err.message.slice(0, 200) : String(err)
      }`,
    );
    return null;
  }
  const parsed = parseVerify(response.text);
  if (!parsed) {
    console.warn("[pulse-verify] provider_parse_failed");
    return null;
  }
  return parsed;
}

export function buildUserContent(cluster: ClusterToClassify): string {
  const sourcesLine = cluster.sourceIds.join(", ");
  return `TRUSTED PIPELINE METADATA
Provisional ingest jurisdiction id (do not treat as subject-country evidence): ${cluster.jurisdictionId}
Event date: ${cluster.eventDate}
Sources: ${sourcesLine}

${renderUntrustedPublisherEvidence({
  headline: cluster.title,
  description: cluster.body,
})}`;
}

function runEvidenceQuote(run: ClassifierRun): string | null {
  try {
    const parsed = JSON.parse(run.raw) as {
      evidenceQuote?: unknown;
      evidence_quote?: unknown;
    };
    const quote = parsed.evidenceQuote ?? parsed.evidence_quote;
    return typeof quote === "string" ? quote : null;
  } catch {
    return null;
  }
}

/** Deterministic source binding required for any automatic classification. */
export function classifierRunsHaveRetainedSourceEvidence(
  cluster: ClusterToClassify,
  category: string,
  runs: readonly ClassifierRun[],
): boolean {
  const evidence = { headline: cluster.title, description: cluster.body };
  if (publisherTextHasIndirectInstruction(evidence)) return false;
  const supportingRuns = runs.filter(
    (run) => run.role === "classify" && run.category === category,
  );
  return (
    supportingRuns.length > 0 &&
    supportingRuns.every((run) => {
      const quote = runEvidenceQuote(run);
      return (
        quote !== null &&
        retainedEvidenceQuoteMatches({
          evidence,
          quote,
          refs: ["headline", "description"],
        })
      );
    })
  );
}

/** Final fail-closed guard immediately before automatic publication. */
export function automaticPublicationHasRetainedEvidence(
  cluster: ClusterToClassify,
  result: ClassifyOneResult,
): boolean {
  return (
    classifierRunsHaveRetainedSourceEvidence(
      cluster,
      result.classified.category,
      result.classified.classifierRuns,
    ) &&
    subjectAttributionSupportsAutomaticPublication(
      result.subjectAttribution,
      {
        headline: result.classified.headline,
        description: result.classified.description,
      },
    )
  );
}

export interface LoadClassificationClustersOptions {
  /** Exact frozen cluster membership for a deterministic retry. */
  clusterIds?: readonly string[];
  /** Exact frozen raw membership; later reports in the same cluster stay out. */
  rawEventIds?: readonly string[];
  /** Reconstruct settled members too so the full run fingerprint can be checked. */
  includeSettled?: boolean;
  /** Stable replacement for source rows whose publisher date is absent. */
  fallbackEventDate?: string;
  /** Evaluation instant for due-retry membership. */
  eligibilityNow?: Date;
}

function uuidMembership(
  column: ReturnType<typeof sql>,
  values: readonly string[] | undefined,
) {
  if (!values) return sql`true`;
  if (values.length === 0) return sql`false`;
  return sql`${column} IN (${sql.join(
    values.map((value) => sql`${value}::uuid`),
    sql`, `,
  )})`;
}

export async function loadUnclassifiedClusters(
  db: Db,
  limit: number,
  configHash = CURRENT_CLASSIFICATION_CONFIG_HASH,
  options: LoadClassificationClustersOptions = {},
): Promise<ClusterToClassify[]> {
  const fallbackEventDate =
    options.fallbackEventDate ?? new Date().toISOString().slice(0, 10);
  const eligibilityNow = options.eligibilityNow ?? new Date();
  // Group only by event cluster. Members may carry different ingest-time
  // jurisdictions; a deterministic provisional value supports classification,
  // then the dedicated subject-country pass decides the event jurisdiction.
  const result = await db.execute(sql`
    SELECT
      r.cluster_id,
      (ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.incident_id ORDER BY r.incident_id), NULL))[1] AS incident_id,
      MIN(COALESCE(r.event_date, ${fallbackEventDate}::date)) AS event_date,
      ARRAY_REMOVE(ARRAY_AGG(r.jurisdiction_id ORDER BY r.id), NULL) AS jurisdiction_ids,
      ARRAY_AGG(r.id ORDER BY r.id) AS raw_event_ids,
      ARRAY_AGG(r.source_id ORDER BY r.id) AS source_ids,
      ARRAY_AGG(r.source_type ORDER BY r.id) AS source_types,
      ARRAY_AGG(r.source_url ORDER BY r.id) AS source_urls,
      ARRAY_AGG(DISTINCT r.cluster_run_id ORDER BY r.cluster_run_id) AS cluster_run_ids,
      (ARRAY_AGG(r.title ORDER BY r.id))[1] AS first_title,
      ARRAY_AGG(COALESCE(r.body, '') ORDER BY r.id) AS bodies,
      ARRAY_AGG(r.title ORDER BY r.id) AS titles
    FROM raw_events r
    LEFT JOIN pulse_cluster_classification_states cs
      ON cs.cluster_id = r.cluster_id
     AND cs.config_hash = ${configHash}
    WHERE r.cluster_id IS NOT NULL
      AND ${uuidMembership(sql`r.cluster_id`, options.clusterIds)}
      AND ${uuidMembership(sql`r.id`, options.rawEventIds)}
      AND ${
        options.includeSettled
          ? sql`true`
          : sql`r.classification_disposition = 'pending'
              AND (
                cs.id IS NULL OR
                (cs.status = 'retryable_failure' AND cs.next_retry_at <= ${eligibilityNow})
              )
              AND NOT EXISTS (
                SELECT 1 FROM pulse_sources ps
                WHERE ps.raw_event_id = r.id
              )`
      }
    GROUP BY r.cluster_id, cs.id, cs.status, cs.next_retry_at
    HAVING COUNT(r.jurisdiction_id) > 0
    ORDER BY
      CASE WHEN cs.id IS NULL THEN 0 ELSE 1 END,
      MIN(COALESCE(r.clustered_at, r.retrieved_at, r.created_at)),
      r.cluster_id
    LIMIT ${limit}
  `);

  const rows =
    (
      result as unknown as {
        rows?: Array<{
          cluster_id: string;
          incident_id: string | null;
          jurisdiction_ids: string[];
          event_date: string;
          raw_event_ids: string[];
          source_ids: string[];
          source_types: string[];
          source_urls: (string | null)[];
          cluster_run_ids: string[];
          first_title: string;
          bodies: string[];
          titles: string[];
        }>;
      }
    ).rows ??
    (result as unknown as Array<{
      cluster_id: string;
      incident_id: string | null;
      jurisdiction_ids: string[];
      event_date: string;
      raw_event_ids: string[];
      source_ids: string[];
      source_types: string[];
      source_urls: (string | null)[];
      cluster_run_ids: string[];
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
      incidentId: row.incident_id ?? undefined,
      jurisdictionId: selectProvisionalJurisdiction(row.jurisdiction_ids),
      eventDate: row.event_date,
      title: row.first_title,
      body: allText,
      rawEventIds: row.raw_event_ids,
      sourceIds: distinctSources,
      sourceTypes: distinctTypes,
      clusterRunIds: row.cluster_run_ids,
      attributions,
    };
  });
}

/** Most frequent non-null ingest guess; lexical tie-break keeps replay stable. */
export function selectProvisionalJurisdiction(
  jurisdictionIds: readonly string[],
): string {
  const counts = new Map<string, number>();
  for (const id of jurisdictionIds) {
    if (id.trim()) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const selected = [...counts.entries()].sort(
    ([leftId, leftCount], [rightId, rightCount]) =>
      rightCount - leftCount || leftId.localeCompare(rightId),
  )[0]?.[0];
  if (!selected)
    throw new Error(
      "Cluster has no provisional jurisdiction for subject attribution",
    );
  return selected;
}

function classifierActorFromRuns(
  runs: readonly ClassifierRun[],
): PulseDecisionActor {
  const classifiers = runs.filter((run) => {
    try {
      return (JSON.parse(run.raw) as { pass?: string }).pass === "classify";
    } catch {
      return run.run !== VERIFY_RUN_ORDINAL;
    }
  });
  const providers = [
    ...new Set(classifiers.map((run) => run.provider).filter(Boolean)),
  ];
  const models = [
    ...new Set(classifiers.map((run) => run.model).filter(Boolean)),
  ];
  return {
    type: "classifier",
    provider: providers.length === 1 ? String(providers[0]) : "multi_provider",
    model: models.length ? models.join(",") : null,
    reviewerId: null,
  };
}

function payloadForDecisionKind(
  kind:
    "event_existence" | "subject_attribution" | "category_labels" | "severity",
  result: ClassifyOneResult,
): PulseDecisionPayloads[typeof kind] {
  if (kind === "event_existence") return { disposition: "event" };
  if (kind === "subject_attribution") {
    return subjectAttributionDecisionPayload(result.subjectAttribution);
  }
  if (kind === "category_labels") {
    return {
      categoryIds: [result.classified.category],
      dimensionIds: [result.classified.dimension],
    };
  }
  return {
    tier: result.classified.severityTier,
    value: result.classified.severityValue,
    direction:
      result.classified.severityValue > 0
        ? "positive"
        : result.classified.severityValue < 0
          ? "negative"
          : "neutral",
  };
}

export function classificationDecisionInputs(input: {
  cluster: ClusterToClassify;
  eventId: string;
  result: ClassifyOneResult;
  runId: string;
  decidedAt: string;
}): PulseDecisionInput[] {
  const { cluster, eventId, result, runId, decidedAt } = input;
  const evidenceRefs = cluster.rawEventIds.map((id) => `raw-event:${id}`);
  const classifierActor = classifierActorFromRuns(
    result.classified.classifierRuns,
  );
  const classifierBase = {
    clusterId: cluster.clusterId,
    eventId,
    actor: classifierActor,
    stageRunId: runId,
    methodVersion: PULSE_RUNTIME_METHOD_VERSION,
    evidenceRefs,
    decidedAt,
  };
  const decisions: PulseDecisionInput[] = [
    {
      ...classifierBase,
      kind: "event_existence",
      verdict: "affirmed",
      payload: payloadForDecisionKind("event_existence", result),
      rationale:
        "Classifier panel admitted the cluster as a discrete governance event.",
    },
    {
      ...classifierBase,
      kind: "category_labels",
      verdict: "affirmed",
      payload: payloadForDecisionKind("category_labels", result),
      rationale: `Classifier panel selected ${result.classified.category} in ${result.classified.dimension}.`,
    },
    {
      ...classifierBase,
      kind: "severity",
      verdict: "affirmed",
      payload: payloadForDecisionKind("severity", result),
      rationale: `Classifier panel selected ${result.classified.severityTier} at ${result.classified.severityValue}.`,
    },
    {
      clusterId: cluster.clusterId,
      eventId,
      kind: "calibration",
      verdict: "unresolved",
      payload: {
        standing: "not_calibrated",
        signals: [
          "classifier_self_confidence",
          "classifier_agreement",
          ...(result.verification ? ["verifier_confidence"] : []),
          ...(result.subjectAttribution
            ? ["subject_attributor_confidence"]
            : []),
        ],
        targetDecisionKinds: [
          "event_existence",
          "subject_attribution",
          "category_labels",
          "severity",
          "publication",
        ],
        validationReleaseId: null,
      },
      actor: {
        type: "calibration_assessor",
        provider: null,
        model: null,
        reviewerId: null,
      },
      stageRunId: runId,
      methodVersion: PULSE_RUNTIME_METHOD_VERSION,
      rationale:
        "Available model confidence and agreement signals have not been calibrated against a representative labeled release.",
      evidenceRefs,
      decidedAt,
    },
    {
      clusterId: cluster.clusterId,
      eventId,
      kind: "subject_attribution",
      verdict: result.subjectAttribution?.primaryJurisdictionId
        ? "affirmed"
        : "unresolved",
      payload: payloadForDecisionKind("subject_attribution", result),
      actor: {
        type: "subject_attributor",
        provider: SUBJECT_ATTRIBUTION_PROVIDER,
        model: activeSubjectAttributionModel(),
        reviewerId: null,
      },
      stageRunId: runId,
      methodVersion: PULSE_RUNTIME_METHOD_VERSION,
      rationale:
        result.subjectAttribution?.rationale ??
        "Subject-country pass did not resolve a supported single jurisdiction; the provisional projection was retained.",
      evidenceRefs,
      decidedAt,
    },
    {
      clusterId: cluster.clusterId,
      eventId,
      kind: "publication",
      verdict: "affirmed",
      payload: {
        eligible: result.autoPublished,
        origin: result.autoPublished ? "auto" : "queued",
        gateReasons: [
          ...(result.autoPublished
            ? ["automatic_gate_passed"]
            : ["human_review_required"]),
          ...(!result.subjectAttribution?.primaryJurisdictionId
            ? ["subject_attribution_unresolved"]
            : []),
        ],
      },
      actor: {
        type: "publication_gate",
        provider: null,
        model: null,
        reviewerId: null,
      },
      stageRunId: runId,
      methodVersion: PULSE_RUNTIME_METHOD_VERSION,
      rationale: result.autoPublished
        ? "The versioned publication gate admitted the event automatically."
        : "The versioned publication gate routed the event to human review.",
      evidenceRefs,
      decidedAt,
    },
  ];

  if (result.verification) {
    const verifierActor: PulseDecisionActor = {
      type: "verifier",
      provider: VERIFY_CONFIG.provider,
      model: VERIFY_CONFIG.model,
      reviewerId: null,
    };
    for (const review of reviewsFromVerifier(result.verification)) {
      decisions.push({
        clusterId: cluster.clusterId,
        eventId,
        kind: review.kind,
        verdict: review.verdict,
        payload: payloadForDecisionKind(review.kind, result),
        actor: verifierActor,
        stageRunId: runId,
        methodVersion: PULSE_RUNTIME_METHOD_VERSION,
        rationale: review.rationale,
        evidenceRefs,
        decidedAt,
      });
    }
  }
  return decisions;
}

export function nonEventDecisionInputs(
  cluster: ClusterToClassify,
  runId: string,
  override: {
    actor?: PulseDecisionActor;
    rationale?: string;
    decidedAt?: string;
  } = {},
): PulseDecisionInput[] {
  return [
    {
      clusterId: cluster.clusterId,
      eventId: null,
      kind: "event_existence",
      verdict: "refuted",
      payload: { disposition: "non_event" },
      actor:
        override.actor ??
        ({
          type: "classifier",
          provider: IS_ENSEMBLE ? "multi_provider" : CLASSIFY_CONFIG.provider,
          model: CLASSIFY_ENSEMBLE.map(({ model }) => model).join(","),
          reviewerId: null,
        } satisfies PulseDecisionActor),
      stageRunId: runId,
      methodVersion: PULSE_RUNTIME_METHOD_VERSION,
      rationale:
        override.rationale ??
        "Classifier panel found no qualifying governance event.",
      evidenceRefs: cluster.rawEventIds.map((id) => `raw-event:${id}`),
      decidedAt: override.decidedAt ?? new Date().toISOString(),
    },
  ];
}

export async function persistNonEventDecision(
  db: Db,
  cluster: ClusterToClassify,
  runId: string,
  override: {
    actor?: PulseDecisionActor;
    rationale?: string;
    decidedAt?: string;
  } = {},
): Promise<void> {
  await persistPulseDecisions(
    db,
    nonEventDecisionInputs(cluster, runId, override),
  );
}

export async function writeNonEventCluster(
  db: Db,
  cluster: ClusterToClassify,
  classificationRunId: string,
  override: {
    actor?: PulseDecisionActor;
    rationale?: string;
    decidedAt?: string;
    decision?: unknown;
    reason?: string;
    claim?: ClaimedClassificationAttempt | null;
  } = {},
): Promise<void> {
  const completedAt = new Date().toISOString();
  const decidedAt =
    override.decidedAt ??
    override.claim?.startedAt.toISOString() ??
    completedAt;
  await publishNonGovernanceCluster(db, {
    clusterId: cluster.clusterId,
    decisions: nonEventDecisionInputs(cluster, classificationRunId, {
      actor: override.actor,
      rationale: override.rationale,
      decidedAt,
    }),
    disposition: {
      clusterId: cluster.clusterId,
      rawEventIds: cluster.rawEventIds,
      disposition: "non_governance",
      reason:
        override.reason ??
        "classifier determined this was not a governance event",
      decision: override.decision ?? { category: "none" },
      classificationRunId,
      completedAt,
    },
    settlement: override.claim
      ? {
          claim: override.claim,
          outcome: "none",
          modelCallCount: 1,
        }
      : undefined,
  });
}

export async function persistClassificationFailureDecision(
  db: Db,
  cluster: ClusterToClassify,
  runId: string,
  override: {
    actor?: PulseDecisionActor;
    rationale?: string;
    decidedAt?: string;
  } = {},
): Promise<void> {
  await persistPulseDecisions(db, [
    {
      clusterId: cluster.clusterId,
      eventId: null,
      kind: "event_existence",
      verdict: "unresolved",
      payload: { disposition: "insufficient_evidence" },
      actor:
        override.actor ??
        ({
          type: "classifier",
          provider: IS_ENSEMBLE ? "multi_provider" : CLASSIFY_CONFIG.provider,
          model: CLASSIFY_ENSEMBLE.map(({ model }) => model).join(","),
          reviewerId: null,
        } satisfies PulseDecisionActor),
      stageRunId: runId,
      methodVersion: PULSE_RUNTIME_METHOD_VERSION,
      rationale:
        override.rationale ??
        "No usable classifier result was produced; event existence remains unresolved.",
      evidenceRefs: cluster.rawEventIds.map((id) => `raw-event:${id}`),
      decidedAt: override.decidedAt ?? new Date().toISOString(),
    },
  ]);
}

export async function writeEvent(
  db: Db,
  cluster: ClusterToClassify,
  result: ClassifyOneResult,
  classificationRunId: string,
  claim?: ClaimedClassificationAttempt | null,
): Promise<string | null> {
  const storedDerivation = deriveStoredEnsemble(
    result.classified.classifierRuns,
  );
  if (
    result.classified.classifierAgreement !==
    storedDerivation.consensus.agreement
  ) {
    throw new Error(
      `Classifier agreement must be derived from stored independent runs; received ${result.classified.classifierAgreement}, derived ${storedDerivation.consensus.agreement}.`,
    );
  }
  const verifyStored = result.classified.classifierRuns.some(
    (run) => run.role === "verify",
  );
  const gateRequiresReview = ensembleRequiresReview(
    storedDerivation.consensus,
    result.verification,
    { forceReview: false, verifySkipped: !verifyStored },
  );
  if (
    result.autoPublished &&
    (!storedRunsPermitAutomaticPublication(result.classified.classifierRuns) ||
      gateRequiresReview ||
      !automaticPublicationHasRetainedEvidence(cluster, result))
  ) {
    throw new Error(
      "Automatic publication requires stored provider-distinct versioned votes, the publication gate, and deterministic retained-source evidence for classification and subject attribution.",
    );
  }
  // Initial corroborationConfidence — provisional. Phase 5.7's
  // corroborate.ts can recompute. For now use a baseline based on
  // agreement and the LLM's averaged self-confidence.
  const provisionalConfidence =
    result.classified.classifierAgreement === "all"
      ? 0.85
      : result.classified.classifierAgreement === "two_of_three"
        ? 0.65
        : 0.4;
  const versions = pulseEventVersionEnvelope(cluster.sourceIds);
  const existingEventId = await loadEventIdForCluster(db, cluster.clusterId);
  const eventId = existingEventId ?? randomUUID();
  const completedAt = new Date().toISOString();
  const decidedAt = claim?.startedAt.toISOString() ?? completedAt;

  await publishClassifiedCluster(db, {
    event: {
      id: eventId,
      clusterId: cluster.clusterId,
      incidentId: cluster.incidentId ?? cluster.clusterId,
      projectionStatus: "current",
      jurisdictionId: result.classified.jurisdictionId,
      eventDate: result.classified.eventDate,
      category: result.classified.category,
      dimension: result.classified.dimension,
      severityTier: result.classified.severityTier,
      severityValue: result.classified.severityValue,
      corroborationConfidence: provisionalConfidence,
      classifierRuns: result.classified.classifierRuns,
      classifierAgreement: result.classified.classifierAgreement,
      derivationVersionKey: versions.key,
      derivationVersions: versions.envelope,
      classificationRunId,
      publicationRunId: result.autoPublished ? classificationRunId : null,
      reviewStatus: result.autoPublished ? "approved" : "pending",
      published: result.autoPublished,
      headline: result.classified.headline,
      description: result.classified.description,
    },
    decisions: classificationDecisionInputs({
      cluster,
      eventId,
      result,
      runId: classificationRunId,
      decidedAt,
    }),
    attributions: cluster.attributions,
    disposition: {
      clusterId: cluster.clusterId,
      rawEventIds: cluster.rawEventIds,
      disposition: "event",
      reason: "classification admitted as a Pulse event",
      decision: result.classified,
      classificationRunId,
      completedAt,
    },
    settlement: claim
      ? {
          claim,
          outcome: "classified",
          modelCallCount: 1,
        }
      : undefined,
  });

  // NOTE: freshness is stamped ONLY at ingest time (upsert.ts), gated on
  // rows actually written. The classifier pass performs no upstream fetch,
  // so it must NOT advance sources.last_sync_at — doing so overstates how
  // fresh the underlying source data is (a load-bearing provenance signal).
  return eventId;
}

async function loadEventIdForCluster(
  db: Db,
  clusterId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: pulseEventsV2.id })
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.clusterId, clusterId))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function markClusterDisposition(
  db: Db,
  clusterId: string,
  input: {
    disposition: "event" | "non_governance" | "invalid";
    reason: string;
    decision: unknown;
  },
  classificationRunId: string,
): Promise<number> {
  const rows = await db
    .update(rawEvents)
    .set({
      classificationDisposition: input.disposition,
      classificationReason: input.reason,
      classificationDecision: input.decision,
      classifiedAt: new Date(),
      classificationRunId,
    })
    .where(eq(rawEvents.clusterId, clusterId))
    .returning({ id: rawEvents.id });
  return rows.length;
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
