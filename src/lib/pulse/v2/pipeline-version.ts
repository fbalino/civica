import { createHash, randomUUID } from "node:crypto";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import { pulsePipelineRuns } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  legacyUnversioned,
  notApplicable,
  sourceBasketVersion,
  versioned,
  type VersionRef,
} from "@/lib/research/derivation-version";
import { stableStringify } from "@/lib/data/frozen-vintage";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "./event-ontology";
import { PULSE_EMBEDDING_MODEL } from "./embed";
import { PULSE_EVENT_IDENTITY_VERSION } from "./event-identity";
import { PULSE_INCIDENT_RESOLUTION_VERSION } from "./incident-resolution";
import {
  PULSE_REVIEW_SUMMARY_MODEL,
  PULSE_REVIEW_SUMMARY_PROVIDER,
} from "./summarize";
import {
  CURRENT_PULSE_RUNTIME_METHOD,
  PULSE_RUNTIME_METHOD_VERSION,
  PULSE_TAXONOMY_VERSION,
} from "./runtime-contract";
import {
  PULSE_CLASSIFIER_PROMPT_VERSION,
  PULSE_CLASSIFICATION_ALGORITHM_VERSION,
  PULSE_DELTA_ALGORITHM_VERSION,
} from "./versioning";

type Db = NeonHttpDatabase<typeof schema>;

export const PULSE_PIPELINE_VERSION =
  "pulse-pipeline/versioned-lineage-v1" as const;
export const PULSE_STAGE_VERSION_SCHEMA =
  "pulse-stage-version-envelope/v1" as const;

export const PULSE_PIPELINE_STAGES = [
  "ingest",
  "cluster",
  "classify",
  "corroborate",
  "review",
  "score",
] as const;
export type PulsePipelineStage = (typeof PULSE_PIPELINE_STAGES)[number];

export type PulseModelRole =
  | "connector"
  | "embedding"
  | "classify"
  | "verify"
  | "subject_attribution"
  | "review_summary";

export interface PulseModelVersionRef {
  role: PulseModelRole;
  provider: string;
  model: string;
}

export interface PulseStageVersionEnvelope {
  schemaVersion: typeof PULSE_STAGE_VERSION_SCHEMA;
  stage: PulsePipelineStage;
  methodology: VersionRef;
  /** Production labeling ontology. The adopted research v3 codebook remains
   * separate until the scheduled classifier is migrated. */
  ontology: VersionRef;
  pipeline: VersionRef;
  algorithm: VersionRef;
  prompt: VersionRef;
  sourceBasket: VersionRef;
  sourceIds: string[];
  models: PulseModelVersionRef[];
  upstreamRunIds: string[];
  /** Exact stage input/scope identities used to fence deterministic retries. */
  inputIds?: string[];
  /** Hash of the exact values admitted on the first deterministic attempt. */
  inputFingerprint?: string;
}

export interface PulsePipelineRunRef {
  id: string;
  versionKey: string;
  versions: PulseStageVersionEnvelope;
}

const activeSourceIds = () =>
  [...CURRENT_PULSE_RUNTIME_METHOD.feeds.observedEvidence.sourceIds].sort();

function stageAlgorithm(stage: PulsePipelineStage): VersionRef {
  if (stage === "ingest") return versioned("pulse-ingest/connectors-v2.1");
  if (stage === "cluster") {
    return versioned(
      `pulse-cluster/stable-incidents-v4+${PULSE_EVENT_IDENTITY_VERSION}+${PULSE_INCIDENT_RESOLUTION_VERSION}`,
    );
  }
  if (stage === "classify")
    return versioned(PULSE_CLASSIFICATION_ALGORITHM_VERSION);
  if (stage === "corroborate")
    return versioned("pulse-corroboration/evidence-family-v3");
  if (stage === "review") return versioned("pulse-review/human-decision-v1");
  return versioned(PULSE_DELTA_ALGORITHM_VERSION);
}

function stagePrompt(stage: PulsePipelineStage): VersionRef {
  if (stage === "classify") return versioned(PULSE_CLASSIFIER_PROMPT_VERSION);
  if (stage === "review") {
    return versioned("pulse-review-contract/review-validation-v1");
  }
  return notApplicable(
    `${stage} does not use a language-model decision prompt.`,
  );
}

function stageModels(stage: PulsePipelineStage): PulseModelVersionRef[] {
  if (stage === "cluster") {
    return [
      {
        role: "embedding",
        provider: "local_sentence_transformers",
        model: PULSE_EMBEDDING_MODEL,
      },
    ];
  }
  if (stage !== "classify") return [];
  const method = CURRENT_PULSE_RUNTIME_METHOD.providers;
  return [
    ...method.classify.engines.map(({ provider, model }) => ({
      role: "classify" as const,
      provider,
      model,
    })),
    {
      role: "verify" as const,
      provider: method.verify.engine.provider,
      model: method.verify.engine.model,
    },
    {
      role: "subject_attribution" as const,
      provider: method.subject.engine.provider,
      model: method.subject.engine.model,
    },
    {
      role: "review_summary" as const,
      provider: PULSE_REVIEW_SUMMARY_PROVIDER,
      model: PULSE_REVIEW_SUMMARY_MODEL,
    },
  ];
}

function canonicalizeEnvelope(
  envelope: PulseStageVersionEnvelope,
): PulseStageVersionEnvelope {
  return {
    ...envelope,
    sourceIds: [...new Set(envelope.sourceIds)].sort(),
    models: [...envelope.models].sort((left, right) =>
      `${left.role}:${left.provider}:${left.model}`.localeCompare(
        `${right.role}:${right.provider}:${right.model}`,
      ),
    ),
    upstreamRunIds: [...new Set(envelope.upstreamRunIds)].sort(),
    ...(envelope.inputIds
      ? { inputIds: [...new Set(envelope.inputIds)].sort() }
      : {}),
  };
}

export function pulseStageVersionErrors(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object")
    return ["stage envelope must be an object"];
  const envelope = value as Partial<PulseStageVersionEnvelope>;
  if (envelope.schemaVersion !== PULSE_STAGE_VERSION_SCHEMA) {
    errors.push(`schemaVersion must be ${PULSE_STAGE_VERSION_SCHEMA}`);
  }
  if (!PULSE_PIPELINE_STAGES.includes(envelope.stage as PulsePipelineStage)) {
    errors.push("stage is unsupported");
  }
  for (const axis of [
    "methodology",
    "ontology",
    "pipeline",
    "algorithm",
    "prompt",
    "sourceBasket",
  ] as const) {
    const ref = envelope[axis];
    if (!ref || typeof ref !== "object" || !("state" in ref)) {
      errors.push(`${axis} is missing`);
    } else if (ref.state === "versioned" && !ref.id.trim()) {
      errors.push(`${axis} has a blank version id`);
    } else if (
      (ref.state === "not_applicable" || ref.state === "legacy_unversioned") &&
      !ref.reason.trim()
    ) {
      errors.push(`${axis} has no reason`);
    }
  }
  if (!Array.isArray(envelope.sourceIds))
    errors.push("sourceIds must be an array");
  if (!Array.isArray(envelope.models)) errors.push("models must be an array");
  if (!Array.isArray(envelope.upstreamRunIds))
    errors.push("upstreamRunIds must be an array");
  if (envelope.inputIds && !Array.isArray(envelope.inputIds)) {
    errors.push("inputIds must be an array when present");
  }
  if (
    envelope.inputFingerprint &&
    !/^pulse-stage-input\/sha256:[a-f0-9]{64}$/.test(envelope.inputFingerprint)
  ) {
    errors.push("inputFingerprint has an invalid shape");
  }
  for (const model of envelope.models ?? []) {
    if (!model.role || !model.provider.trim() || !model.model.trim()) {
      errors.push("model references require role, provider, and model");
    }
  }
  if (
    envelope.sourceBasket?.state === "versioned" &&
    (envelope.sourceIds?.length ?? 0) === 0
  ) {
    errors.push("a versioned source basket requires source ids");
  }
  return errors;
}

export function pulseStageVersionKey(
  envelope: PulseStageVersionEnvelope,
): string {
  const canonical = canonicalizeEnvelope(envelope);
  const errors = pulseStageVersionErrors(canonical);
  if (errors.length) throw new Error(errors.join("; "));
  return `pulse-stage/sha256:${createHash("sha256")
    // PostgreSQL jsonb does not preserve object-key insertion order. Hash the
    // semantic value so a persisted envelope verifies after a jsonb round trip.
    .update(stableStringify(canonical))
    .digest("hex")}`;
}

export function buildPulseStageVersionEnvelope(
  stage: PulsePipelineStage,
  options: {
    sourceIds?: readonly string[];
    upstreamRunIds?: readonly string[];
    models?: readonly PulseModelVersionRef[];
    prompt?: VersionRef;
    algorithm?: VersionRef;
    inputIds?: readonly string[];
    inputFingerprint?: string;
  } = {},
): PulseStageVersionEnvelope {
  const sourceIds = [...(options.sourceIds ?? activeSourceIds())].sort();
  const basket = sourceBasketVersion(sourceIds);
  return canonicalizeEnvelope({
    schemaVersion: PULSE_STAGE_VERSION_SCHEMA,
    stage,
    methodology: versioned(PULSE_RUNTIME_METHOD_VERSION),
    ontology: versioned(PULSE_TAXONOMY_VERSION),
    pipeline: versioned(PULSE_PIPELINE_VERSION),
    algorithm: options.algorithm ?? stageAlgorithm(stage),
    prompt: options.prompt ?? stagePrompt(stage),
    sourceBasket: versioned(basket.id),
    sourceIds: basket.sourceIds,
    models: [...(options.models ?? stageModels(stage))],
    upstreamRunIds: [...(options.upstreamRunIds ?? [])],
    ...(options.inputIds ? { inputIds: [...options.inputIds] } : {}),
    ...(options.inputFingerprint
      ? { inputFingerprint: options.inputFingerprint }
      : {}),
  });
}

export function legacyPulseStageVersionEnvelope(
  stage: PulsePipelineStage,
): PulseStageVersionEnvelope {
  const reason = `Retained ${stage} history predates PUL-004 row-level pipeline-run versioning.`;
  return {
    schemaVersion: PULSE_STAGE_VERSION_SCHEMA,
    stage,
    methodology: legacyUnversioned(reason),
    ontology: legacyUnversioned(reason),
    pipeline: legacyUnversioned(reason),
    algorithm: legacyUnversioned(reason),
    prompt: legacyUnversioned(reason),
    sourceBasket: legacyUnversioned(reason),
    sourceIds: [],
    models: [],
    upstreamRunIds: [],
  };
}

export function createPulsePipelineRunRef(
  stage: PulsePipelineStage,
  options: {
    id?: string;
    sourceIds?: readonly string[];
    upstreamRunIds?: readonly string[];
    models?: readonly PulseModelVersionRef[];
    prompt?: VersionRef;
    algorithm?: VersionRef;
    inputIds?: readonly string[];
    inputFingerprint?: string;
  } = {},
): PulsePipelineRunRef {
  const versions = buildPulseStageVersionEnvelope(stage, options);
  return {
    id: options.id ?? randomUUID(),
    versionKey: pulseStageVersionKey(versions),
    versions,
  };
}

export function pulseStageInputFingerprint(value: unknown): string {
  return `pulse-stage-input/sha256:${createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")}`;
}

export interface PulsePipelineRunState {
  run: PulsePipelineRunRef;
  status: "running" | "completed" | "partial" | "failed" | "legacy";
  counts: Record<string, number>;
  startedAt: Date;
}

/** Read a deterministic run before touching mutable stage inputs. */
export async function loadPulsePipelineRunState(
  db: Db,
  runId: string,
  expectedStage: PulsePipelineStage,
): Promise<PulsePipelineRunState | null> {
  const rows = await db
    .select({
      stage: pulsePipelineRuns.stage,
      status: pulsePipelineRuns.status,
      versionKey: pulsePipelineRuns.versionKey,
      versions: pulsePipelineRuns.versions,
      counts: pulsePipelineRuns.counts,
      startedAt: pulsePipelineRuns.startedAt,
    })
    .from(pulsePipelineRuns)
    .where(eq(pulsePipelineRuns.id, runId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.stage !== expectedStage) {
    throw new Error(`Pulse pipeline run identity collision: ${runId}`);
  }
  return {
    run: { id: runId, versionKey: row.versionKey, versions: row.versions },
    status: row.status as PulsePipelineRunState["status"],
    counts: row.counts,
    startedAt: row.startedAt,
  };
}

/** Derive one RFC-4122-shaped UUID for a Pulse stage inside a logical cron
 * delivery. Retries of that delivery reuse the stage run; later schedule slots
 * and different manual idempotency keys derive different runs. */
export function pulseCronStageRunId(
  executionKey: string,
  stage: PulsePipelineStage,
): string {
  if (!/^[a-f0-9]{64}$/.test(executionKey)) {
    throw new Error("Pulse cron stage requires a valid execution key");
  }
  const bytes = createHash("sha256")
    .update("civica-pulse-cron-stage-run/v1\0")
    .update(executionKey)
    .update("\0")
    .update(stage)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type PreparedPulsePipelineRun =
  { state: "ready" } | { state: "completed"; counts: Record<string, number> };

/**
 * Start or resume a deterministic production stage run. A completed run is a
 * durable no-op on delivery retry. An atomic publish failure deliberately
 * leaves a deterministic run `running`, because the authoritative pipeline-run
 * guard forbids rewriting terminal evidence back to running.
 */
export async function preparePulsePipelineRun(
  db: Db,
  run: PulsePipelineRunRef,
): Promise<PreparedPulsePipelineRun> {
  const existing = await db
    .select({
      stage: pulsePipelineRuns.stage,
      status: pulsePipelineRuns.status,
      versionKey: pulsePipelineRuns.versionKey,
      counts: pulsePipelineRuns.counts,
    })
    .from(pulsePipelineRuns)
    .where(eq(pulsePipelineRuns.id, run.id))
    .limit(1);
  const row = existing[0];
  if (!row) {
    await startPulsePipelineRun(db, run);
    return { state: "ready" };
  }
  if (row.stage !== run.versions.stage || row.versionKey !== run.versionKey) {
    throw new Error(`Pulse pipeline run identity collision: ${run.id}`);
  }
  if (row.status === "completed") {
    return { state: "completed", counts: row.counts };
  }
  if (row.status !== "running") {
    throw new Error(
      `Terminal Pulse pipeline run cannot be resumed: ${run.id} (${row.status})`,
    );
  }
  return { state: "ready" };
}

export async function startPulsePipelineRun(
  db: Db,
  run: PulsePipelineRunRef,
  options: { startedAt?: Date } = {},
): Promise<void> {
  await db.insert(pulsePipelineRuns).values({
    id: run.id,
    stage: run.versions.stage,
    status: "running",
    versionKey: run.versionKey,
    versions: run.versions,
    startedAt: options.startedAt,
  });
}

export async function finishPulsePipelineRun(
  db: Db,
  runId: string,
  input: {
    status: "completed" | "partial" | "failed";
    counts: Record<string, number>;
    failures?: Array<{ component: string; message: string }>;
  },
): Promise<void> {
  await db
    .update(pulsePipelineRuns)
    .set({
      status: input.status,
      counts: input.counts,
      failures: input.failures ?? [],
      completedAt: new Date(),
    })
    .where(eq(pulsePipelineRuns.id, runId));
}

export interface PulseVersionSetSummary {
  state: "single_version" | "mixed_version" | "legacy_only" | "empty";
  versionKeys: string[];
  containsLegacy: boolean;
  comparableAsSingleSeries: boolean;
}

export function summarizePulseVersionSet(
  rows: ReadonlyArray<{
    versionKey: string;
    versions: PulseStageVersionEnvelope;
  }>,
): PulseVersionSetSummary {
  if (rows.length === 0) {
    return {
      state: "empty",
      versionKeys: [],
      containsLegacy: false,
      comparableAsSingleSeries: false,
    };
  }
  const versionKeys = [
    ...new Set(rows.map(({ versionKey }) => versionKey)),
  ].sort();
  const containsLegacy = rows.some(({ versions }) =>
    [
      versions.methodology,
      versions.ontology,
      versions.pipeline,
      versions.algorithm,
      versions.prompt,
      versions.sourceBasket,
    ].some((ref) => ref.state === "legacy_unversioned"),
  );
  const onlyLegacy =
    containsLegacy &&
    rows.every(
      ({ versions }) => versions.pipeline.state === "legacy_unversioned",
    );
  return {
    state: onlyLegacy
      ? "legacy_only"
      : versionKeys.length === 1 && !containsLegacy
        ? "single_version"
        : "mixed_version",
    versionKeys,
    containsLegacy,
    comparableAsSingleSeries: versionKeys.length === 1 && !containsLegacy,
  };
}

/** The adopted v3 research ontology is deliberately exported here so
 * validators can prove that scheduled rows still name v2 until migration. */
export const ADOPTED_PULSE_RESEARCH_ONTOLOGY_VERSION =
  PULSE_EVENT_ONTOLOGY_VERSION;
