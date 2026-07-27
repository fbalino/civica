import { parseAtlasVintageLabel } from "@/lib/data/frozen-vintage";
import {
  ATLAS_EXPORT_RELEASE_ID,
  ATLAS_EXPORT_VINTAGE_LABEL,
} from "@/lib/exports/atlas-release";
import {
  CURRENT_CI_RELEASE_ID,
  CURRENT_CI_METHODOLOGY_VERSION,
} from "@/lib/ci/current-release";
import {
  ciReleaseContractErrors,
  resolveCiRelease,
} from "@/lib/ci/release-selection";
import { CURRENT_PULSE_RUNTIME_METHOD } from "@/lib/pulse/v2/runtime-contract";

export const RELEASE_CONSISTENCY_SCHEMA_VERSION =
  "civica-release-consistency/v1" as const;

export type PublicationMode =
  | "frozen-atlas-release"
  | "closed-research-release"
  | "versioned-live-ledger";

export interface ReleaseFamilyPolicy {
  family: "atlas" | "index" | "pulse";
  publicationMode: PublicationMode;
  releaseId: string | null;
  methodologyVersions: readonly string[];
  allowsMixedMethodologyVersions: false;
  sourceVersionBinding:
    | "snapshot-row-plus-input-manifest"
    | "source-indicator-artifact-hash"
    | "immutable-run-identity";
  guardModules: readonly string[];
  note: string;
}

const atlasIdentity = parseAtlasVintageLabel(ATLAS_EXPORT_VINTAGE_LABEL);
const currentIndexRelease = resolveCiRelease(CURRENT_CI_RELEASE_ID);

/**
 * A named release is valid only through its domain authority. Live Atlas
 * request responses are not silently promoted into releases, and Pulse is a
 * versioned ledger rather than an Atlas-style frozen package.
 */
export const RELEASE_FAMILY_POLICIES: readonly ReleaseFamilyPolicy[] =
  Object.freeze([
    {
      family: "atlas",
      publicationMode: "frozen-atlas-release",
      releaseId: ATLAS_EXPORT_RELEASE_ID,
      methodologyVersions: [atlasIdentity.methodologyVersion],
      allowsMixedMethodologyVersions: false,
      sourceVersionBinding: "snapshot-row-plus-input-manifest",
      guardModules: [
        "src/lib/exports/atlas-release.ts",
        "src/lib/data/source-input-manifest.ts",
        "scripts/generate-atlas-release-regeneration-inputs.ts",
        "scripts/validate-atlas-export.ts",
        "scripts/validate-atlas-g2-rc.ts",
      ],
      note: "One immutable snapshot cutoff and vintage; source inputs and normalized rows remain separately identified.",
    },
    {
      family: "index",
      publicationMode: "closed-research-release",
      releaseId: currentIndexRelease.releaseId,
      methodologyVersions: [currentIndexRelease.methodologyVersion],
      allowsMixedMethodologyVersions: false,
      sourceVersionBinding: "source-indicator-artifact-hash",
      guardModules: [
        "src/lib/ci/release-selection.ts",
        "src/lib/ci/release-publication.ts",
        "src/lib/ci/release-store.ts",
        "scripts/publish-ci-release.ts",
        "scripts/validate-ci-current-release.ts",
        "scripts/validate-ci-release-selection.ts",
      ],
      note: "Every public score/dimension query resolves one registered release coordinate and exact source artifact rules.",
    },
    {
      family: "pulse",
      publicationMode: "versioned-live-ledger",
      releaseId: null,
      methodologyVersions: [CURRENT_PULSE_RUNTIME_METHOD.version],
      allowsMixedMethodologyVersions: false,
      sourceVersionBinding: "immutable-run-identity",
      guardModules: [
        "src/lib/pulse/v2/runtime-contract.ts",
        "src/lib/pulse/v2/publication-consistency.ts",
        "src/lib/pulse/v2/versioning.ts",
        "src/lib/db/queries-pulse-v2.ts",
        "src/lib/pulse/v2/score.ts",
        "scripts/validate-pulse-runtime-method.ts",
        "scripts/validate-pulse-version-lineage.ts",
      ],
      note: "Pulse publishes immutable event/run identities under the runtime method; it does not claim a frozen Atlas release.",
    },
  ]);

export interface ReleaseBundleCoordinate {
  family: ReleaseFamilyPolicy["family"];
  releaseId: string | null;
  methodologyVersion: string;
  sourceVersion: string;
}

/** Pure negative-fixture seam used by PLT-014 integration tests. */
export function releaseBundleErrors(
  policy: ReleaseFamilyPolicy,
  coordinates: readonly ReleaseBundleCoordinate[],
): string[] {
  const errors: string[] = [];
  if (coordinates.length === 0) return ["release bundle is empty"];
  for (const [index, coordinate] of coordinates.entries()) {
    const label = `${policy.family}[${index}]`;
    if (coordinate.family !== policy.family) {
      errors.push(`${label}: family mismatch`);
    }
    if (coordinate.releaseId !== policy.releaseId) {
      errors.push(`${label}: release id mismatch`);
    }
    if (!policy.methodologyVersions.includes(coordinate.methodologyVersion)) {
      errors.push(`${label}: methodology version mismatch`);
    }
    if (!coordinate.sourceVersion.trim()) {
      errors.push(`${label}: source version is required`);
    }
  }
  const methods = new Set(
    coordinates.map((coordinate) => coordinate.methodologyVersion),
  );
  if (!policy.allowsMixedMethodologyVersions && methods.size !== 1) {
    errors.push(`${policy.family}: mixed methodology versions`);
  }
  return errors;
}

export function releaseFamilyPolicyErrors(
  policies: readonly ReleaseFamilyPolicy[] = RELEASE_FAMILY_POLICIES,
): string[] {
  const errors: string[] = [];
  const families = new Set<string>();
  for (const policy of policies) {
    if (families.has(policy.family)) {
      errors.push(`${policy.family}: duplicate release-family policy`);
    }
    families.add(policy.family);
    if (policy.methodologyVersions.length !== 1) {
      errors.push(`${policy.family}: current public policy must bind one method`);
    }
    if (
      policy.publicationMode !== "versioned-live-ledger" &&
      !policy.releaseId
    ) {
      errors.push(`${policy.family}: named release lacks release id`);
    }
    if (
      policy.publicationMode === "versioned-live-ledger" &&
      policy.releaseId
    ) {
      errors.push(`${policy.family}: live ledger must not claim a release id`);
    }
    if (policy.guardModules.length === 0) {
      errors.push(`${policy.family}: no guard modules`);
    }
  }
  for (const family of ["atlas", "index", "pulse"] as const) {
    if (!families.has(family)) errors.push(`${family}: missing release policy`);
  }

  errors.push(...ciReleaseContractErrors().map((error) => `index: ${error}`));
  if (currentIndexRelease.releaseId !== CURRENT_CI_RELEASE_ID) {
    errors.push("index: current release id drift");
  }
  if (
    currentIndexRelease.methodologyVersion !== CURRENT_CI_METHODOLOGY_VERSION
  ) {
    errors.push("index: current methodology drift");
  }
  if (CURRENT_PULSE_RUNTIME_METHOD.mixed_legacy_unversioned) {
    errors.push("pulse: current rows may not be unversioned");
  }
  if (!/^atlas-\d{4}-\d{2}-\d{2}$/.test(ATLAS_EXPORT_RELEASE_ID)) {
    errors.push("atlas: release URL identity is not date-versioned");
  }
  return errors;
}
