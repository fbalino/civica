import { createHash } from "node:crypto";
import sourceManifest from "../../../data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json";
import releaseCoverage from "../ci/production-release-coverage.generated.json";
import { sourceRights } from "../rights/manifest";
import type { CapturedSourceInput } from "./source-input-manifest";

export const RAW_RETENTION_MANIFEST_VERSION = "raw-input-retention/v1" as const;

export interface RawRetentionRecord {
  captureId: string;
  pipelineId: string;
  sourceId: string;
  retentionMode: "compliant-hash-and-reacquisition-record";
  publisherPayloadIncluded: false;
  contentSha256: string;
  retrievedAt: string;
  accessUrl: string;
  upstreamVersion: string;
  upstreamVintage: string;
  format: string;
  adapterVersion: string;
  redistributionPosture: string;
  rights: {
    licenseId: string;
    reviewStatus: "verified" | "pending";
    publicExport: string;
    termsUrl: string;
  };
  reconstruction: {
    instruction: string;
    byteVerification: string;
    mismatchPolicy: string;
  };
}

export interface ReleasedValueGroup {
  groupId: string;
  table: "ci_dimension_scores";
  releaseSelector: {
    releaseId: string;
    datasetYear: number;
    methodologyVersion: string;
  };
  sourceId: string;
  dimension: string;
  indicator: string;
  expectedRows: number;
  semanticSha256: string;
  rawCaptureId: string;
}

export interface RawRetentionManifest {
  schemaVersion: typeof RAW_RETENTION_MANIFEST_VERSION;
  releaseId: string;
  releaseStatus: "frozen-metadata-release";
  generatedFrom: string[];
  payloadPolicy: string;
  captures: RawRetentionRecord[];
  releasedValueGroups: ReleasedValueGroup[];
  compositeLineage: {
    table: "ci_composite_scores";
    releaseSelector: ReleasedValueGroup["releaseSelector"];
    dependsOnGroupIds: string[];
    reconstructionRule: string;
  };
  manifestSha256: string;
}

const captureId = (releaseId: string, capture: CapturedSourceInput) =>
  `${releaseId}:${capture.pipelineId}:${capture.sourceId}`;

function manifestHash(value: Omit<RawRetentionManifest, "manifestSha256">): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildRawRetentionManifest(): RawRetentionManifest {
  const releaseId = sourceManifest.releaseId;
  const captures = (sourceManifest.inputs as CapturedSourceInput[])
    .map((capture): RawRetentionRecord => {
      const rights = sourceRights(capture.sourceId);
      if (!rights) throw new Error(`missing rights record for ${capture.sourceId}`);
      return {
        captureId: captureId(releaseId, capture),
        pipelineId: capture.pipelineId,
        sourceId: capture.sourceId,
        retentionMode: "compliant-hash-and-reacquisition-record",
        publisherPayloadIncluded: false,
        contentSha256: capture.contentSha256,
        retrievedAt: capture.retrievedAt,
        accessUrl: capture.accessUrl,
        upstreamVersion: capture.upstreamVersion,
        upstreamVintage: capture.upstreamVintage,
        format: capture.format,
        adapterVersion: capture.adapterVersion,
        redistributionPosture: capture.redistributionPosture,
        rights: {
          licenseId: rights.licenseId,
          reviewStatus: rights.reviewStatus,
          publicExport: rights.publicExport,
          termsUrl: rights.termsUrl,
        },
        reconstruction: {
          instruction: `Reacquire the named ${capture.upstreamVersion} from the publisher access URL under the publisher's current access terms, then verify the exact bytes before running the recorded adapter.`,
          byteVerification: `SHA-256 must equal ${capture.contentSha256}.`,
          mismatchPolicy: "Stop. A different hash is a different input and cannot reproduce this release.",
        },
      };
    })
    .sort((a, b) => a.captureId.localeCompare(b.captureId));

  const captureBySource = new Map(captures.map((capture) => [capture.sourceId, capture]));
  const releasedValueGroups = Object.entries(releaseCoverage.groups)
    .map(([groupId, group]): ReleasedValueGroup => {
      const capture = captureBySource.get(group.sourceId);
      if (!capture) throw new Error(`release group ${groupId} has no raw capture record`);
      return {
        groupId,
        table: "ci_dimension_scores",
        releaseSelector: {
          releaseId: releaseCoverage.releaseId,
          datasetYear: releaseCoverage.datasetYear,
          methodologyVersion: releaseCoverage.methodologyVersion,
        },
        sourceId: group.sourceId,
        dimension: group.dimension,
        indicator: group.indicator,
        expectedRows: group.expectedRows,
        semanticSha256: group.semanticSha256,
        rawCaptureId: capture.captureId,
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId));

  const withoutHash: Omit<RawRetentionManifest, "manifestSha256"> = {
    schemaVersion: RAW_RETENTION_MANIFEST_VERSION,
    releaseId,
    releaseStatus: "frozen-metadata-release",
    generatedFrom: [
      "data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json",
      "src/lib/ci/production-release-coverage.generated.json",
      "src/lib/rights/manifest.ts",
    ],
    payloadPolicy: "Publisher payload bytes are not distributed in this repository. Exact SHA-256 hashes, retrieval metadata, rights posture, and fail-closed reacquisition instructions are retained instead.",
    captures,
    releasedValueGroups,
    compositeLineage: {
      table: "ci_composite_scores",
      releaseSelector: {
        releaseId: releaseCoverage.releaseId,
        datasetYear: releaseCoverage.datasetYear,
        methodologyVersion: releaseCoverage.methodologyVersion,
      },
      dependsOnGroupIds: releasedValueGroups.map((group) => group.groupId),
      reconstructionRule: "Rebuild every declared dimension group from byte-verified inputs, verify each semantic checksum and row count, then run the release's recorded composite methodology and derivation-version envelope.",
    },
  };
  return { ...withoutHash, manifestSha256: manifestHash(withoutHash) };
}

export function rawRetentionErrors(manifest: RawRetentionManifest): string[] {
  const errors: string[] = [];
  const { manifestSha256, ...withoutHash } = manifest;
  if (manifest.schemaVersion !== RAW_RETENTION_MANIFEST_VERSION) errors.push("wrong schema version");
  if (manifestHash(withoutHash) !== manifestSha256) errors.push("manifest hash does not match content");
  const captureIds = new Set<string>();
  for (const capture of manifest.captures) {
    if (captureIds.has(capture.captureId)) errors.push(`duplicate capture ${capture.captureId}`);
    captureIds.add(capture.captureId);
    if (!/^[a-f0-9]{64}$/.test(capture.contentSha256)) errors.push(`${capture.captureId} has invalid byte hash`);
    if (!/^sha256:[a-f0-9]{64}$/.test(capture.adapterVersion)) errors.push(`${capture.captureId} has invalid adapter version`);
    if (Number.isNaN(Date.parse(capture.retrievedAt))) errors.push(`${capture.captureId} has invalid retrieval time`);
    if (!capture.accessUrl.startsWith("https://")) errors.push(`${capture.captureId} has a non-HTTPS access URL`);
    if (capture.publisherPayloadIncluded) errors.push(`${capture.captureId} cannot include publisher payload bytes under this manifest`);
    if (!capture.reconstruction.byteVerification.includes(capture.contentSha256)) errors.push(`${capture.captureId} reconstruction does not bind the byte hash`);
    if (!/stop/i.test(capture.reconstruction.mismatchPolicy)) errors.push(`${capture.captureId} does not fail closed on byte mismatch`);
  }
  const groupIds = new Set<string>();
  for (const group of manifest.releasedValueGroups) {
    if (groupIds.has(group.groupId)) errors.push(`duplicate released group ${group.groupId}`);
    groupIds.add(group.groupId);
    if (!captureIds.has(group.rawCaptureId)) errors.push(`${group.groupId} references a missing raw capture`);
    if (!/^[a-f0-9]{64}$/.test(group.semanticSha256)) errors.push(`${group.groupId} has invalid semantic hash`);
    if (!Number.isSafeInteger(group.expectedRows) || group.expectedRows <= 0) errors.push(`${group.groupId} has invalid expected row count`);
  }
  for (const groupId of manifest.compositeLineage.dependsOnGroupIds) {
    if (!groupIds.has(groupId)) errors.push(`composite lineage references missing group ${groupId}`);
  }
  return errors;
}

export function canonicalRawRetentionJson(manifest: RawRetentionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
