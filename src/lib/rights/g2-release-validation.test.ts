import assert from "node:assert/strict";
import test from "node:test";

import type {
  ProductRightsRecord,
  ReleaseArtifactRights,
  SourceRightsRecord,
} from "./manifest";
import {
  validateG2ReleaseRights,
  type ReleaseRightsManifestLike,
} from "./g2-release-validation";

const sourceIds = ["cia_factbook", "wikidata", "world_bank"] as const;

function source(sourceId: string): SourceRightsRecord {
  return {
    sourceId,
    licenseId: "TEST-OPEN",
    termsUrl: `https://example.test/${sourceId}`,
    reviewStatus: "verified",
    reviewedAt: "2026-07-10",
    publicExport: "allowed",
    commercialUse: true,
    derivatives: true,
    attributionRequired: true,
    shareAlikeRequired: false,
    restrictions: [],
  };
}

const product: ProductRightsRecord = {
  productId: "atlas-reference-export-v1",
  routeOrArtifact: "/downloads/civica-atlas-2026-07-11.json.gz",
  publicBulkExport: "allowed",
  fields: [
    {
      fieldPattern: "tables.facts[]",
      lineage: "source-row",
      exportRule: "source-permission",
    },
  ],
  reason: "Released sources remain governed by their embedded terms.",
  requiresDerivationVersions: true,
};

const release = {
  releaseId: "atlas-2026-07-11",
  artifactPath: "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
  artifactKind: "data",
  includedSources: [...sourceIds],
  excludedSourcePayloads: ["all raw publisher payloads"],
  publicDistribution: "allowed",
  governingTerms: "Source-specific terms remain controlling.",
  derivationVersions: { sourceIds: [...sourceIds] },
} as unknown as ReleaseArtifactRights;

function manifest(
  extraSources: readonly SourceRightsRecord[] = [],
): ReleaseRightsManifestLike {
  return {
    schemaVersion: "rights-manifest/v1",
    generatedFrom: "checked-in-rights-contract",
    sources: [...sourceIds.map(source), ...extraSources],
    products: [structuredClone(product)],
    releaseArtifacts: [structuredClone(release)],
  };
}

function fixture() {
  const bundledManifest = manifest([
    {
      ...source("un_data"),
      termsUrl: "https://old.example.test/un-data",
      reviewStatus: "pending",
      reviewedAt: null,
      publicExport: "pending-review",
      commercialUse: null,
      derivatives: null,
      attributionRequired: null,
    },
  ]);
  const bundledInputs: Array<{
    sourceId: string;
    rights: SourceRightsRecord;
  }> = sourceIds.map((sourceId) => ({
    sourceId,
    rights: structuredClone(
      bundledManifest.sources.find((record) => record.sourceId === sourceId)!,
    ),
  }));
  return {
    releaseId: release.releaseId,
    productId: product.productId,
    bomSourceIds: [...sourceIds],
    bundledManifest,
    bundledInputs,
    currentManifest: manifest([
      {
        ...source("un_data"),
        termsUrl: "https://new.example.test/un-data.csv.gz",
        reviewStatus: "pending",
        reviewedAt: null,
        publicExport: "pending-review",
        commercialUse: null,
        derivatives: null,
        attributionRequired: null,
      },
    ]),
  };
}

test("G2 release rights ignore unrelated source metadata drift", () => {
  assert.deepEqual(validateG2ReleaseRights(fixture()), []);
});

test("G2 release rights reject a current permission change for a released source", () => {
  const input = fixture();
  const current = input.currentManifest.sources.find(
    (record) => record.sourceId === "world_bank",
  )!;
  input.currentManifest.sources = input.currentManifest.sources.map((record) =>
    record.sourceId === current.sourceId
      ? { ...record, publicExport: "blocked" }
      : record,
  );
  assert.ok(
    validateG2ReleaseRights(input).some((problem) =>
      problem.includes("current rights differ from bundled rights for world_bank"),
    ),
  );
});

test("G2 release rights reject an embedded frozen-input mismatch", () => {
  const input = fixture();
  input.bundledInputs[0].rights = {
    ...input.bundledInputs[0].rights,
    termsUrl: "https://wrong.example.test/cia",
  };
  assert.ok(
    validateG2ReleaseRights(input).some((problem) =>
      problem.includes("frozen input rights differ from bundled rights for cia_factbook"),
    ),
  );
});

test("G2 release rights reject missing or extra source IDs", async (t) => {
  await t.test("missing", () => {
    const input = fixture();
    input.bundledInputs = input.bundledInputs.slice(1);
    assert.ok(
      validateG2ReleaseRights(input).some((problem) =>
        problem.includes("source input rights inventory differs from BOM source IDs"),
      ),
    );
  });
  await t.test("extra", () => {
    const input = fixture();
    input.bundledInputs.push({ sourceId: "un_data", rights: source("un_data") });
    assert.ok(
      validateG2ReleaseRights(input).some((problem) =>
        problem.includes("source input rights inventory differs from BOM source IDs"),
      ),
    );
  });
});

test("G2 release rights reject Atlas product or release-policy drift", async (t) => {
  await t.test("product", () => {
    const input = fixture();
    input.currentManifest.products = [
      { ...input.currentManifest.products[0], publicBulkExport: "blocked" },
    ];
    assert.ok(
      validateG2ReleaseRights(input).some((problem) =>
        problem.includes("current Atlas product rights differ from bundled rights"),
      ),
    );
  });
  await t.test("release", () => {
    const input = fixture();
    input.currentManifest.releaseArtifacts = [
      {
        ...input.currentManifest.releaseArtifacts[0],
        publicDistribution: "blocked",
      },
    ];
    assert.ok(
      validateG2ReleaseRights(input).some((problem) =>
        problem.includes("current Atlas release rights differ from bundled rights"),
      ),
    );
  });
});
