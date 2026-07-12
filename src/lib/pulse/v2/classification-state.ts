import { createHash } from "node:crypto";

export const PULSE_CLASSIFICATION_STATE_VERSION =
  "pulse-classification-state/v1" as const;
export const PULSE_CLASSIFICATION_ATTEMPT_VERSION =
  "pulse-classification-attempt/v1" as const;
export const PULSE_CLASSIFICATION_CONFIG_VERSION =
  "pulse-classification-config/v1" as const;

export const PULSE_CLASSIFICATION_RETRY_POLICY = {
  maxAttempts: 3,
  initialDelayMs: 15 * 60 * 1000,
  multiplier: 4,
  maxDelayMs: 6 * 60 * 60 * 1000,
} as const satisfies ClassificationRetryPolicy;
export const PULSE_CLASSIFICATION_CLAIM_LEASE_MS = 30 * 60 * 1000;

export const PULSE_CLASSIFICATION_STATUSES = [
  "classified",
  "none",
  "retryable_failure",
  "terminal_failure",
] as const;

export type PulseClassificationStatus =
  (typeof PULSE_CLASSIFICATION_STATUSES)[number];

export interface ClassificationEngineRef {
  provider: string;
  model: string;
}

export interface ClassificationRetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  multiplier: number;
  maxDelayMs: number;
}

/**
 * Stable classification configuration. Callers must supply the engines they
 * actually resolved for this process, rather than copying runtime defaults.
 * Batch membership, sources, upstream runs, run ids, and secrets deliberately
 * have no place in this input.
 */
export interface ClassificationConfigInput {
  methodVersion: string;
  ontologyVersion: string;
  algorithmVersion: string;
  classifierPromptVersion: string;
  publicationGateVersion: string;
  classifyEngines: readonly ClassificationEngineRef[];
  verifyEngine: ClassificationEngineRef;
  subjectAttribution: ClassificationEngineRef & {
    attributionVersion: string;
    promptVersion: string;
  };
  decodeMode: string;
  thinkingMode: string;
  retryPolicy: ClassificationRetryPolicy;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} must not be blank`);
  return normalized;
}

function normalizedEngine(
  engine: ClassificationEngineRef,
  name: string,
): ClassificationEngineRef {
  return {
    provider: required(engine.provider, `${name}.provider`).toLowerCase(),
    model: required(engine.model, `${name}.model`),
  };
}

export function validateClassificationRetryPolicy(
  policy: ClassificationRetryPolicy,
): void {
  if (!Number.isSafeInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new Error("retryPolicy.maxAttempts must be a positive integer");
  }
  if (!Number.isFinite(policy.initialDelayMs) || policy.initialDelayMs < 0) {
    throw new Error("retryPolicy.initialDelayMs must be a non-negative number");
  }
  if (!Number.isFinite(policy.multiplier) || policy.multiplier < 1) {
    throw new Error("retryPolicy.multiplier must be at least one");
  }
  if (
    !Number.isFinite(policy.maxDelayMs) ||
    policy.maxDelayMs < policy.initialDelayMs
  ) {
    throw new Error(
      "retryPolicy.maxDelayMs must be finite and no smaller than initialDelayMs",
    );
  }
}

export function buildClassificationConfigHash(
  input: ClassificationConfigInput,
): string {
  validateClassificationRetryPolicy(input.retryPolicy);
  if (input.classifyEngines.length === 0) {
    throw new Error("classifyEngines must contain an actual resolved engine");
  }
  const classifyEngines = input.classifyEngines
    .map((engine, index) => normalizedEngine(engine, `classifyEngines[${index}]`))
    .sort((left, right) =>
      `${left.provider}:${left.model}`.localeCompare(
        `${right.provider}:${right.model}`,
      ),
    );
  if (
    new Set(classifyEngines.map(({ provider, model }) => `${provider}:${model}`))
      .size !== classifyEngines.length
  ) {
    throw new Error("classifyEngines must not contain duplicates");
  }
  const subject = normalizedEngine(
    input.subjectAttribution,
    "subjectAttribution",
  );
  const payload = {
    schemaVersion: PULSE_CLASSIFICATION_CONFIG_VERSION,
    methodVersion: required(input.methodVersion, "methodVersion"),
    ontologyVersion: required(input.ontologyVersion, "ontologyVersion"),
    algorithmVersion: required(input.algorithmVersion, "algorithmVersion"),
    classifierPromptVersion: required(
      input.classifierPromptVersion,
      "classifierPromptVersion",
    ),
    publicationGateVersion: required(
      input.publicationGateVersion,
      "publicationGateVersion",
    ),
    classifyEngines,
    verifyEngine: normalizedEngine(input.verifyEngine, "verifyEngine"),
    subjectAttribution: {
      ...subject,
      attributionVersion: required(
        input.subjectAttribution.attributionVersion,
        "subjectAttribution.attributionVersion",
      ),
      promptVersion: required(
        input.subjectAttribution.promptVersion,
        "subjectAttribution.promptVersion",
      ),
    },
    decodeMode: required(input.decodeMode, "decodeMode"),
    thinkingMode: required(input.thinkingMode, "thinkingMode"),
    retryPolicy: input.retryPolicy,
  };
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
  return `${PULSE_CLASSIFICATION_CONFIG_VERSION}/sha256:${digest}`;
}

export type ClassificationErrorCode =
  | "rate_limited"
  | "provider_unavailable"
  | "timeout"
  | "network_error"
  | "malformed_response"
  | "authentication_failed"
  | "invalid_request"
  | "invalid_input"
  | "configuration_error"
  | "unknown_failure";

export interface ClassificationError {
  code: ClassificationErrorCode;
  message: string;
  retryable: boolean;
  httpStatus: number | null;
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown; statusCode?: unknown }).status ??
    (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" && Number.isInteger(status) ? status : null;
}

export function sanitizeClassificationErrorMessage(value: unknown): string {
  const raw =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "Classification failed without a structured error.";
  return raw
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|key|token)-[A-Za-z0-9_-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 500);
}

export function classifyClassificationError(error: unknown): ClassificationError {
  const httpStatus = errorStatus(error);
  const message = sanitizeClassificationErrorMessage(error);
  const lower = message.toLowerCase();
  if (httpStatus === 429) return { code: "rate_limited", message, retryable: true, httpStatus };
  if (httpStatus !== null && httpStatus >= 500) {
    return { code: "provider_unavailable", message, retryable: true, httpStatus };
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return { code: "timeout", message, retryable: true, httpStatus };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return { code: "authentication_failed", message, retryable: false, httpStatus };
  }
  if (httpStatus !== null && [400, 404, 405, 409, 422].includes(httpStatus)) {
    return { code: "invalid_request", message, retryable: false, httpStatus };
  }
  if (/api key|credential|configuration|unsupported model/.test(lower)) {
    return { code: "configuration_error", message, retryable: false, httpStatus };
  }
  if (/malformed|parse|invalid json|empty response/.test(lower)) {
    return { code: "malformed_response", message, retryable: true, httpStatus };
  }
  if (
    error instanceof TypeError ||
    /econnreset|enotfound|fetch failed|network/.test(lower)
  ) {
    return { code: "network_error", message, retryable: true, httpStatus };
  }
  if (/invalid cluster|blank headline|missing attribution/.test(lower)) {
    return { code: "invalid_input", message, retryable: false, httpStatus };
  }
  return { code: "unknown_failure", message, retryable: true, httpStatus };
}

interface ClassificationStateBase {
  schemaVersion: typeof PULSE_CLASSIFICATION_STATE_VERSION;
  clusterId: string;
  configHash: string;
  attemptCount: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  lastRunId: string;
}

export interface ClassifiedClassificationState extends ClassificationStateBase {
  status: "classified";
  eventId: string;
  decisionKey: string;
  completedAt: string;
  nextRetryAt: null;
  lastError: null;
}

export interface NoneClassificationState extends ClassificationStateBase {
  status: "none";
  eventId: null;
  decisionKey: string;
  completedAt: string;
  nextRetryAt: null;
  lastError: null;
}

export interface RetryableFailureClassificationState
  extends ClassificationStateBase {
  status: "retryable_failure";
  eventId: null;
  decisionKey: string | null;
  completedAt: null;
  nextRetryAt: string;
  lastError: ClassificationError;
}

export interface TerminalFailureClassificationState
  extends ClassificationStateBase {
  status: "terminal_failure";
  eventId: null;
  decisionKey: string | null;
  completedAt: string;
  nextRetryAt: null;
  lastError: ClassificationError;
}

export type ClassificationState =
  | ClassifiedClassificationState
  | NoneClassificationState
  | RetryableFailureClassificationState
  | TerminalFailureClassificationState;

export function retryDelayMs(
  attemptCount: number,
  policy: ClassificationRetryPolicy,
): number {
  validateClassificationRetryPolicy(policy);
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new Error("attemptCount must be a positive integer");
  }
  return Math.min(
    policy.maxDelayMs,
    policy.initialDelayMs * policy.multiplier ** (attemptCount - 1),
  );
}

export function recordClassificationFailure(input: {
  clusterId: string;
  configHash: string;
  runId: string;
  attemptedAt: string;
  error: unknown;
  retryPolicy: ClassificationRetryPolicy;
  previous?: ClassificationState | null;
  decisionKey?: string | null;
}): RetryableFailureClassificationState | TerminalFailureClassificationState {
  const previous = input.previous ?? null;
  if (
    previous &&
    (previous.clusterId !== input.clusterId || previous.configHash !== input.configHash)
  ) {
    throw new Error("previous state does not match cluster and configuration");
  }
  if (previous?.status === "classified" || previous?.status === "none" || previous?.status === "terminal_failure") {
    throw new Error(`cannot retry terminal classification state ${previous.status}`);
  }
  const attemptedMs = Date.parse(input.attemptedAt);
  if (!Number.isFinite(attemptedMs)) throw new Error("attemptedAt must be an ISO timestamp");
  const lastError = classifyClassificationError(input.error);
  const attemptCount = (previous?.attemptCount ?? 0) + 1;
  const common: ClassificationStateBase = {
    schemaVersion: PULSE_CLASSIFICATION_STATE_VERSION,
    clusterId: required(input.clusterId, "clusterId"),
    configHash: required(input.configHash, "configHash"),
    attemptCount,
    firstAttemptAt: previous?.firstAttemptAt ?? input.attemptedAt,
    lastAttemptAt: input.attemptedAt,
    lastRunId: required(input.runId, "runId"),
  };
  if (!lastError.retryable || attemptCount >= input.retryPolicy.maxAttempts) {
    return {
      ...common,
      status: "terminal_failure",
      eventId: null,
      decisionKey: input.decisionKey ?? null,
      completedAt: input.attemptedAt,
      nextRetryAt: null,
      lastError,
    };
  }
  return {
    ...common,
    status: "retryable_failure",
    eventId: null,
    decisionKey: input.decisionKey ?? null,
    completedAt: null,
    nextRetryAt: new Date(
      attemptedMs + retryDelayMs(attemptCount, input.retryPolicy),
    ).toISOString(),
    lastError,
  };
}

export interface ClassificationQueueCandidate {
  clusterId: string;
  clusteredAt: string;
}

export interface ClassificationQueueItem extends ClassificationQueueCandidate {
  reason: "new" | "due_retry";
  eligibleAt: string;
}

function timestamp(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an ISO timestamp`);
  return parsed;
}

export function selectClassificationQueue(input: {
  candidates: readonly ClassificationQueueCandidate[];
  states: readonly ClassificationState[];
  configHash: string;
  now: string;
  limit?: number;
}): ClassificationQueueItem[] {
  const nowMs = timestamp(input.now, "now");
  const limit = input.limit ?? Number.POSITIVE_INFINITY;
  if (!(limit >= 0)) throw new Error("limit must be non-negative");
  const stateByCluster = new Map<string, ClassificationState>();
  for (const state of input.states) {
    if (state.configHash !== input.configHash) continue;
    if (stateByCluster.has(state.clusterId)) {
      throw new Error(`duplicate current-config state for cluster ${state.clusterId}`);
    }
    stateByCluster.set(state.clusterId, state);
  }
  const fresh: ClassificationQueueItem[] = [];
  const retries: ClassificationQueueItem[] = [];
  for (const candidate of input.candidates) {
    const state = stateByCluster.get(candidate.clusterId);
    if (!state) {
      timestamp(candidate.clusteredAt, "clusteredAt");
      fresh.push({ ...candidate, reason: "new", eligibleAt: candidate.clusteredAt });
    } else if (
      state.status === "retryable_failure" &&
      timestamp(state.nextRetryAt, "nextRetryAt") <= nowMs
    ) {
      retries.push({ ...candidate, reason: "due_retry", eligibleAt: state.nextRetryAt });
    }
  }
  const ordered = (items: ClassificationQueueItem[]) =>
    items.sort(
      (left, right) =>
        timestamp(left.eligibleAt, "eligibleAt") -
          timestamp(right.eligibleAt, "eligibleAt") ||
        left.clusterId.localeCompare(right.clusterId),
    );
  return [...ordered(fresh), ...ordered(retries)].slice(0, limit);
}

export interface ClassificationQueueMetrics {
  totalClusters: number;
  new: number;
  dueRetries: number;
  deferredRetries: number;
  classified: number;
  none: number;
  terminalFailures: number;
  eligible: number;
  oldestEligibleAt: string | null;
  oldestEligibleAgeMs: number | null;
}

export function classificationQueueMetrics(input: {
  candidates: readonly ClassificationQueueCandidate[];
  states: readonly ClassificationState[];
  configHash: string;
  now: string;
}): ClassificationQueueMetrics {
  const nowMs = timestamp(input.now, "now");
  const currentStates = input.states.filter(
    (state) => state.configHash === input.configHash,
  );
  const stateByCluster = new Map(currentStates.map((state) => [state.clusterId, state]));
  const eligible = selectClassificationQueue(input);
  const oldestEligibleAt = eligible.reduce<string | null>((oldest, item) => {
    if (oldest === null) return item.eligibleAt;
    return timestamp(item.eligibleAt, "eligibleAt") < timestamp(oldest, "eligibleAt")
      ? item.eligibleAt
      : oldest;
  }, null);
  const statesForCandidates = input.candidates
    .map((candidate) => stateByCluster.get(candidate.clusterId))
    .filter((state): state is ClassificationState => Boolean(state));
  return {
    totalClusters: input.candidates.length,
    new: eligible.filter((item) => item.reason === "new").length,
    dueRetries: eligible.filter((item) => item.reason === "due_retry").length,
    deferredRetries: statesForCandidates.filter(
      (state) =>
        state.status === "retryable_failure" &&
        timestamp(state.nextRetryAt, "nextRetryAt") > nowMs,
    ).length,
    classified: statesForCandidates.filter((state) => state.status === "classified").length,
    none: statesForCandidates.filter((state) => state.status === "none").length,
    terminalFailures: statesForCandidates.filter(
      (state) => state.status === "terminal_failure",
    ).length,
    eligible: eligible.length,
    oldestEligibleAt,
    oldestEligibleAgeMs:
      oldestEligibleAt === null
        ? null
        : Math.max(0, nowMs - timestamp(oldestEligibleAt, "oldestEligibleAt")),
  };
}
