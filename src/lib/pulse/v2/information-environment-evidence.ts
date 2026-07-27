import { createHash } from "node:crypto";

import {
  PULSE_INFORMATION_ENVIRONMENT_VERSION,
  informationEnvironmentTier,
  type PulseInformationEnvironmentTier,
} from "./press-freedom";

export const PULSE_INFORMATION_ENVIRONMENT_RELEASE_VERSION =
  "pulse-information-environment-release/v1" as const;
export const PULSE_INFORMATION_ENVIRONMENT_PIN_VERSION =
  "pulse-information-environment-pin/v1" as const;
export const PULSE_INFORMATION_ENVIRONMENT_PIN_METHOD =
  "pulse-information-environment/classification-pin-v1" as const;

export type InformationEnvironmentValueStatus = "observed" | "missing";

export interface SupportedJurisdiction {
  jurisdictionId: string;
  iso3: string | null;
}

export interface InformationEnvironmentPublisherRow {
  iso3: string;
  score: number;
}

export interface InformationEnvironmentCoverageRow {
  jurisdictionId: string;
  iso3: string | null;
  valueStatus: InformationEnvironmentValueStatus;
  score: number | null;
  tier: PulseInformationEnvironmentTier | null;
  missingReason: string | null;
}

export interface InformationEnvironmentPinInput {
  eventId: string;
  jurisdictionId: string;
  classificationRunId: string;
  classifiedAt: string;
  releaseId: string | null;
  valueStatus: InformationEnvironmentValueStatus;
  score: number | null;
  tier: PulseInformationEnvironmentTier | null;
  sourceId: string | null;
  sourceUrl: string | null;
  upstreamRelease: string | null;
  observationYear: number | null;
  retrievedAt: string | null;
  contentSha256: string | null;
  rightsStatus: "verified" | "pending" | "not_registered";
  useStatus:
    | "active_unvalidated_heuristic"
    | "disabled_pending_rights_and_validation"
    | "not_available";
  missingReason: string | null;
}

export interface InformationEnvironmentPin extends InformationEnvironmentPinInput {
  schemaVersion: typeof PULSE_INFORMATION_ENVIRONMENT_PIN_VERSION;
  contextSchemaVersion: typeof PULSE_INFORMATION_ENVIRONMENT_VERSION;
  methodVersion: typeof PULSE_INFORMATION_ENVIRONMENT_PIN_METHOD;
  pinKey: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function nonBlank(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} must not be blank`);
}

export function parseOfficialInformationEnvironmentCsv(
  csv: string,
): InformationEnvironmentPublisherRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2)
    throw new Error("official context file has no data rows");
  const header = lines[0].split(";");
  const isoIndex = header.indexOf("ISO");
  const scoreIndex = header.indexOf("Score 2026");
  if (isoIndex < 0 || scoreIndex < 0) {
    throw new Error("official context file is missing ISO or Score 2026");
  }
  const seen = new Set<string>();
  return lines.slice(1).map((line, index) => {
    const columns = line.split(";");
    const iso3 = (columns[isoIndex] ?? "").trim().toUpperCase();
    const score = Number((columns[scoreIndex] ?? "").trim().replace(",", "."));
    if (!/^[A-Z]{3}$/.test(iso3)) {
      throw new Error(`official context row ${index + 2} has invalid ISO3`);
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`official context row ${index + 2} has invalid score`);
    }
    if (seen.has(iso3))
      throw new Error(`duplicate official context ISO3: ${iso3}`);
    seen.add(iso3);
    return { iso3, score };
  });
}

export function buildCompleteInformationEnvironmentCoverage(input: {
  supportedJurisdictions: readonly SupportedJurisdiction[];
  publisherRows: readonly InformationEnvironmentPublisherRow[];
}): InformationEnvironmentCoverageRow[] {
  const byIso3 = new Map(
    input.publisherRows.map((row) => [row.iso3, row.score]),
  );
  const jurisdictionIds = new Set<string>();
  return [...input.supportedJurisdictions]
    .sort((left, right) =>
      left.jurisdictionId.localeCompare(right.jurisdictionId),
    )
    .map((jurisdiction) => {
      nonBlank(jurisdiction.jurisdictionId, "jurisdictionId");
      if (jurisdictionIds.has(jurisdiction.jurisdictionId)) {
        throw new Error(
          `duplicate supported jurisdiction: ${jurisdiction.jurisdictionId}`,
        );
      }
      jurisdictionIds.add(jurisdiction.jurisdictionId);
      const score = jurisdiction.iso3
        ? byIso3.get(jurisdiction.iso3.toUpperCase())
        : undefined;
      return score === undefined
        ? {
            jurisdictionId: jurisdiction.jurisdictionId,
            iso3: jurisdiction.iso3,
            valueStatus: "missing" as const,
            score: null,
            tier: null,
            missingReason: jurisdiction.iso3
              ? "The official release contains no row for this supported jurisdiction."
              : "The supported jurisdiction has no ISO3 match key; no value was inferred.",
          }
        : {
            jurisdictionId: jurisdiction.jurisdictionId,
            iso3: jurisdiction.iso3,
            valueStatus: "observed" as const,
            score,
            tier: informationEnvironmentTier(score),
            missingReason: null,
          };
    });
}

export function buildInformationEnvironmentPin(
  input: InformationEnvironmentPinInput,
): InformationEnvironmentPin {
  for (const [name, value] of [
    ["eventId", input.eventId],
    ["jurisdictionId", input.jurisdictionId],
    ["classificationRunId", input.classificationRunId],
  ] as const)
    nonBlank(value, name);
  if (Number.isNaN(Date.parse(input.classifiedAt))) {
    throw new Error("classifiedAt must be an ISO instant");
  }
  if (input.valueStatus === "observed") {
    if (
      input.score === null ||
      input.tier === null ||
      !input.releaseId ||
      !input.sourceId ||
      !input.sourceUrl ||
      !input.upstreamRelease ||
      input.observationYear === null ||
      !input.retrievedAt ||
      !input.contentSha256 ||
      input.missingReason !== null
    ) {
      throw new Error(
        "observed pins require complete release provenance and no missing reason",
      );
    }
    if (informationEnvironmentTier(input.score) !== input.tier) {
      throw new Error("observed pin tier does not match its score");
    }
  } else if (
    input.score !== null ||
    input.tier !== null ||
    !input.missingReason?.trim()
  ) {
    throw new Error(
      "missing pins require null value fields and an explicit reason",
    );
  }
  const identity = {
    ...input,
    schemaVersion: PULSE_INFORMATION_ENVIRONMENT_PIN_VERSION,
    contextSchemaVersion: PULSE_INFORMATION_ENVIRONMENT_VERSION,
    methodVersion: PULSE_INFORMATION_ENVIRONMENT_PIN_METHOD,
  };
  return {
    ...identity,
    pinKey: `pulse-information-environment-pin/sha256:${createHash("sha256")
      .update(canonical(identity))
      .digest("hex")}`,
  };
}
