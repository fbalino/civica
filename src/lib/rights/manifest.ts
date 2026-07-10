/** DAT-003 machine-readable source, product, field, and release rights. */

import { SOURCE_INPUT_SPECS } from "../data/source-input-manifest";

export const RIGHTS_MANIFEST_VERSION = "rights-manifest/v1";
export const RIGHTS_MANIFEST_PATH = "/api/rights-manifest";
export const RIGHTS_MANIFEST_PAGE_PATH = "/licensing#rights-manifest";

export type RightsReviewStatus = "verified" | "pending";
export type PublicExportPermission =
  "allowed" | "non-commercial-only" | "blocked" | "pending-review";

export interface SourceRightsRecord {
  sourceId: string;
  licenseId: string;
  termsUrl: string;
  reviewStatus: RightsReviewStatus;
  reviewedAt: string | null;
  publicExport: PublicExportPermission;
  commercialUse: boolean | null;
  derivatives: boolean | null;
  attributionRequired: boolean | null;
  shareAlikeRequired: boolean;
  restrictions: readonly string[];
}

const VERIFIED_AT = "2026-07-10";

const verified = (
  sourceId: string,
  licenseId: string,
  termsUrl: string,
  publicExport: PublicExportPermission,
  commercialUse: boolean,
  derivatives: boolean,
  attributionRequired: boolean,
  restrictions: readonly string[] = [],
): SourceRightsRecord => ({
  sourceId,
  licenseId,
  termsUrl,
  reviewStatus: "verified",
  reviewedAt: VERIFIED_AT,
  publicExport,
  commercialUse,
  derivatives,
  attributionRequired,
  shareAlikeRequired: licenseId.includes("SA"),
  restrictions,
});

const VERIFIED_SOURCE_RIGHTS: Readonly<Record<string, SourceRightsRecord>> = {
  cia_factbook: verified(
    "cia_factbook",
    "US-PUBLIC-DOMAIN",
    "https://www.cia.gov/site-policies/",
    "allowed",
    true,
    true,
    true,
    [
      "Credit CIA as the source",
      "Do not imply CIA endorsement",
      "CIA marks and seal remain restricted",
    ],
  ),
  cia_world_leaders: verified(
    "cia_world_leaders",
    "US-PUBLIC-DOMAIN",
    "https://www.cia.gov/site-policies/",
    "allowed",
    true,
    true,
    true,
    [
      "Credit CIA as the source",
      "Do not imply CIA endorsement",
      "CIA marks and seal remain restricted",
    ],
  ),
  wikidata: verified(
    "wikidata",
    "CC0-1.0",
    "https://www.wikidata.org/wiki/Wikidata:Licensing",
    "allowed",
    true,
    true,
    false,
  ),
  world_bank: verified(
    "world_bank",
    "CC-BY-4.0",
    "https://datacatalog.worldbank.org/public-licenses",
    "allowed",
    true,
    true,
    true,
    [
      "Dataset-specific catalog terms override the default license",
      "Indicate changes",
      "Do not imply World Bank endorsement",
    ],
  ),
  worldbank_economic: verified(
    "worldbank_economic",
    "CC-BY-4.0",
    "https://datacatalog.worldbank.org/public-licenses",
    "allowed",
    true,
    true,
    true,
    [
      "Dataset-specific catalog terms override the default license",
      "Indicate changes",
      "Do not imply World Bank endorsement",
    ],
  ),
  worldbank_wgi: verified(
    "worldbank_wgi",
    "CC-BY-4.0",
    "https://datacatalog.worldbank.org/public-licenses",
    "allowed",
    true,
    true,
    true,
    [
      "Dataset-specific catalog terms override the default license",
      "Indicate changes",
      "Do not imply World Bank endorsement",
    ],
  ),
};

function pendingRecord(
  sourceId: string,
  canonicalUrl: string,
  posture: string,
): SourceRightsRecord {
  const publicExport: PublicExportPermission =
    posture === "non-commercial"
      ? "non-commercial-only"
      : posture === "restricted-no-redistribution"
        ? "blocked"
        : "pending-review";
  return {
    sourceId,
    licenseId: `PUBLISHER-TERMS-PENDING:${posture}`,
    termsUrl: canonicalUrl,
    reviewStatus: "pending",
    reviewedAt: null,
    publicExport,
    commercialUse: posture === "non-commercial" ? false : null,
    derivatives: null,
    attributionRequired: null,
    shareAlikeRequired: false,
    restrictions: [
      "Source-specific terms have not completed DAT-003 verification",
      "Bulk export remains blocked until the terms record is verified",
    ],
  };
}

export const SOURCE_RIGHTS: readonly SourceRightsRecord[] =
  SOURCE_INPUT_SPECS.map(
    (source) =>
      VERIFIED_SOURCE_RIGHTS[source.sourceId] ??
      pendingRecord(
        source.sourceId,
        source.canonicalUrl,
        source.redistributionPosture,
      ),
  ).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

export function sourceRights(sourceId: string): SourceRightsRecord | undefined {
  return SOURCE_RIGHTS.find((record) => record.sourceId === sourceId);
}

export interface ProductFieldRights {
  fieldPattern: string;
  lineage: "source-row" | "civica-derived" | "mixed-unresolved";
  exportRule: "source-permission" | "blocked";
}

export interface ProductRightsRecord {
  productId: string;
  routeOrArtifact: string;
  publicBulkExport: "allowed" | "blocked";
  fields: readonly ProductFieldRights[];
  reason: string;
}

export const PRODUCT_RIGHTS: readonly ProductRightsRecord[] = [
  {
    productId: "country-export-json-csv",
    routeOrArtifact: "/api/countries/{slug}/export?format=json|csv",
    publicBulkExport: "blocked",
    fields: [
      {
        fieldPattern: "facts[]",
        lineage: "source-row",
        exportRule: "source-permission",
      },
      {
        fieldPattern: "provenance.*",
        lineage: "source-row",
        exportRule: "source-permission",
      },
      {
        fieldPattern: "flat headline fields",
        lineage: "mixed-unresolved",
        exportRule: "blocked",
      },
      {
        fieldPattern: "government/index fields",
        lineage: "civica-derived",
        exportRule: "blocked",
      },
    ],
    reason:
      "The current mixed-source export cannot prove an allowed terms record for every emitted row and flat fallback field. DAT-017/DAT-027 will replace it with rights-filtered canonical-plus-alternates exports.",
  },
  {
    productId: "index-bulk-release",
    routeOrArtifact: "future frozen Civica Index data package",
    publicBulkExport: "blocked",
    fields: [
      {
        fieldPattern: "dimension inputs",
        lineage: "source-row",
        exportRule: "source-permission",
      },
      {
        fieldPattern: "composite scores",
        lineage: "civica-derived",
        exportRule: "blocked",
      },
    ],
    reason:
      "No standalone license has been selected for Civica-derived Index outputs, and two current inputs remain pending source-specific rights review.",
  },
] as const;

export interface ReleaseArtifactRights {
  releaseId: string;
  artifactPath: string;
  artifactKind: "metadata-only" | "data";
  includedSources: readonly string[];
  excludedSourcePayloads: readonly string[];
  publicDistribution: "allowed" | "blocked";
  governingTerms: string;
}

export const RELEASE_ARTIFACT_RIGHTS: readonly ReleaseArtifactRights[] = [
  {
    releaseId: "ci-beta-2024-Q4",
    artifactPath: "data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json",
    artifactKind: "metadata-only",
    includedSources: [
      "freedom_house",
      "transparency_intl",
      "vdem",
      "worldbank_wgi",
    ],
    excludedSourcePayloads: [
      "freedom_house",
      "transparency_intl",
      "vdem",
      "worldbank_wgi",
    ],
    publicDistribution: "allowed",
    governingTerms:
      "The artifact contains Civica-authored provenance metadata and hashes only. It excludes all publisher files and observation rows.",
  },
] as const;

export interface ExportRightsDecision {
  allowed: boolean;
  productId: string;
  blockedSources: readonly string[];
  reason: string;
}

export function evaluatePublicExport(
  productId: string,
  sourceIds: readonly string[],
): ExportRightsDecision {
  const product = PRODUCT_RIGHTS.find(
    (record) => record.productId === productId,
  );
  if (!product) {
    return {
      allowed: false,
      productId,
      blockedSources: [...new Set(sourceIds)].sort(),
      reason: "Product has no rights manifest entry.",
    };
  }
  const blockedSources = [...new Set(sourceIds)]
    .filter((sourceId) => sourceRights(sourceId)?.publicExport !== "allowed")
    .sort();
  if (product.publicBulkExport !== "allowed") {
    return {
      allowed: false,
      productId,
      blockedSources,
      reason: product.reason,
    };
  }
  if (blockedSources.length > 0) {
    return {
      allowed: false,
      productId,
      blockedSources,
      reason: "One or more source terms do not permit this public export.",
    };
  }
  return { allowed: true, productId, blockedSources: [], reason: "Allowed." };
}

export function buildRightsManifest() {
  return {
    schemaVersion: RIGHTS_MANIFEST_VERSION,
    generatedFrom: "checked-in-rights-contract" as const,
    sources: SOURCE_RIGHTS,
    products: PRODUCT_RIGHTS,
    releaseArtifacts: RELEASE_ARTIFACT_RIGHTS,
  };
}
