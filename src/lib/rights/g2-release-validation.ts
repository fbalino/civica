import { isDeepStrictEqual } from "node:util";

import type {
  ProductRightsRecord,
  ReleaseArtifactRights,
  SourceRightsRecord,
} from "./manifest";

export interface ReleaseRightsManifestLike {
  schemaVersion: string;
  generatedFrom: string;
  sources: readonly SourceRightsRecord[];
  products: readonly ProductRightsRecord[];
  releaseArtifacts: readonly ReleaseArtifactRights[];
}

export interface FrozenReleaseInputRights {
  sourceId: string;
  rights: SourceRightsRecord;
}

export interface G2ReleaseRightsValidationInput {
  releaseId: string;
  productId: string;
  bomSourceIds: readonly string[];
  bundledManifest: ReleaseRightsManifestLike;
  bundledInputs: readonly FrozenReleaseInputRights[];
  currentManifest: ReleaseRightsManifestLike;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return isDeepStrictEqual(sorted(left), sorted(right));
}

function exactlyOne<T>(values: readonly T[]): T | null {
  return values.length === 1 ? values[0] : null;
}

/**
 * Validate the current permission boundary for one immutable G2 release.
 * Unrelated source/product records may evolve without rewriting history, while
 * every source and policy that actually governs this release stays fail-closed.
 */
export function validateG2ReleaseRights(
  input: G2ReleaseRightsValidationInput,
): string[] {
  const problems: string[] = [];
  const {
    releaseId,
    productId,
    bomSourceIds,
    bundledManifest,
    bundledInputs,
    currentManifest,
  } = input;

  if (bundledManifest.schemaVersion !== currentManifest.schemaVersion) {
    problems.push("current rights schema differs from bundled rights schema");
  }
  if (bundledManifest.generatedFrom !== currentManifest.generatedFrom) {
    problems.push("current rights provenance differs from bundled rights provenance");
  }

  const inputSourceIds = bundledInputs.map((record) => record.sourceId);
  if (!sameIds(bomSourceIds, inputSourceIds)) {
    problems.push("source input rights inventory differs from BOM source IDs");
  }

  for (const sourceId of bomSourceIds) {
    const bundledSource = exactlyOne(
      bundledManifest.sources.filter((record) => record.sourceId === sourceId),
    );
    const frozenInput = exactlyOne(
      bundledInputs.filter((record) => record.sourceId === sourceId),
    );
    const currentSource = exactlyOne(
      currentManifest.sources.filter((record) => record.sourceId === sourceId),
    );

    if (!bundledSource) {
      problems.push(
        `bundled rights manifest must contain exactly one record for ${sourceId}`,
      );
      continue;
    }
    if (!frozenInput) {
      problems.push(`frozen inputs must contain exactly one record for ${sourceId}`);
    } else {
      if (
        frozenInput.rights.sourceId !== sourceId ||
        !isDeepStrictEqual(frozenInput.rights, bundledSource)
      ) {
        problems.push(
          `frozen input rights differ from bundled rights for ${sourceId}`,
        );
      }
    }
    if (
      bundledSource.reviewStatus !== "verified" ||
      bundledSource.publicExport !== "allowed"
    ) {
      problems.push(`${sourceId} is not verified for public export`);
    }
    if (!currentSource) {
      problems.push(
        `current rights manifest must contain exactly one record for ${sourceId}`,
      );
    } else if (!isDeepStrictEqual(currentSource, bundledSource)) {
      problems.push(`current rights differ from bundled rights for ${sourceId}`);
    }
  }

  const bundledProduct = exactlyOne(
    bundledManifest.products.filter((record) => record.productId === productId),
  );
  const currentProduct = exactlyOne(
    currentManifest.products.filter((record) => record.productId === productId),
  );
  if (!bundledProduct) {
    problems.push("bundled Atlas product rights record is missing or duplicated");
  } else {
    if (bundledProduct.publicBulkExport !== "allowed") {
      problems.push("bundled Atlas product does not permit public bulk export");
    }
    if (!currentProduct) {
      problems.push("current Atlas product rights record is missing or duplicated");
    } else if (!isDeepStrictEqual(currentProduct, bundledProduct)) {
      problems.push("current Atlas product rights differ from bundled rights");
    }
  }

  const bundledRelease = exactlyOne(
    bundledManifest.releaseArtifacts.filter(
      (record) =>
        record.releaseId === releaseId && record.artifactKind === "data",
    ),
  );
  const currentRelease = exactlyOne(
    currentManifest.releaseArtifacts.filter(
      (record) =>
        record.releaseId === releaseId && record.artifactKind === "data",
    ),
  );
  if (!bundledRelease) {
    problems.push("bundled Atlas release rights record is missing or duplicated");
  } else {
    if (bundledRelease.publicDistribution !== "allowed") {
      problems.push("bundled Atlas release does not permit public distribution");
    }
    if (!sameIds(bundledRelease.includedSources, bomSourceIds)) {
      problems.push("bundled Atlas release sources differ from BOM source IDs");
    }
    const derivationSourceIds = (
      bundledRelease.derivationVersions as { sourceIds?: readonly string[] }
    ).sourceIds;
    if (!derivationSourceIds || !sameIds(derivationSourceIds, bomSourceIds)) {
      problems.push(
        "bundled Atlas release derivation sources differ from BOM source IDs",
      );
    }
    if (!currentRelease) {
      problems.push("current Atlas release rights record is missing or duplicated");
    } else if (!isDeepStrictEqual(currentRelease, bundledRelease)) {
      problems.push("current Atlas release rights differ from bundled rights");
    }
  }

  return problems;
}
