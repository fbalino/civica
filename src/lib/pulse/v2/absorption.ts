import { createHash } from "node:crypto";
import type { CiReleaseContract } from "@/lib/ci/release-selection";
import type { PulseDimension } from "./types";

export const PULSE_ABSORPTION_SCHEMA_VERSION =
  "pulse-event-absorption/v1" as const;
export const PULSE_ABSORPTION_METHOD_VERSION =
  "pulse-absorption/explicit-link-fixed-scale-v1" as const;
export const DEFAULT_ABSORPTION_THRESHOLD = 3;

export type AbsorptionOutcome = "absorbed" | "not_absorbed";
export type AbsorptionLinkStanding = "confirmed" | "candidate";
export type AbsorptionLinkActorType =
  | "human_reviewer"
  | "source_native_exact_link"
  | "model_candidate";

export interface AbsorptionEvent {
  id: string;
  jurisdictionId: string;
  dimension: PulseDimension;
  eventDate: string;
  severityValue: number;
}

export interface ExplicitAbsorptionLink {
  eventId: string;
  jurisdictionId: string;
  dimension: PulseDimension;
  currentReleaseId: string;
  standing: AbsorptionLinkStanding;
  actorType: AbsorptionLinkActorType;
  linkMethodVersion: string;
  rationale: string;
  evidenceRefs: string[];
}

const ABSORBABLE_DIMENSIONS: PulseDimension[] = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
];

export function parseExplicitAbsorptionLinks(
  value: unknown,
): ExplicitAbsorptionLink[] {
  if (!Array.isArray(value)) throw new Error("absorption link input must be an array");
  return value.map((item, index) => {
    if (!item || typeof item !== "object")
      throw new Error(`absorption link ${index} must be an object`);
    const row = item as Record<string, unknown>;
    for (const field of [
      "eventId",
      "jurisdictionId",
      "dimension",
      "currentReleaseId",
      "standing",
      "actorType",
      "linkMethodVersion",
      "rationale",
    ]) {
      if (typeof row[field] !== "string" || !row[field].trim())
        throw new Error(`absorption link ${index} has invalid ${field}`);
    }
    if (!ABSORBABLE_DIMENSIONS.includes(row.dimension as PulseDimension))
      throw new Error(`absorption link ${index} has unsupported dimension`);
    if (row.standing !== "confirmed" && row.standing !== "candidate")
      throw new Error(`absorption link ${index} has invalid standing`);
    if (
      row.actorType !== "human_reviewer" &&
      row.actorType !== "source_native_exact_link" &&
      row.actorType !== "model_candidate"
    ) {
      throw new Error(`absorption link ${index} has invalid actorType`);
    }
    if (
      !Array.isArray(row.evidenceRefs) ||
      row.evidenceRefs.some((ref) => typeof ref !== "string" || !ref.trim())
    ) {
      throw new Error(`absorption link ${index} has invalid evidenceRefs`);
    }
    return {
      eventId: row.eventId as string,
      jurisdictionId: row.jurisdictionId as string,
      dimension: row.dimension as PulseDimension,
      currentReleaseId: row.currentReleaseId as string,
      standing: row.standing as AbsorptionLinkStanding,
      actorType: row.actorType as AbsorptionLinkActorType,
      linkMethodVersion: row.linkMethodVersion as string,
      rationale: row.rationale as string,
      evidenceRefs: row.evidenceRefs as string[],
    };
  });
}

export interface AbsorptionAssessmentInput {
  event: AbsorptionEvent;
  previousRelease: CiReleaseContract;
  currentRelease: CiReleaseContract;
  previousScore: number;
  currentScore: number;
  link: ExplicitAbsorptionLink;
  asOf: string;
  threshold?: number;
  supersedesAbsorptionKey?: string | null;
}

export interface AbsorptionAssessment {
  schemaVersion: typeof PULSE_ABSORPTION_SCHEMA_VERSION;
  absorptionKey: string;
  eventId: string;
  jurisdictionId: string;
  dimension: PulseDimension;
  outcome: AbsorptionOutcome;
  previousCiReleaseId: string;
  currentCiReleaseId: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  threshold: number;
  fixedScaleId: string;
  linkStanding: AbsorptionLinkStanding;
  linkActorType: AbsorptionLinkActorType;
  linkMethodVersion: string;
  methodVersion: typeof PULSE_ABSORPTION_METHOD_VERSION;
  asOf: string;
  rationale: string;
  evidenceRefs: string[];
  reasons: string[];
  supersedesAbsorptionKey: string | null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function releaseDimensionIdentity(
  release: CiReleaseContract,
  dimension: string,
): string[] {
  return release.dimensions
    .filter((rule) => rule.dimension === dimension)
    .map((rule) => `${rule.priority}:${rule.sourceId}:${rule.indicatorId}`)
    .sort();
}

export function comparableFixedScaleReleaseReasons(
  previous: CiReleaseContract,
  current: CiReleaseContract,
  dimension: string,
): string[] {
  const reasons: string[] = [];
  if (previous.releaseId === current.releaseId)
    reasons.push("same_release");
  if (previous.series.observationPeriodEnd >= current.series.observationPeriodEnd)
    reasons.push("nonsequential_observation_period");
  if (previous.inputTransformationVersion !== current.inputTransformationVersion)
    reasons.push("input_transform_changed");
  if (previous.displayTransformVersion !== current.displayTransformVersion)
    reasons.push("display_transform_changed");
  if (!current.displayTransformVersion.includes("fixed"))
    reasons.push("scale_not_declared_fixed");
  if (
    canonicalJson(releaseDimensionIdentity(previous, dimension)) !==
    canonicalJson(releaseDimensionIdentity(current, dimension))
  ) {
    reasons.push("dimension_source_identity_changed");
  }
  if (releaseDimensionIdentity(current, dimension).length === 0)
    reasons.push("dimension_absent_from_release");
  return [...new Set(reasons)].sort();
}

function linkReasons(
  event: AbsorptionEvent,
  currentRelease: CiReleaseContract,
  link: ExplicitAbsorptionLink,
): string[] {
  const reasons: string[] = [];
  if (link.eventId !== event.id) reasons.push("link_event_mismatch");
  if (link.jurisdictionId !== event.jurisdictionId)
    reasons.push("link_jurisdiction_mismatch");
  if (link.dimension !== event.dimension) reasons.push("link_dimension_mismatch");
  if (link.currentReleaseId !== currentRelease.releaseId)
    reasons.push("link_release_mismatch");
  if (link.standing !== "confirmed") reasons.push("link_not_confirmed");
  if (link.actorType === "model_candidate")
    reasons.push("model_candidate_cannot_confirm_link");
  if (!link.linkMethodVersion.trim()) reasons.push("missing_link_method");
  if (!link.rationale.trim()) reasons.push("missing_link_rationale");
  const eventRef = `pulse-event:${event.id}`;
  const observationRef = `ci-observation:${currentRelease.releaseId}:${event.jurisdictionId}:${event.dimension}`;
  if (!link.evidenceRefs.includes(eventRef)) reasons.push("missing_event_evidence_ref");
  if (!link.evidenceRefs.includes(observationRef))
    reasons.push("missing_ci_observation_evidence_ref");
  return reasons;
}

export function assessEventAbsorption(
  input: AbsorptionAssessmentInput,
): AbsorptionAssessment {
  const threshold = input.threshold ?? DEFAULT_ABSORPTION_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold <= 0)
    throw new Error("absorption threshold must be positive and finite");
  if (!Number.isFinite(input.previousScore) || !Number.isFinite(input.currentScore))
    throw new Error("absorption scores must be finite");
  if (!Number.isFinite(input.event.severityValue) || input.event.severityValue === 0)
    throw new Error("absorption event must have a nonzero finite severity");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOf))
    throw new Error("absorption as-of must be an ISO date");

  const scoreDelta = input.currentScore - input.previousScore;
  const reasons = [
    ...comparableFixedScaleReleaseReasons(
      input.previousRelease,
      input.currentRelease,
      input.event.dimension,
    ),
    ...linkReasons(input.event, input.currentRelease, input.link),
  ];
  if (Math.abs(scoreDelta) < threshold) reasons.push("movement_below_threshold");
  if (Math.sign(scoreDelta) !== Math.sign(input.event.severityValue))
    reasons.push("movement_direction_mismatch");
  const uniqueReasons = [...new Set(reasons)].sort();
  const fixedScaleId = `${input.currentRelease.inputTransformationVersion}|${input.currentRelease.displayTransformVersion}`;
  const core = {
    schemaVersion: PULSE_ABSORPTION_SCHEMA_VERSION,
    eventId: input.event.id,
    jurisdictionId: input.event.jurisdictionId,
    dimension: input.event.dimension,
    outcome: uniqueReasons.length === 0 ? "absorbed" : "not_absorbed",
    previousCiReleaseId: input.previousRelease.releaseId,
    currentCiReleaseId: input.currentRelease.releaseId,
    previousScore: input.previousScore,
    currentScore: input.currentScore,
    scoreDelta,
    threshold,
    fixedScaleId,
    linkStanding: input.link.standing,
    linkActorType: input.link.actorType,
    linkMethodVersion: input.link.linkMethodVersion,
    methodVersion: PULSE_ABSORPTION_METHOD_VERSION,
    asOf: input.asOf,
    rationale: input.link.rationale,
    evidenceRefs: [...new Set(input.link.evidenceRefs)].sort(),
    reasons: uniqueReasons,
    supersedesAbsorptionKey: input.supersedesAbsorptionKey ?? null,
  } as const;
  const digest = createHash("sha256").update(canonicalJson(core)).digest("hex");
  return {
    ...core,
    outcome: core.outcome as AbsorptionOutcome,
    absorptionKey: `pulse-absorption/sha256:${digest}`,
  };
}
