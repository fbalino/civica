import { createHash } from "node:crypto";

import {
  SOURCE_INPUT_SPECS,
  type SourceInputSpec,
} from "@/lib/data/source-input-manifest";
import { sourceRights, type SourceRightsRecord } from "@/lib/rights/manifest";
import type { RawEventInput } from "./types";

export const PULSE_EVIDENCE_SCHEMA_VERSION = "pulse-raw-evidence/v1" as const;
export const PULSE_EVIDENCE_HASH_ALGORITHM =
  "canonical-json/sha256-v1" as const;

const PUBLISHER_NAMES: Readonly<Record<string, string>> = {
  acled: "Armed Conflict Location & Event Data Project",
  amnesty: "Amnesty International",
  ap_wire: "Associated Press",
  civicus_monitor: "CIVICUS Monitor",
  gdelt: "GDELT Project",
  hrw: "Human Rights Watch",
  ipu_parline: "Inter-Parliamentary Union Parline",
  reuters_wire: "Reuters",
  rsf_alerts: "Reporters Without Borders",
};

export interface PulseEvidencePublisherSnapshot {
  schemaVersion: typeof PULSE_EVIDENCE_SCHEMA_VERSION;
  sourceId: string;
  sourceFamilyId: string;
  sourcePublisher: string;
  sourceCanonicalUrl: string;
  itemPublisherHost: string | null;
  sourceType: RawEventInput["sourceType"];
}

export interface PulseEvidenceAttributionSnapshot {
  schemaVersion: typeof PULSE_EVIDENCE_SCHEMA_VERSION;
  methodVersion: "country-resolver/connector-v1" | "legacy_unversioned";
  status: "resolved" | "unresolved";
  rawCountryName: string | null;
  jurisdictionId: string | null;
  evidence: Array<{ kind: "source_country_label"; value: string }>;
}

export interface PulseEvidenceRightsSnapshot {
  schemaVersion: typeof PULSE_EVIDENCE_SCHEMA_VERSION;
  sourceId: string;
  licenseId: string;
  termsUrl: string;
  reviewStatus: SourceRightsRecord["reviewStatus"];
  reviewedAt: string | null;
  publicExport: SourceRightsRecord["publicExport"];
  redistributionPosture: SourceInputSpec["redistributionPosture"];
  restrictions: string[];
}

export interface PulseEvidenceRetentionSnapshot {
  schemaVersion: typeof PULSE_EVIDENCE_SCHEMA_VERSION;
  captureMode: "full_internal_snapshot";
  storedFields: ["title", "body", "raw"];
  storageRelation: "raw_events";
  publicPayloadDistribution: "blocked";
  hashAlgorithm:
    | typeof PULSE_EVIDENCE_HASH_ALGORITHM
    | "postgres-jsonb-text/sha256-legacy-v1";
  linkRotProtection: "stored_payload_plus_content_hash";
  policyReason: string;
}

export interface PulseEvidenceIdentity {
  evidenceIdentityKey: string;
  evidenceContentHash: string;
  evidenceLanguage: string;
  evidencePublisher: PulseEvidencePublisherSnapshot;
  evidenceAttribution: PulseEvidenceAttributionSnapshot;
  evidenceRights: PulseEvidenceRightsSnapshot;
  evidenceRetention: PulseEvidenceRetentionSnapshot;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function pulseEvidenceSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function hostname(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

const LANGUAGE_CODES: Readonly<Record<string, string>> = {
  arabic: "ar",
  chinese: "zh",
  english: "en",
  french: "fr",
  german: "de",
  indonesian: "id",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  spanish: "es",
};

export function evidenceLanguage(raw: Record<string, unknown>): string {
  const declared = typeof raw.language === "string" ? raw.language.trim() : "";
  if (!declared) return "und";
  const lower = declared.toLowerCase();
  return (
    LANGUAGE_CODES[lower] ??
    (/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(declared) ? lower : "und")
  );
}

function sourceContract(sourceId: string): {
  spec: SourceInputSpec;
  rights: SourceRightsRecord;
} {
  const spec = SOURCE_INPUT_SPECS.find(
    (candidate) => candidate.sourceId === sourceId,
  );
  const rights = sourceRights(sourceId);
  if (!spec || !rights) {
    throw new Error(
      `Pulse source ${sourceId} has no complete source-input and rights contract`,
    );
  }
  return { spec, rights };
}

export function buildPulseEvidenceIdentity(
  row: RawEventInput,
  retrievedAt: Date,
): PulseEvidenceIdentity {
  if (!row.sourceUrl)
    throw new Error("sourceUrl is required for evidence identity");
  if (Number.isNaN(retrievedAt.getTime()))
    throw new Error("retrievedAt is invalid");
  const { spec, rights } = sourceContract(row.sourceId);
  const content = {
    sourceId: row.sourceId,
    externalId: row.externalId ?? null,
    sourceUrl: row.sourceUrl,
    eventDate: row.eventDate ?? null,
    title: row.title,
    body: row.body ?? null,
    raw: row.raw,
  };
  const evidenceContentHash = pulseEvidenceSha256(content);
  const itemPublisherHost =
    (typeof row.raw.domain === "string" &&
      hostname(`https://${row.raw.domain}`)) ||
    hostname(row.sourceUrl);
  const evidencePublisher: PulseEvidencePublisherSnapshot = {
    schemaVersion: PULSE_EVIDENCE_SCHEMA_VERSION,
    sourceId: row.sourceId,
    sourceFamilyId: row.sourceId,
    sourcePublisher: PUBLISHER_NAMES[row.sourceId] ?? row.sourceId,
    sourceCanonicalUrl: spec.canonicalUrl,
    itemPublisherHost,
    sourceType: row.sourceType,
  };
  const evidenceAttribution: PulseEvidenceAttributionSnapshot = {
    schemaVersion: PULSE_EVIDENCE_SCHEMA_VERSION,
    methodVersion: "country-resolver/connector-v1",
    status: row.jurisdictionId ? "resolved" : "unresolved",
    rawCountryName: row.rawCountryName ?? null,
    jurisdictionId: row.jurisdictionId ?? null,
    evidence: row.rawCountryName
      ? [{ kind: "source_country_label", value: row.rawCountryName }]
      : [],
  };
  const evidenceRights: PulseEvidenceRightsSnapshot = {
    schemaVersion: PULSE_EVIDENCE_SCHEMA_VERSION,
    sourceId: row.sourceId,
    licenseId: rights.licenseId,
    termsUrl: rights.termsUrl,
    reviewStatus: rights.reviewStatus,
    reviewedAt: rights.reviewedAt,
    publicExport: rights.publicExport,
    redistributionPosture: spec.redistributionPosture,
    restrictions: [...rights.restrictions],
  };
  const evidenceRetention: PulseEvidenceRetentionSnapshot = {
    schemaVersion: PULSE_EVIDENCE_SCHEMA_VERSION,
    captureMode: "full_internal_snapshot",
    storedFields: ["title", "body", "raw"],
    storageRelation: "raw_events",
    publicPayloadDistribution: "blocked",
    hashAlgorithm: PULSE_EVIDENCE_HASH_ALGORITHM,
    linkRotProtection: "stored_payload_plus_content_hash",
    policyReason:
      "The private research ledger retains the fetched evidence used by the pipeline; public payload redistribution remains blocked and is not inferred from access.",
  };
  const identityPayload = {
    schemaVersion: PULSE_EVIDENCE_SCHEMA_VERSION,
    retrievedAt: retrievedAt.toISOString(),
    evidenceContentHash,
    evidenceLanguage: evidenceLanguage(row.raw),
    evidencePublisher,
    evidenceAttribution,
    evidenceRights,
    evidenceRetention,
  };
  return {
    evidenceIdentityKey: `pulse-evidence/sha256:${pulseEvidenceSha256(identityPayload)}`,
    evidenceContentHash,
    evidenceLanguage: identityPayload.evidenceLanguage,
    evidencePublisher,
    evidenceAttribution,
    evidenceRights,
    evidenceRetention,
  };
}
