import {
  derivationVersionErrors,
  derivationVersionKey,
  sourceBasketVersion,
  type DerivationVersionEnvelope,
} from "@/lib/research/derivation-version";
import {
  PULSE_PIPELINE_VERSION,
  pulseStageLegacyJsonVersionKey,
  pulseStageVersionErrors,
  pulseStageVersionKey,
  type PulseStageVersionEnvelope,
} from "@/lib/pulse/v2/pipeline-version";
import {
  PULSE_RUNTIME_METHOD_VERSION,
  PULSE_TAXONOMY_VERSION,
} from "@/lib/pulse/v2/runtime-contract";
import {
  PULSE_CLASSIFIER_PROMPT_VERSION,
  PULSE_DELTA_ALGORITHM_VERSION,
} from "@/lib/pulse/v2/versioning";
import { PULSE_DIMENSIONS, type PulseDimension } from "@/lib/pulse/v2/types";

export const PULSE_SCORE_PUBLICATION_SCHEMA =
  "pulse-score-publication/v1" as const;

/** The retained 2026-07-12 r2.15 publication used the exact v2.4 decay
 * serialization. It remains readable as historical evidence, but no new
 * stable-key release may use it after PUL-027 advanced the lifecycle. */
const LEGACY_PULSE_SCORE_ALGORITHM_VERSION =
  "pulse-delta/decay-window-v2.4+incident-resolution-v1+output-history-v1+absorption-evidence-v1";

/**
 * Public component-level freshness contract for the country-dimensions API.
 * The score rows and their contributing IDs are immutable release data. Event
 * prose and numeric evidence qualifiers are deliberately current context: the
 * retained score row does not contain a byte-for-byte event snapshot. The
 * reader therefore checks only the stable linkage fields it can prove (event
 * ID, jurisdiction, dimension, and source basket) and labels every other event
 * detail as live instead of implying that it was frozen with the score.
 */
export const PULSE_DIMENSIONS_PUBLICATION_COMPONENTS = {
  dimensionalScores: "frozen_score_publication",
  contributingEventIds: "frozen_score_publication",
  derivationLineage: "frozen_explicit_current_or_legacy_input_lineage",
  drivingEventDetails: "live_context",
  evidenceQualifiers: "live_context",
  scoreEvidenceLinkage:
    "live_context_id_jurisdiction_dimension_sources_checked",
  jurisdictionIdentity: "live_context",
  observability: "live_context",
  informationEnvironment: "live_context",
} as const;

export class PulseReleaseConsistencyError extends Error {
  readonly code = "RELEASE_INCONSISTENT" as const;

  constructor(message: string) {
    super(message);
    this.name = "PulseReleaseConsistencyError";
  }
}

export function isPulseReleaseConsistencyError(
  value: unknown,
): value is PulseReleaseConsistencyError {
  return value instanceof PulseReleaseConsistencyError;
}

export interface PulsePublicationPointerRow {
  product: string;
  computationRunId: string;
  versionKey: string;
  scoreAsOf: string;
  publishedAt: Date | string;
  runStatus: string;
  runStage: string;
  runVersionKey: string;
  runVersions: PulseStageVersionEnvelope;
  runCompletedAt: Date | string | null;
}

export interface PulsePublishedDeltaContractRow {
  schemaVersion: string;
  jurisdictionId: string;
  dimension: string;
  computationRunId: string;
  scoreAsOf: string;
  contributingEventIds: readonly string[];
  derivationVersionKey: string;
  derivationVersions: DerivationVersionEnvelope;
}

export interface PulsePublishedEvidenceContractRow {
  id: string;
  jurisdictionId: string;
  dimension: string;
  sourceIds: readonly string[];
  /** Mutable descriptive context, explicitly labeled live in API metadata. */
  headline: string;
  eventDate: string;
  severityTier: string;
  severityValue: number;
  corroborationConfidence: number | null;
}

export type PulseDerivationLineageStatus =
  | "current_versioned"
  | "legacy_input_lineage";

export interface PulseScorePublicationLineageCoverage {
  schemaVersion: "pulse-score-lineage-coverage/v1";
  state:
    | "current_versioned_only"
    | "mixed_current_and_legacy_input_lineage"
    | "legacy_input_lineage_only";
  totalRows: number;
  totalJurisdictions: number;
  currentVersionedRows: number;
  legacyInputLineageRows: number;
  legacyInputLineageJurisdictions: number;
}

export interface PulseScorePublicationPointerIdentity {
  schemaVersion: typeof PULSE_SCORE_PUBLICATION_SCHEMA;
  product: "pulse_dimensions";
  scoreAsOf: string;
  publishedAt: string;
  completedAt: string;
  versionIdentity: {
    runId: string;
    versionKey: string;
    versionKeySerialization:
      | "stable_json_v1"
      | "legacy_insertion_order_json_v1";
    versions: PulseStageVersionEnvelope;
  };
}

export interface PulseScorePublicationIdentity
  extends PulseScorePublicationPointerIdentity {
  lineageCoverage: PulseScorePublicationLineageCoverage;
}

function timestampIso(value: Date | string, label: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PulseReleaseConsistencyError(
      `Pulse publication has an invalid ${label}`,
    );
  }
  return parsed.toISOString();
}

function exactVersionId(
  envelope: DerivationVersionEnvelope,
  axis: "methodology" | "algorithm" | "prompt" | "taxonomy",
  expected: string,
): string | null {
  const ref = envelope[axis];
  return ref.state === "versioned" && ref.id === expected
    ? null
    : `${axis} must be ${expected}`;
}

/**
 * Validate the one score-stage run chosen by the publication pointer. Readers
 * call this before loading any dimensional rows, so a missing or torn pointer
 * fails closed instead of falling through to the mutable projection table.
 */
export function assertPulseScorePublication(
  row: PulsePublicationPointerRow | null | undefined,
): PulseScorePublicationPointerIdentity {
  if (!row) {
    throw new PulseReleaseConsistencyError(
      "Pulse has no complete published score run",
    );
  }

  const errors: string[] = [];
  if (row.product !== "pulse_dimensions") errors.push("product is unsupported");
  if (row.runStatus !== "completed") errors.push("score run is not completed");
  if (row.runStage !== "score") errors.push("published run is not a score run");
  if (row.versionKey !== row.runVersionKey) {
    errors.push("pointer and score-run version keys differ");
  }
  errors.push(...pulseStageVersionErrors(row.runVersions));
  for (const [axis, expected] of [
    ["methodology", PULSE_RUNTIME_METHOD_VERSION],
    ["ontology", PULSE_TAXONOMY_VERSION],
    ["pipeline", PULSE_PIPELINE_VERSION],
  ] as const) {
    const ref = row.runVersions[axis];
    if (ref.state !== "versioned" || ref.id !== expected) {
      errors.push(`score-run ${axis} must be ${expected}`);
    }
  }
  const algorithm = row.runVersions.algorithm;
  const historicAlgorithm =
    algorithm.state === "versioned" &&
    algorithm.id === LEGACY_PULSE_SCORE_ALGORITHM_VERSION;
  if (
    algorithm.state !== "versioned" ||
    (algorithm.id !== PULSE_DELTA_ALGORITHM_VERSION && !historicAlgorithm)
  ) {
    errors.push(
      `score-run algorithm must be ${PULSE_DELTA_ALGORITHM_VERSION}`,
    );
  }
  if (row.runVersions.prompt.state !== "not_applicable") {
    errors.push("score-run prompt must be not applicable");
  }
  if (row.runVersions.models.length !== 0) {
    errors.push("score run cannot claim model execution");
  }
  try {
    const expectedBasket = sourceBasketVersion(row.runVersions.sourceIds).id;
    if (
      row.runVersions.sourceBasket.state !== "versioned" ||
      row.runVersions.sourceBasket.id !== expectedBasket
    ) {
      errors.push("score-run source basket does not match its source IDs");
    }
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "invalid score-run source basket",
    );
  }
  let versionKeySerialization:
    | "stable_json_v1"
    | "legacy_insertion_order_json_v1" = "stable_json_v1";
  try {
    const stableKey = pulseStageVersionKey(row.runVersions);
    const legacyKey = pulseStageLegacyJsonVersionKey(row.runVersions);
    if (stableKey === row.versionKey) {
      versionKeySerialization = "stable_json_v1";
    } else if (legacyKey === row.versionKey) {
      versionKeySerialization = "legacy_insertion_order_json_v1";
    } else {
      errors.push("score-run version envelope does not match its key");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "invalid run envelope");
  }
  if (historicAlgorithm && versionKeySerialization !== "legacy_insertion_order_json_v1") {
    errors.push("historical score-run algorithm must use legacy serialization");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.scoreAsOf)) {
    errors.push("scoreAsOf is not an ISO date");
  }
  if (!row.runCompletedAt) errors.push("score run has no completion time");

  if (errors.length) {
    throw new PulseReleaseConsistencyError(
      `Pulse published score pointer is inconsistent: ${errors.join("; ")}`,
    );
  }

  const publishedAt = timestampIso(row.publishedAt, "publication time");
  const completedAt = timestampIso(
    row.runCompletedAt as Date | string,
    "completion time",
  );
  if (publishedAt < completedAt) {
    throw new PulseReleaseConsistencyError(
      "Pulse publication predates score-run completion",
    );
  }

  return {
    schemaVersion: PULSE_SCORE_PUBLICATION_SCHEMA,
    product: "pulse_dimensions",
    scoreAsOf: row.scoreAsOf,
    publishedAt,
    completedAt,
    versionIdentity: {
      runId: row.computationRunId,
      versionKey: row.versionKey,
      versionKeySerialization,
      versions: row.runVersions,
    },
  };
}

/**
 * A jurisdiction is either absent from a run (zero rows) or has the complete
 * five-dimension panel. Partial panels, mixed run ids, and method/source
 * envelope drift are release failures rather than missing data.
 */
export function assertPulsePublishedDeltaRows(
  publication: PulseScorePublicationPointerIdentity,
  rows: readonly PulsePublishedDeltaContractRow[],
): void {
  if (rows.length === 0) return;

  const errors: string[] = [];
  const dimensions = new Set<string>();
  for (const row of rows) {
    if (row.schemaVersion !== "pulse-dimensional-delta-history/v1") {
      errors.push(`${row.dimension}: invalid history schema`);
    }
    if (!PULSE_DIMENSIONS.includes(row.dimension as PulseDimension)) {
      errors.push(`${row.dimension}: unsupported dimension`);
    }
    if (dimensions.has(row.dimension)) {
      errors.push(`${row.dimension}: duplicate dimension`);
    }
    dimensions.add(row.dimension);
    if (row.computationRunId !== publication.versionIdentity.runId) {
      errors.push(`${row.dimension}: row belongs to another score run`);
    }
    if (row.scoreAsOf !== publication.scoreAsOf) {
      errors.push(`${row.dimension}: row uses another score date`);
    }
    const runSourceIds = new Set(publication.versionIdentity.versions.sourceIds);
    for (const sourceId of row.derivationVersions.sourceIds) {
      if (!runSourceIds.has(sourceId)) {
        errors.push(
          `${row.dimension}: row source ${sourceId} is absent from the score run`,
        );
      }
    }
    const runInputIds = publication.versionIdentity.versions.inputIds;
    if (runInputIds) {
      if (!runInputIds.includes(`jurisdiction:${row.jurisdictionId}`)) {
        errors.push(`${row.dimension}: jurisdiction is absent from score-run inputs`);
      }
      for (const eventId of row.contributingEventIds) {
        if (!runInputIds.includes(`event:${eventId}`)) {
          errors.push(`${row.dimension}: event ${eventId} is absent from score-run inputs`);
        }
      }
    }
    const versionErrors = derivationVersionErrors(row.derivationVersions, {
      allowLegacy: true,
    });
    errors.push(
      ...versionErrors.map((error) => `${row.dimension}: ${error}`),
    );
    try {
      if (derivationVersionKey(row.derivationVersions) !== row.derivationVersionKey) {
        errors.push(`${row.dimension}: derivation envelope does not match its key`);
      }
    } catch (error) {
      errors.push(
        `${row.dimension}: ${
          error instanceof Error ? error.message : "invalid derivation envelope"
        }`,
      );
    }
    for (const error of deltaLineageErrors(row)) {
      if (error) errors.push(`${row.dimension}: ${error}`);
    }
  }

  for (const dimension of PULSE_DIMENSIONS) {
    if (!dimensions.has(dimension)) errors.push(`${dimension}: row is missing`);
  }
  if (rows.length !== PULSE_DIMENSIONS.length) {
    errors.push(
      `expected ${PULSE_DIMENSIONS.length} dimensional rows, received ${rows.length}`,
    );
  }

  if (errors.length) {
    throw new PulseReleaseConsistencyError(
      `Pulse published score rows are inconsistent: ${errors.join("; ")}`,
    );
  }
}

const LEGACY_INPUT_REASONS = {
  methodology:
    "At least one contributing Pulse event lacks a recorded methodology version.",
  prompt:
    "At least one contributing Pulse event lacks a recorded prompt version.",
  taxonomy:
    "At least one contributing Pulse event lacks a recorded taxonomy version.",
} as const;

const ZERO_INPUT_REASONS = {
  prompt: "No event-level prompt contributes to this zero delta row.",
  taxonomy: "No event-level taxonomy contributes to this zero delta row.",
  sourceBasket: "No published event contributes to this zero delta row.",
} as const;

function lineageAxisError(
  envelope: DerivationVersionEnvelope,
  axis: "methodology" | "prompt" | "taxonomy",
  expectedCurrent: string,
): string | null {
  const ref = envelope[axis];
  if (ref.state === "versioned" && ref.id === expectedCurrent) return null;
  if (
    ref.state === "legacy_unversioned" &&
    ref.reason === LEGACY_INPUT_REASONS[axis]
  ) {
    return null;
  }
  return `${axis} must be ${expectedCurrent} or the closed legacy-input state`;
}

function deltaLineageErrors(
  row: PulsePublishedDeltaContractRow,
): string[] {
  const envelope = row.derivationVersions;
  const errors: Array<string | null> = [
    exactVersionId(envelope, "algorithm", PULSE_DELTA_ALGORITHM_VERSION),
  ];
  if (row.contributingEventIds.length) {
    errors.push(
      lineageAxisError(
        envelope,
        "methodology",
        PULSE_RUNTIME_METHOD_VERSION,
      ),
      lineageAxisError(envelope, "prompt", PULSE_CLASSIFIER_PROMPT_VERSION),
      lineageAxisError(envelope, "taxonomy", PULSE_TAXONOMY_VERSION),
    );
    try {
      const expectedBasket = sourceBasketVersion(envelope.sourceIds).id;
      if (
        envelope.sourceBasket.state !== "versioned" ||
        envelope.sourceBasket.id !== expectedBasket
      ) {
        errors.push("source basket does not match its source IDs");
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "invalid source basket",
      );
    }
  } else {
    errors.push(
      exactVersionId(envelope, "methodology", PULSE_RUNTIME_METHOD_VERSION),
    );
    for (const axis of ["prompt", "taxonomy"] as const) {
      const ref = envelope[axis];
      if (
        ref.state !== "not_applicable" ||
        ref.reason !== ZERO_INPUT_REASONS[axis]
      ) {
        errors.push(`${axis} has invalid zero-input lineage`);
      }
    }
    if (envelope.sourceIds.length !== 0) {
      errors.push("zero-input row cannot name source IDs");
    }
    if (
      envelope.sourceBasket.state !== "not_applicable" ||
      envelope.sourceBasket.reason !== ZERO_INPUT_REASONS.sourceBasket
    ) {
      errors.push("source basket has invalid zero-input lineage");
    }
  }
  return errors.filter((error): error is string => error !== null);
}

export function pulsePublishedDeltaLineageStatus(
  row: PulsePublishedDeltaContractRow,
): PulseDerivationLineageStatus {
  return (["methodology", "prompt", "taxonomy"] as const).some(
    (axis) => row.derivationVersions[axis].state === "legacy_unversioned",
  )
    ? "legacy_input_lineage"
    : "current_versioned";
}

export function withPulsePublicationLineageCoverage(
  publication: PulseScorePublicationPointerIdentity,
  rows: readonly PulsePublishedDeltaContractRow[],
): PulseScorePublicationIdentity {
  if (!rows.length) {
    throw new PulseReleaseConsistencyError(
      "Pulse published score run contains no dimensional rows",
    );
  }
  const jurisdictionIds = new Set(rows.map((row) => row.jurisdictionId));
  const expectedJurisdictionIds = new Set(
    (publication.versionIdentity.versions.inputIds ?? [])
      .filter((id) => id.startsWith("jurisdiction:"))
      .map((id) => id.slice("jurisdiction:".length)),
  );
  if (expectedJurisdictionIds.size > 0) {
    const missing = [...expectedJurisdictionIds].filter(
      (id) => !jurisdictionIds.has(id),
    );
    const unexpected = [...jurisdictionIds].filter(
      (id) => !expectedJurisdictionIds.has(id),
    );
    if (missing.length || unexpected.length) {
      throw new PulseReleaseConsistencyError(
        `Pulse published score run does not match its jurisdiction input snapshot: missing ${missing.length}; unexpected ${unexpected.length}`,
      );
    }
  }
  const legacyRows = rows.filter(
    (row) => pulsePublishedDeltaLineageStatus(row) === "legacy_input_lineage",
  );
  const legacyJurisdictions = new Set(
    legacyRows.map((row) => row.jurisdictionId),
  );
  const currentVersionedRows = rows.length - legacyRows.length;
  return {
    ...publication,
    lineageCoverage: {
      schemaVersion: "pulse-score-lineage-coverage/v1",
      state:
        legacyRows.length === 0
          ? "current_versioned_only"
          : currentVersionedRows === 0
            ? "legacy_input_lineage_only"
            : "mixed_current_and_legacy_input_lineage",
      totalRows: rows.length,
      totalJurisdictions: jurisdictionIds.size,
      currentVersionedRows,
      legacyInputLineageRows: legacyRows.length,
      legacyInputLineageJurisdictions: legacyJurisdictions.size,
    },
  };
}

/**
 * The mutable event projection is used only as descriptive evidence context.
 * Cross-check its stable linkage fields against each immutable score row.
 * Descriptive/numeric event details remain explicitly live API context.
 */
export function assertPulsePublishedEvidence(
  rows: readonly PulsePublishedDeltaContractRow[],
  evidence: readonly PulsePublishedEvidenceContractRow[],
): void {
  const byId = new Map(evidence.map((row) => [row.id, row]));
  const errors: string[] = [];
  for (const row of rows) {
    const expectedSourceIds = new Set<string>();
    for (const eventId of row.contributingEventIds) {
      const event = byId.get(eventId);
      if (!event) {
        errors.push(`${row.dimension}: missing event ${eventId}`);
        continue;
      }
      if (event.jurisdictionId !== row.jurisdictionId) {
        errors.push(`${row.dimension}: event ${eventId} changed jurisdiction`);
      }
      if (event.dimension !== row.dimension) {
        errors.push(`${row.dimension}: event ${eventId} changed dimension`);
      }
      for (const sourceId of event.sourceIds) expectedSourceIds.add(sourceId);
    }
    const stored = [...row.derivationVersions.sourceIds].sort();
    const observed = [...expectedSourceIds].sort();
    if (JSON.stringify(stored) !== JSON.stringify(observed)) {
      errors.push(`${row.dimension}: evidence source basket drifted`);
    }
  }
  if (errors.length) {
    throw new PulseReleaseConsistencyError(
      `Pulse published score evidence is inconsistent: ${errors.join("; ")}`,
    );
  }
}
