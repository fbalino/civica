import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import {
  ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION,
  ATLAS_EXPORT_RELEASE_ID,
  ATLAS_EXPORT_VINTAGE_LABEL,
  atlasExportFactRowSha256,
  parseAtlasReleaseRegenerationInputs,
  type AtlasLegacyFactMetadata,
  type AtlasReleaseRegenerationInputs,
} from "../src/lib/exports/atlas-release";

const releaseDirectory = resolve("data/releases", ATLAS_EXPORT_RELEASE_ID);
const artifactPath = resolve(releaseDirectory, "atlas-export.v1.json.gz");
const outputPath = resolve(releaseDirectory, "regeneration-inputs.v1.json.gz");

const artifactBytes = readFileSync(artifactPath);
const release = JSON.parse(gunzipSync(artifactBytes).toString("utf8")) as {
  releaseId: string;
  vintageLabel: string;
  tables: {
    jurisdictions: Record<string, unknown>[];
    facts: Record<string, unknown>[];
  };
};
if (release.releaseId !== ATLAS_EXPORT_RELEASE_ID || release.vintageLabel !== ATLAS_EXPORT_VINTAGE_LABEL) {
  throw new Error("Checked Atlas artifact does not match the configured frozen release");
}

const factMetadataBySnapshotId: Record<string, AtlasLegacyFactMetadata> = {};
for (const fact of release.tables.facts) {
  const snapshotId = String(fact.id);
  if (!snapshotId || factMetadataBySnapshotId[snapshotId]) {
    throw new Error(`Checked Atlas artifact has an invalid or duplicate fact id: ${snapshotId}`);
  }
  factMetadataBySnapshotId[snapshotId] = {
    factGroup: fact.fact_group as AtlasLegacyFactMetadata["factGroup"],
    category: fact.category as AtlasLegacyFactMetadata["category"],
    sourceUrl: fact.source_url as AtlasLegacyFactMetadata["sourceUrl"],
    valueStatus: fact.value_status as AtlasLegacyFactMetadata["valueStatus"],
    valueStatusReason: fact.value_status_reason as AtlasLegacyFactMetadata["valueStatusReason"],
    valueType: fact.value_type as AtlasLegacyFactMetadata["valueType"],
    growthMethodology: fact.growth_methodology as AtlasLegacyFactMetadata["growthMethodology"],
    publicRowSha256: atlasExportFactRowSha256(fact),
  };
}

const inputs: AtlasReleaseRegenerationInputs = {
  schemaVersion: ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION,
  releaseId: ATLAS_EXPORT_RELEASE_ID,
  vintageLabel: ATLAS_EXPORT_VINTAGE_LABEL,
  sourceArtifactFileSha256: createHash("sha256").update(artifactBytes).digest("hex"),
  jurisdictions: release.tables.jurisdictions,
  factMetadataBySnapshotId,
};
parseAtlasReleaseRegenerationInputs(inputs);
const serialized = `${JSON.stringify(inputs, null, 2)}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(outputPath, gzipSync(serialized, { level: 9 }));
  console.log(`Wrote ${outputPath}`);
} else {
  if (!existsSync(outputPath)) {
    throw new Error(`Missing ${outputPath}; regenerate with --write`);
  }
  const checked = gunzipSync(readFileSync(outputPath)).toString("utf8");
  if (checked !== serialized) {
    throw new Error("Checked Atlas regeneration inputs differ from the immutable artifact");
  }
  console.log("PASS — Atlas regeneration inputs match the immutable artifact.");
}
