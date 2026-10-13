import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import directory from "./directory.generated.json";
import type { JurisdictionDirectoryArtifact } from "./directory";
import {
  buildJurisdictionDirectoryAsset,
  jurisdictionDirectoryAssetPath,
  serializeJurisdictionDirectoryAsset,
} from "./directory-asset";
import { JURISDICTION_DIRECTORY_ASSET_PATH } from "./directory-asset.generated";

const artifact = directory as JurisdictionDirectoryArtifact;

test("the generated asset URL is addressed by the checked artifact hash", () => {
  assert.equal(
    JURISDICTION_DIRECTORY_ASSET_PATH,
    jurisdictionDirectoryAssetPath(artifact.rowsSha256),
  );
});

test("the public asset is the exact trimmed derivation of the checked artifact", () => {
  const bytes = readFileSync(
    resolve(process.cwd(), "public", JURISDICTION_DIRECTORY_ASSET_PATH.slice(1)),
    "utf8",
  );
  assert.equal(
    bytes,
    serializeJurisdictionDirectoryAsset(buildJurisdictionDirectoryAsset(artifact)),
  );
});

test("the asset carries only displayed fields and marks the sovereign universe", () => {
  const asset = buildJurisdictionDirectoryAsset(artifact);
  assert.equal(asset.rows.length, artifact.rowCount);
  assert.deepEqual(Object.keys(asset.rows[0]).sort(), [
    "capital",
    "iso2",
    "iso3",
    "name",
    "slug",
    "sovereign",
    "statusLabel",
  ]);
  assert.equal(
    asset.rows.filter((row) => row.sovereign).length,
    artifact.rows.filter((row) => row.statusType === "sovereign_state").length,
  );
});
