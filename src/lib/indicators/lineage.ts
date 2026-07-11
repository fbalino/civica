import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";
import { sourceRights } from "@/lib/rights/manifest";

export const INDICATOR_LINEAGE_VERSION = "indicator-source-lineage/v1";

export interface IndicatorLineage {
  indicatorId: string;
  upstreamRelease: string;
  artifactHash: string;
  artifactKind: "publisher_bytes" | "normalized_batch";
  temporalCoverage: string;
  licenseUrl: string;
  transformationId: string;
  substitutionReason: string | null;
  methodVersion: string;
}

const INDICATORS: Readonly<Record<string, string>> = {
  "vdem:democratic_quality": "v2x_libdem",
  "worldbank_wgi:democratic_quality": "va.est",
  "worldbank_wgi:rule_of_law": "rl.est",
  "freedom_house:freedom_rights": "fh_pr_cl_sum",
  "transparency_intl:corruption_control": "CPI_SCORE",
  "global_peace_index:stability_security": "GPI_SCORE",
  "global_peace_index:peace_security": "GPI_SCORE",
  "undp_hdi:human_development": "hdi",
  "worldbank_economic:economic_stability": "FP.CPI.TOTL.ZG+SL.UEM.TOTL.ZS+NY.GDP.MKTP.KD.ZG",
};

const FROZEN_2024_HASHES: Readonly<Record<string, string>> = {
  vdem: "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b",
  worldbank_wgi: "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8",
  freedom_house: "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88",
  transparency_intl: "34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736",
};

export function indicatorIdFor(sourceId: string, dimension: string): string {
  const indicatorId = INDICATORS[`${sourceId}:${dimension}`];
  if (!indicatorId) throw new Error(`No indicator identity for ${sourceId}/${dimension}`);
  return indicatorId;
}

export function normalizedBatchHash(rows: readonly unknown[]): string {
  return createHash("sha256").update(stableStringify([...rows])).digest("hex");
}

export function buildIndicatorLineage(input: {
  sourceId: string;
  dimension: string;
  upstreamRelease: string;
  temporalCoverage: string;
  transformationId: string;
  methodVersion: string;
  rows: readonly unknown[];
  indicatorId?: string;
  substitutionReason?: string | null;
  publisherArtifactHash?: string | null;
}): IndicatorLineage {
  const rights = sourceRights(input.sourceId);
  if (!rights) throw new Error(`No rights record for indicator source ${input.sourceId}`);
  const publisherArtifactHash = input.publisherArtifactHash ?? null;
  return {
    indicatorId: input.indicatorId ?? indicatorIdFor(input.sourceId, input.dimension),
    upstreamRelease: input.upstreamRelease,
    artifactHash: publisherArtifactHash ?? normalizedBatchHash(input.rows),
    artifactKind: publisherArtifactHash ? "publisher_bytes" : "normalized_batch",
    temporalCoverage: input.temporalCoverage,
    licenseUrl: rights.termsUrl,
    transformationId: input.transformationId,
    substitutionReason: input.substitutionReason ?? null,
    methodVersion: input.methodVersion,
  };
}

export function frozenCiPublisherHash(sourceId: string, datasetYear: number): string | null {
  return datasetYear === 2024 ? FROZEN_2024_HASHES[sourceId] ?? null : null;
}

export function indicatorLineageErrors(lineage: IndicatorLineage): string[] {
  const errors: string[] = [];
  for (const field of ["indicatorId", "upstreamRelease", "temporalCoverage", "transformationId", "methodVersion"] as const) {
    if (!lineage[field].trim()) errors.push(`${field} is blank`);
  }
  if (!/^[a-f0-9]{64}$/.test(lineage.artifactHash)) errors.push("artifactHash is not SHA-256");
  if (!lineage.licenseUrl.startsWith("https://")) errors.push("licenseUrl is not HTTPS");
  if (!lineage.artifactKind || !["publisher_bytes", "normalized_batch"].includes(lineage.artifactKind)) errors.push("artifactKind is invalid");
  return errors;
}
