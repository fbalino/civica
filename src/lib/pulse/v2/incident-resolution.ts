import { createHash } from "node:crypto";

import { cosineSimilarity } from "./embed";
import {
  compareEventIdentities,
  normalizeEventIdentity,
} from "./event-identity";

export const PULSE_INCIDENT_RESOLUTION_VERSION =
  "pulse-incident-resolution/v1" as const;
export const PULSE_INCIDENT_KEY_VERSION = "pulse-incident-key/v1" as const;
export const PULSE_INCIDENT_COMPARISON_WINDOW_HOURS = 48 as const;
export const PULSE_INCIDENT_SEMANTIC_CANDIDATE_THRESHOLD = 0.84 as const;
export const PULSE_INCIDENT_SEMANTIC_ONLY_CANDIDATE_THRESHOLD = 0.9 as const;

export type IncidentCandidateOrigin = "persisted" | "new";
export type IncidentPublicationStatus =
  | "published"
  | "unpublished"
  | "withdrawn";
export type IncidentReviewStatus =
  | "human_current"
  | "human_stale"
  | "machine"
  | "unreviewed";

/** Database-free projection used for both persisted incidents and new reports. */
export interface IncidentCandidate {
  incidentId: string;
  /** Null until an incident has a classified event projection. */
  eventId: string | null;
  clusterId: string;
  origin: IncidentCandidateOrigin;
  jurisdictionId: string | null;
  eventDate: string;
  headline: string;
  body: string | null;
  sourceCount: number;
  publicationStatus: IncidentPublicationStatus;
  reviewStatus: IncidentReviewStatus;
  categoryId: string | null;
  dimension: string | null;
  direction: string | null;
  severity: string | null;
  createdAt: string;
  embedding?: number[] | null;
}

export type IncidentResolutionDisposition =
  | "confirmed_merge"
  | "candidate_merge"
  | "separate"
  | "invalid";

export interface IncidentResolutionFinding {
  findingKey: string;
  disposition: IncidentResolutionDisposition;
  candidateIds: string[];
  canonicalIncidentId: string | null;
  duplicateIncidentId: string | null;
  reasonCode: string;
  hoursApart: number | null;
  exactNormalizedMatch: boolean;
  exactNormalizedHeadlineMatch: boolean;
  tokenSimilarity: number;
  anchorOverlap: number;
  semanticSimilarity: number | null;
  classificationCompatible: boolean;
}

export interface IncidentResolutionPlan {
  schemaVersion: typeof PULSE_INCIDENT_RESOLUTION_VERSION;
  planKey: string;
  candidateKeys: string[];
  findings: IncidentResolutionFinding[];
}

export type IncidentResolutionPlannerMode = "incoming" | "backfill";

export interface IncidentResolutionPlannerOptions {
  /**
   * Incoming runs compare new candidates with one another and with persisted
   * incidents. Backfill runs additionally compare persisted incidents with
   * one another inside the same bounded input.
   */
  mode?: IncidentResolutionPlannerMode;
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

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function buildIncidentCandidateKey(candidate: IncidentCandidate): string {
  return `${PULSE_INCIDENT_KEY_VERSION}/sha256:${sha256({
    ...candidate,
    identityKey: normalizeEventIdentity(
      candidate.headline,
      candidate.body,
    ).key,
  })}`;
}

export function buildIncidentFindingKey(
  finding: Omit<IncidentResolutionFinding, "findingKey">,
): string {
  return `${PULSE_INCIDENT_RESOLUTION_VERSION}/finding/sha256:${sha256(
    finding,
  )}`;
}

export function buildIncidentPlanKey(
  candidateKeys: readonly string[],
  findings: readonly IncidentResolutionFinding[],
): string {
  return `${PULSE_INCIDENT_RESOLUTION_VERSION}/plan/sha256:${sha256({
    candidateKeys: [...candidateKeys].sort(),
    findingKeys: findings.map((finding) => finding.findingKey).sort(),
  })}`;
}

function parsedTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function hoursBetween(left: string, right: string): number | null {
  const a = parsedTime(left);
  const b = parsedTime(right);
  return a === null || b === null ? null : Math.abs(a - b) / 3_600_000;
}

function labelsCompatible(
  left: IncidentCandidate,
  right: IncidentCandidate,
): boolean {
  for (const key of [
    "categoryId",
    "dimension",
    "direction",
    "severity",
  ] as const) {
    if (left[key] !== null && right[key] !== null && left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

function validEmbedding(value: number[] | null | undefined): value is number[] {
  return Boolean(
    value?.length && value.every((component) => Number.isFinite(component)),
  );
}

function semanticSimilarity(
  left: number[] | null | undefined,
  right: number[] | null | undefined,
): number | null {
  if (
    !validEmbedding(left) ||
    !validEmbedding(right) ||
    left.length !== right.length
  ) {
    return null;
  }
  return Math.max(-1, Math.min(1, cosineSimilarity(left, right)));
}

/**
 * Stable survivor rule. Human-reviewed current records outrank publication,
 * then evidence breadth, creation time, and finally the incident id.
 */
export function selectCanonicalIncident(
  candidates: readonly IncidentCandidate[],
): IncidentCandidate {
  if (candidates.length === 0) {
    throw new Error("canonical incident selection requires a candidate");
  }
  return [...candidates].sort((left, right) => {
    const review =
      Number(right.reviewStatus === "human_current") -
      Number(left.reviewStatus === "human_current");
    if (review) return review;
    const published =
      Number(right.publicationStatus === "published") -
      Number(left.publicationStatus === "published");
    if (published) return published;
    if (left.sourceCount !== right.sourceCount) {
      return right.sourceCount - left.sourceCount;
    }
    const leftCreated = parsedTime(left.createdAt) ?? Number.POSITIVE_INFINITY;
    const rightCreated = parsedTime(right.createdAt) ?? Number.POSITIVE_INFINITY;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;
    return left.incidentId.localeCompare(right.incidentId);
  })[0];
}

function blankHeadlineFinding(
  candidate: IncidentCandidate,
): IncidentResolutionFinding {
  const finding = {
    disposition: "invalid" as const,
    candidateIds: [candidate.incidentId],
    canonicalIncidentId: null,
    duplicateIncidentId: candidate.incidentId,
    reasonCode: "blank_headline_quarantine",
    hoursApart: null,
    exactNormalizedMatch: false,
    exactNormalizedHeadlineMatch: false,
    tokenSimilarity: 0,
    anchorOverlap: 0,
    semanticSimilarity: null,
    classificationCompatible: false,
  };
  return { ...finding, findingKey: buildIncidentFindingKey(finding) };
}

function comparePair(
  left: IncidentCandidate,
  right: IncidentCandidate,
): IncidentResolutionFinding {
  const identity = compareEventIdentities(
    normalizeEventIdentity(left.headline, left.body),
    normalizeEventIdentity(right.headline, right.body),
  );
  const headlineIdentity = compareEventIdentities(
    normalizeEventIdentity(left.headline, null),
    normalizeEventIdentity(right.headline, null),
  );
  const hoursApart = hoursBetween(left.eventDate, right.eventDate);
  const sameJurisdiction =
    left.jurisdictionId !== null &&
    left.jurisdictionId === right.jurisdictionId;
  const withinWindow =
    hoursApart !== null &&
    hoursApart <= PULSE_INCIDENT_COMPARISON_WINDOW_HOURS;
  const sameDate =
    parsedTime(left.eventDate) !== null &&
    parsedTime(right.eventDate) !== null &&
    new Date(parsedTime(left.eventDate)!).toISOString().slice(0, 10) ===
      new Date(parsedTime(right.eventDate)!).toISOString().slice(0, 10);
  const compatible = labelsCompatible(left, right);
  const semantic = semanticSimilarity(left.embedding, right.embedding);
  const canonical = selectCanonicalIncident([left, right]);
  const duplicate = canonical === left ? right : left;

  let disposition: IncidentResolutionDisposition = "separate";
  let reasonCode = "identity_evidence_insufficient";
  if (!withinWindow) {
    reasonCode = "outside_48_hour_window";
  } else if (identity.exactNormalizedMatch && compatible) {
    // Ingest-time jurisdictions are provisional. Exact normalized identity is
    // the only automatic rule allowed to override a missing or conflicting
    // provisional country; resolved subject attribution happens later.
    disposition = "confirmed_merge";
    reasonCode = "exact_normalized_within_window_classification_compatible";
  } else if (
    headlineIdentity.exactNormalizedMatch &&
    sameDate &&
    sameJurisdiction &&
    compatible
  ) {
    disposition = "confirmed_merge";
    reasonCode =
      "exact_normalized_headline_same_resolved_jurisdiction_date_classification";
  } else if (identity.exactNormalizedMatch && !compatible) {
    disposition = "candidate_merge";
    reasonCode = "exact_identity_classification_conflict_requires_review";
  } else if (
    semantic !== null &&
    (semantic >= PULSE_INCIDENT_SEMANTIC_ONLY_CANDIDATE_THRESHOLD ||
      (semantic >= PULSE_INCIDENT_SEMANTIC_CANDIDATE_THRESHOLD &&
        (identity.hasIdentityAnchor || identity.anchorOverlap > 0)))
  ) {
    disposition = "candidate_merge";
    reasonCode = "semantic_identity_candidate_requires_review";
  } else if (
    identity.hasIdentityAnchor &&
    identity.anchorOverlap >= 0.8 &&
    identity.tokenSimilarity >= 0.45
  ) {
    // This is deliberately only a review candidate. Lexical fallback can
    // never turn a strong anchor into an automatic merge.
    disposition = "candidate_merge";
    reasonCode =
      semantic === null
        ? "strong_anchor_lexical_fallback_requires_review"
        : "strong_anchor_candidate_requires_review";
  } else if (!sameJurisdiction) {
    reasonCode = "jurisdiction_mismatch_or_unresolved";
  }

  const finding = {
    disposition,
    candidateIds: [left.incidentId, right.incidentId].sort(),
    canonicalIncidentId:
      disposition === "separate" ? null : canonical.incidentId,
    duplicateIncidentId:
      disposition === "separate" ? null : duplicate.incidentId,
    reasonCode,
    hoursApart,
    exactNormalizedMatch: identity.exactNormalizedMatch,
    exactNormalizedHeadlineMatch: headlineIdentity.exactNormalizedMatch,
    tokenSimilarity: identity.tokenSimilarity,
    anchorOverlap: identity.anchorOverlap,
    semanticSimilarity: semantic,
    classificationCompatible: compatible,
  };
  return { ...finding, findingKey: buildIncidentFindingKey(finding) };
}

/**
 * Plans comparisons between incoming and persisted records (and among a new
 * batch). Persisted-to-persisted pairs are intentionally omitted: those are a
 * separate bounded backfill input, not work rediscovered on every ingest.
 */
export function planIncidentResolution(
  input: readonly IncidentCandidate[],
  options: IncidentResolutionPlannerOptions = {},
): IncidentResolutionPlan {
  const mode = options.mode ?? "incoming";
  const candidates = [...input].sort((left, right) =>
    buildIncidentCandidateKey(left).localeCompare(
      buildIncidentCandidateKey(right),
    ),
  );
  const findings = candidates
    .filter((candidate) => !candidate.headline.trim())
    .map(blankHeadlineFinding);
  const valid = candidates.filter((candidate) => candidate.headline.trim());

  for (let leftIndex = 0; leftIndex < valid.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < valid.length; rightIndex++) {
      const left = valid[leftIndex];
      const right = valid[rightIndex];
      if (
        mode === "incoming" &&
        left.origin === "persisted" &&
        right.origin === "persisted"
      ) {
        continue;
      }
      const pairHours = hoursBetween(left.eventDate, right.eventDate);
      if (
        pairHours === null ||
        pairHours > PULSE_INCIDENT_COMPARISON_WINDOW_HOURS
      ) {
        continue;
      }
      findings.push(comparePair(left, right));
    }
  }
  findings.sort((left, right) => left.findingKey.localeCompare(right.findingKey));
  const candidateKeys = candidates.map(buildIncidentCandidateKey).sort();
  return {
    schemaVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
    planKey: buildIncidentPlanKey(candidateKeys, findings),
    candidateKeys,
    findings,
  };
}
