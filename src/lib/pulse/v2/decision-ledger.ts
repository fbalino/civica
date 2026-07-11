import { createHash } from "node:crypto";

import type { VerifyResultLite } from "./classifier-prompt";
import type { PulsePublicationOrigin } from "./review-validation";
import {
  PULSE_DIMENSIONS,
  type PulseDimension,
  type SeverityTier,
} from "./types";

export const PULSE_DECISION_LEDGER_VERSION =
  "pulse-decision-ledger/v1" as const;

export const PULSE_DECISION_KINDS = [
  "event_existence",
  "subject_attribution",
  "category_labels",
  "severity",
  "calibration",
  "corroboration",
  "publication",
] as const;
export type PulseDecisionKind = (typeof PULSE_DECISION_KINDS)[number];

export const PULSE_DECISION_VERDICTS = [
  "affirmed",
  "refuted",
  "abstained",
  "unresolved",
] as const;
export type PulseDecisionVerdict = (typeof PULSE_DECISION_VERDICTS)[number];

export const PULSE_DECISION_ACTOR_TYPES = [
  "classifier",
  "verifier",
  "subject_attributor",
  "calibration_assessor",
  "corroborator",
  "publication_gate",
  "human_reviewer",
  "legacy_projection",
] as const;
export type PulseDecisionActorType =
  (typeof PULSE_DECISION_ACTOR_TYPES)[number];

export interface PulseDecisionPayloads {
  event_existence: {
    disposition: "event" | "non_event" | "insufficient_evidence" | "unresolved";
  };
  subject_attribution: {
    status: "single" | "multiple" | "unresolved";
    primaryJurisdictionId: string | null;
    affectedJurisdictionIds: string[];
    attributionVersion?: string;
    entityCatalogVersion?: string;
    entityCatalogHash?: string | null;
    aliasVersion?: string;
    attributions?: Array<{
      jurisdictionId: string;
      role: "primary" | "affected";
      rationale: string;
      evidenceRefs: string[];
      entity: {
        canonicalName: string;
        iso2: string | null;
        iso3: string | null;
        slug: string;
        aliases: string[];
      };
    }>;
  };
  category_labels: {
    categoryIds: string[];
    dimensionIds: PulseDimension[];
  };
  severity: {
    tier: SeverityTier | null;
    value: number | null;
    direction: "positive" | "negative" | "neutral" | "unknown";
  };
  calibration: {
    standing: "not_calibrated";
    signals: string[];
    targetDecisionKinds: Array<
      | "event_existence"
      | "subject_attribution"
      | "category_labels"
      | "severity"
      | "publication"
    >;
    validationReleaseId: null;
  };
  corroboration: {
    independentEvidenceGroups: number | null;
    contributingReports: number | null;
    confidenceWeight: number | null;
    calibrationStanding: "heuristic_not_probability";
  };
  publication: {
    eligible: boolean;
    origin: PulsePublicationOrigin;
    gateReasons: string[];
  };
}

export interface PulseDecisionActor {
  type: PulseDecisionActorType;
  provider: string | null;
  model: string | null;
  reviewerId: string | null;
}

export interface PulseDecisionInput<
  K extends PulseDecisionKind = PulseDecisionKind,
> {
  clusterId: string;
  eventId: string | null;
  kind: K;
  verdict: PulseDecisionVerdict;
  payload: PulseDecisionPayloads[K];
  actor: PulseDecisionActor;
  stageRunId: string;
  methodVersion: string;
  rationale: string;
  evidenceRefs: string[];
  supersedesDecisionKey?: string | null;
  decidedAt: string;
}

export interface PulseDecisionRecord<
  K extends PulseDecisionKind = PulseDecisionKind,
> extends PulseDecisionInput<K> {
  schemaVersion: typeof PULSE_DECISION_LEDGER_VERSION;
  decisionKey: string;
  supersedesDecisionKey: string | null;
}

export interface PulseDecisionReview {
  kind:
    "event_existence" | "subject_attribution" | "category_labels" | "severity";
  verdict: "affirmed" | "refuted";
  rationale: string;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort();
}

function normalizePayload<K extends PulseDecisionKind>(
  kind: K,
  payload: PulseDecisionPayloads[K],
): PulseDecisionPayloads[K] {
  if (kind === "subject_attribution") {
    const value = payload as PulseDecisionPayloads["subject_attribution"];
    return {
      ...value,
      affectedJurisdictionIds: uniqueSorted(value.affectedJurisdictionIds),
      attributions: value.attributions
        ?.map((row) => ({
          ...row,
          evidenceRefs: uniqueSorted(row.evidenceRefs),
          entity: { ...row.entity, aliases: uniqueSorted(row.entity.aliases) },
        }))
        .sort((left, right) =>
          left.role === right.role
            ? left.jurisdictionId.localeCompare(right.jurisdictionId)
            : left.role === "primary"
              ? -1
              : 1,
        ),
    } as PulseDecisionPayloads[K];
  }
  if (kind === "category_labels") {
    const value = payload as PulseDecisionPayloads["category_labels"];
    return {
      categoryIds: uniqueSorted(value.categoryIds),
      dimensionIds: uniqueSorted(value.dimensionIds) as PulseDimension[],
    } as PulseDecisionPayloads[K];
  }
  if (kind === "publication") {
    const value = payload as PulseDecisionPayloads["publication"];
    return {
      ...value,
      gateReasons: uniqueSorted(value.gateReasons),
    } as PulseDecisionPayloads[K];
  }
  if (kind === "calibration") {
    const value = payload as PulseDecisionPayloads["calibration"];
    return {
      ...value,
      signals: uniqueSorted(value.signals),
      targetDecisionKinds: uniqueSorted(
        value.targetDecisionKinds,
      ) as PulseDecisionPayloads["calibration"]["targetDecisionKinds"],
    } as PulseDecisionPayloads[K];
  }
  return structuredClone(payload);
}

function validatePayload(input: PulseDecisionInput): void {
  const payload = input.payload as unknown as Record<string, unknown>;
  if (input.kind === "event_existence") {
    if (
      !["event", "non_event", "insufficient_evidence", "unresolved"].includes(
        String(payload.disposition),
      )
    ) {
      throw new Error("event-existence decision has an invalid disposition");
    }
  } else if (input.kind === "subject_attribution") {
    const status = String(payload.status);
    const primary = payload.primaryJurisdictionId;
    if (!["single", "multiple", "unresolved"].includes(status)) {
      throw new Error("subject-attribution decision has an invalid status");
    }
    if ((status === "single" || status === "multiple") && !primary) {
      throw new Error("resolved attribution requires a primary jurisdiction");
    }
    if (status === "unresolved" && primary !== null) {
      throw new Error(
        "unresolved attribution cannot name a primary jurisdiction",
      );
    }
    if (!Array.isArray(payload.affectedJurisdictionIds)) {
      throw new Error("subject attribution requires affected jurisdictions");
    }
    if (
      primary !== null &&
      !(payload.affectedJurisdictionIds as unknown[]).includes(primary)
    ) {
      throw new Error("primary jurisdiction must appear in the affected set");
    }
    if (payload.attributionVersion !== undefined) {
      if (
        typeof payload.attributionVersion !== "string" ||
        typeof payload.entityCatalogVersion !== "string" ||
        typeof payload.entityCatalogHash !== "string" ||
        typeof payload.aliasVersion !== "string" ||
        !Array.isArray(payload.attributions)
      ) {
        throw new Error("versioned attribution requires catalog metadata and rows");
      }
      const rows = payload.attributions as Array<Record<string, unknown>>;
      const rowIds = rows.map((row) => row.jurisdictionId);
      if (
        new Set(rowIds).size !== rowIds.length ||
        rows.some(
          (row) =>
            typeof row.jurisdictionId !== "string" ||
            (row.role !== "primary" && row.role !== "affected") ||
            typeof row.rationale !== "string" ||
            !row.rationale ||
            !Array.isArray(row.evidenceRefs) ||
            !row.entity ||
            typeof row.entity !== "object",
        ) ||
        rows.filter((row) => row.role === "primary").length !==
          (primary === null ? 0 : 1) ||
        rows.some(
          (row) =>
            !(payload.affectedJurisdictionIds as unknown[]).includes(
              row.jurisdictionId,
            ),
        )
      ) {
        throw new Error("versioned attribution rows do not match the decision");
      }
    }
  } else if (input.kind === "category_labels") {
    const categories = payload.categoryIds;
    const dimensions = payload.dimensionIds;
    if (!Array.isArray(categories) || !Array.isArray(dimensions)) {
      throw new Error("category decision requires label and dimension arrays");
    }
    if (
      dimensions.some(
        (dimension) => !PULSE_DIMENSIONS.includes(dimension as PulseDimension),
      )
    ) {
      throw new Error("category decision contains an unknown dimension");
    }
    if (input.verdict === "affirmed" && categories.length === 0) {
      throw new Error("affirmed category decision requires at least one label");
    }
  } else if (input.kind === "severity") {
    const value = payload.value;
    const tier = payload.tier;
    if ((value === null) !== (tier === null)) {
      throw new Error(
        "severity tier and value must be present or absent together",
      );
    }
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error("severity value must be finite");
    }
  } else if (input.kind === "corroboration") {
    for (const field of [
      "independentEvidenceGroups",
      "contributingReports",
    ] as const) {
      const value = payload[field];
      if (value !== null && (!Number.isInteger(value) || Number(value) < 0)) {
        throw new Error(`${field} must be a non-negative integer or null`);
      }
    }
    const weight = payload.confidenceWeight;
    if (
      weight !== null &&
      (typeof weight !== "number" ||
        !Number.isFinite(weight) ||
        weight < 0 ||
        weight > 1)
    ) {
      throw new Error("corroboration weight must be within 0–1 or null");
    }
    if (payload.calibrationStanding !== "heuristic_not_probability") {
      throw new Error(
        "corroboration decision must disclose heuristic standing",
      );
    }
  } else if (input.kind === "calibration") {
    if (
      payload.standing !== "not_calibrated" ||
      !Array.isArray(payload.signals) ||
      !Array.isArray(payload.targetDecisionKinds) ||
      payload.validationReleaseId !== null
    ) {
      throw new Error(
        "calibration decision must disclose uncalibrated standing",
      );
    }
    if (
      payload.signals.length === 0 ||
      payload.targetDecisionKinds.length === 0
    ) {
      throw new Error(
        "calibration decision requires named signals and target axes",
      );
    }
  } else if (input.kind === "publication") {
    if (
      typeof payload.eligible !== "boolean" ||
      !Array.isArray(payload.gateReasons)
    ) {
      throw new Error(
        "publication decision requires eligibility and gate reasons",
      );
    }
    const publicOrigins = new Set(["auto", "human_approved", "human_edited"]);
    if (payload.eligible !== publicOrigins.has(String(payload.origin))) {
      throw new Error("publication origin contradicts eligibility");
    }
    if (payload.gateReasons.length === 0) {
      throw new Error("publication decision requires at least one gate reason");
    }
  }
}

export function createPulseDecision<K extends PulseDecisionKind>(
  input: PulseDecisionInput<K>,
): PulseDecisionRecord<K> {
  if (
    !input.clusterId.trim() ||
    !input.stageRunId.trim() ||
    !input.methodVersion.trim()
  ) {
    throw new Error(
      "Pulse decision requires cluster, stage-run, and method identity",
    );
  }
  if (!input.rationale.trim())
    throw new Error("Pulse decision requires a rationale");
  if (Number.isNaN(Date.parse(input.decidedAt))) {
    throw new Error("Pulse decision requires an ISO decision timestamp");
  }
  if (!PULSE_DECISION_KINDS.includes(input.kind)) {
    throw new Error("Pulse decision has an unknown kind");
  }
  if (!PULSE_DECISION_VERDICTS.includes(input.verdict)) {
    throw new Error("Pulse decision has an unknown verdict");
  }
  if (!PULSE_DECISION_ACTOR_TYPES.includes(input.actor.type)) {
    throw new Error("Pulse decision has an unknown actor type");
  }
  const normalizedPayload = normalizePayload(input.kind, input.payload);
  const normalized = {
    ...input,
    payload: normalizedPayload,
    actor: {
      ...input.actor,
      provider: input.actor.provider?.trim() || null,
      model: input.actor.model?.trim() || null,
      reviewerId: input.actor.reviewerId?.trim() || null,
    },
    evidenceRefs: uniqueSorted(input.evidenceRefs),
    supersedesDecisionKey: input.supersedesDecisionKey ?? null,
    decidedAt: new Date(input.decidedAt).toISOString(),
  };
  validatePayload(normalized);
  const hash = createHash("sha256")
    .update(JSON.stringify(canonical(normalized)))
    .digest("hex");
  return {
    schemaVersion: PULSE_DECISION_LEDGER_VERSION,
    decisionKey: `pulse-decision/sha256:${hash}`,
    ...normalized,
  };
}

/** Convert the current four-axis adversarial verifier into independent
 * reviews. Confidence is deliberately absent: each axis retains its verdict. */
export function reviewsFromVerifier(
  verify: VerifyResultLite,
): PulseDecisionReview[] {
  const reviews: Array<Omit<PulseDecisionReview, "rationale">> = [
    {
      kind: "event_existence",
      verdict: verify.isEvent ? "affirmed" : "refuted",
    },
    {
      kind: "subject_attribution",
      verdict: verify.subjectOk ? "affirmed" : "refuted",
    },
    {
      kind: "category_labels",
      verdict: verify.categoryOk ? "affirmed" : "refuted",
    },
    { kind: "severity", verdict: verify.severityOk ? "affirmed" : "refuted" },
  ];
  return reviews.map((review) => ({ ...review, rationale: verify.rationale }));
}

/** Any decision kind can be challenged without rewriting another axis. */
export function refutePulseDecision<K extends PulseDecisionKind>(input: {
  target: PulseDecisionRecord<K>;
  actor: PulseDecisionActor;
  stageRunId: string;
  methodVersion: string;
  rationale: string;
  decidedAt: string;
}): PulseDecisionRecord<K> {
  return createPulseDecision({
    clusterId: input.target.clusterId,
    eventId: input.target.eventId,
    kind: input.target.kind,
    verdict: "refuted",
    payload: input.target.payload,
    actor: input.actor,
    stageRunId: input.stageRunId,
    methodVersion: input.methodVersion,
    rationale: input.rationale,
    evidenceRefs: [input.target.decisionKey],
    supersedesDecisionKey: input.target.decisionKey,
    decidedAt: input.decidedAt,
  });
}
