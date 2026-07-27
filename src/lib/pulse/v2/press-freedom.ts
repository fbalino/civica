/**
 * PUL-010 — versioned information-environment context.
 *
 * The former module embedded an incomplete set of approximate 2024 RSF
 * scores and substituted 50 whenever a jurisdiction was missing. That made an
 * unsourced default behave like a country observation. The replacement keeps
 * missingness explicit and treats the old multipliers as a sensitivity
 * scenario only. Production applies no context multiplier until both rights
 * and validation gates pass.
 */

export const PULSE_INFORMATION_ENVIRONMENT_VERSION =
  "pulse-information-environment-context/v1" as const;

export const RSF_2026_CANDIDATE_RELEASE = Object.freeze({
  sourceId: "rsf_press_freedom",
  sourceUrl: "https://rsf.org/sites/default/files/import_classement/2026.csv",
  methodologyUrl:
    "https://rsf.org/en/methodology-used-compiling-world-press-freedom-index-2026",
  termsUrl: "https://rsf.org/en/cgu",
  upstreamRelease: "RSF World Press Freedom Index 2026",
  observationYear: 2025,
  retrievedAt: "2026-07-11T17:17:00.000Z",
  contentSha256:
    "65ec7bd9b9740e0f51e9b4eea585030b2226c1a96938ec06a4cbbdbd2639aae2",
  publisherRows: 180,
  redistributionPosture: "restricted-no-redistribution",
  rightsStatus: "pending",
  productionUse: "disabled_pending_rights_and_validation",
});

export type PulseInformationEnvironmentValueStatus = "observed" | "missing";
export type PulseInformationEnvironmentTier = "free" | "partial" | "restricted";

export interface PulseInformationEnvironmentContext {
  schemaVersion: typeof PULSE_INFORMATION_ENVIRONMENT_VERSION;
  valueStatus: PulseInformationEnvironmentValueStatus;
  score: number | null;
  tier: PulseInformationEnvironmentTier | null;
  sourceId: string | null;
  sourceUrl: string | null;
  upstreamRelease: string | null;
  observationYear: number | null;
  retrievedAt: string | null;
  contentSha256: string | null;
  sourceCoverage: {
    publisherRows: number | null;
    matchedJurisdictions: number | null;
    supportedJurisdictions: number | null;
  };
  rightsStatus: "verified" | "pending" | "not_registered";
  useStatus:
    | "active_unvalidated_heuristic"
    | "disabled_pending_rights_and_validation"
    | "not_available";
  missingReason: string | null;
}

export const PULSE_INFORMATION_ENVIRONMENT_POLICY = Object.freeze({
  version: "pulse-information-environment-uncertainty/v1",
  productionMode: "disabled_pending_rights_and_validation" as const,
  missingValuePolicy: "no_multiplier" as const,
  validationStanding: "not_calibrated_bias_correction" as const,
  sensitivityMode: "legacy_multiplier_scenario_only" as const,
  tierThresholds: Object.freeze({ freeAtLeast: 70, partialAtLeast: 50 }),
  multipliers: Object.freeze({
    partialAllEvents: 0.8,
    restrictedNewsOnly: 0.3,
    restrictedPositiveThinEvidence: 0.5,
  }),
});

export function informationEnvironmentTier(
  score: number,
): PulseInformationEnvironmentTier {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("information-environment score must be within 0–100");
  }
  if (score >= PULSE_INFORMATION_ENVIRONMENT_POLICY.tierThresholds.freeAtLeast)
    return "free";
  if (
    score >= PULSE_INFORMATION_ENVIRONMENT_POLICY.tierThresholds.partialAtLeast
  )
    return "partial";
  return "restricted";
}

export function missingInformationEnvironmentContext(
  reason = "No rights-cleared, versioned context observation is available.",
  release?: {
    sourceId: string;
    sourceUrl: string;
    upstreamRelease: string;
    observationYear: number;
    retrievedAt: string;
    contentSha256: string;
    publisherRows: number;
    matchedJurisdictions: number;
    supportedJurisdictions: number;
    rightsStatus: "verified" | "pending";
    useStatus:
      "active_unvalidated_heuristic" | "disabled_pending_rights_and_validation";
  },
): PulseInformationEnvironmentContext {
  return {
    schemaVersion: PULSE_INFORMATION_ENVIRONMENT_VERSION,
    valueStatus: "missing",
    score: null,
    tier: null,
    sourceId: release?.sourceId ?? null,
    sourceUrl: release?.sourceUrl ?? null,
    upstreamRelease: release?.upstreamRelease ?? null,
    observationYear: release?.observationYear ?? null,
    retrievedAt: release?.retrievedAt ?? null,
    contentSha256: release?.contentSha256 ?? null,
    sourceCoverage: {
      publisherRows: release?.publisherRows ?? null,
      matchedJurisdictions: release?.matchedJurisdictions ?? null,
      supportedJurisdictions: release?.supportedJurisdictions ?? null,
    },
    rightsStatus: release?.rightsStatus ?? "not_registered",
    useStatus: release?.useStatus ?? "not_available",
    missingReason: reason,
  };
}

export function observedInformationEnvironmentContext(input: {
  score: number;
  sourceId: string;
  sourceUrl: string;
  upstreamRelease: string;
  observationYear: number;
  retrievedAt: string;
  contentSha256: string;
  publisherRows: number;
  matchedJurisdictions: number;
  supportedJurisdictions: number;
  rightsStatus: "verified" | "pending";
  useStatus:
    "active_unvalidated_heuristic" | "disabled_pending_rights_and_validation";
}): PulseInformationEnvironmentContext {
  if (!input.sourceId.trim() || !input.sourceUrl.startsWith("https://")) {
    throw new Error("observed context requires a source id and HTTPS URL");
  }
  if (
    !input.upstreamRelease.trim() ||
    !Number.isInteger(input.observationYear)
  ) {
    throw new Error(
      "observed context requires an upstream release and vintage",
    );
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(input.retrievedAt) ||
    Number.isNaN(Date.parse(input.retrievedAt))
  ) {
    throw new Error("observed context requires a retrieval timestamp");
  }
  if (!/^[a-f0-9]{64}$/.test(input.contentSha256)) {
    throw new Error("observed context requires a SHA-256 input hash");
  }
  for (const [field, value] of Object.entries({
    publisherRows: input.publisherRows,
    matchedJurisdictions: input.matchedJurisdictions,
    supportedJurisdictions: input.supportedJurisdictions,
  })) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative integer`);
    }
  }
  if (input.publisherRows === 0 || input.supportedJurisdictions === 0) {
    throw new Error(
      "observed context requires non-zero publisher and scope coverage",
    );
  }
  if (input.matchedJurisdictions > input.supportedJurisdictions) {
    throw new Error("matched jurisdiction coverage exceeds supported scope");
  }
  if (input.matchedJurisdictions > input.publisherRows) {
    throw new Error("matched jurisdiction coverage exceeds publisher rows");
  }
  return {
    schemaVersion: PULSE_INFORMATION_ENVIRONMENT_VERSION,
    valueStatus: "observed",
    score: input.score,
    tier: informationEnvironmentTier(input.score),
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    upstreamRelease: input.upstreamRelease,
    observationYear: input.observationYear,
    retrievedAt: input.retrievedAt,
    contentSha256: input.contentSha256,
    sourceCoverage: {
      publisherRows: input.publisherRows,
      matchedJurisdictions: input.matchedJurisdictions,
      supportedJurisdictions: input.supportedJurisdictions,
    },
    rightsStatus: input.rightsStatus,
    useStatus: input.useStatus,
    missingReason: null,
  };
}

export function informationEnvironmentMultiplier(input: {
  context: PulseInformationEnvironmentContext;
  isPositive: boolean;
  specialistGroups: number;
  newsGroups: number;
  mode?: "production" | "sensitivity";
}): number {
  if (
    input.mode !== "sensitivity" ||
    input.context.valueStatus !== "observed" ||
    input.context.score === null
  ) {
    return 1;
  }
  const tier = informationEnvironmentTier(input.context.score);
  let multiplier = 1;
  if (tier === "partial") {
    multiplier *=
      PULSE_INFORMATION_ENVIRONMENT_POLICY.multipliers.partialAllEvents;
  }
  if (tier === "restricted" && input.specialistGroups === 0) {
    multiplier *=
      PULSE_INFORMATION_ENVIRONMENT_POLICY.multipliers.restrictedNewsOnly;
  }
  if (
    tier === "restricted" &&
    input.isPositive &&
    input.specialistGroups + input.newsGroups < 2
  ) {
    multiplier *=
      PULSE_INFORMATION_ENVIRONMENT_POLICY.multipliers
        .restrictedPositiveThinEvidence;
  }
  return multiplier;
}
