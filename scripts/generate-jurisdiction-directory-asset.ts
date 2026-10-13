import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import type { JurisdictionDirectoryArtifact } from "../src/lib/jurisdictions/directory";
import {
  JURISDICTION_DIRECTORY_ASSET_DIR,
  buildJurisdictionDirectoryAsset,
  jurisdictionDirectoryAssetPath,
  renderJurisdictionDirectoryAssetModule,
  serializeJurisdictionDirectoryAsset,
} from "../src/lib/jurisdictions/directory-asset";

// Database-free: derives the public asset and its URL module from the checked
// artifact. Content-identical reruns write identical bytes.
const ARTIFACT = resolve(
  process.cwd(),
  "src/lib/jurisdictions/directory.generated.json",
);
const MODULE = resolve(
  process.cwd(),
  "src/lib/jurisdictions/directory-asset.generated.ts",
);
const DIR = resolve(process.cwd(), JURISDICTION_DIRECTORY_ASSET_DIR);

const artifact = JSON.parse(
  readFileSync(ARTIFACT, "utf8"),
) as JurisdictionDirectoryArtifact;
const path = jurisdictionDirectoryAssetPath(artifact.rowsSha256);
const fileName = path.split("/").pop()!;

mkdirSync(DIR, { recursive: true });
// Superseded hashed assets are kept, not removed: a page loaded before a
// deployment still holds the old URL and fetches it on first search focus.
// The directory changes a few times a year and each file is ~33 KB.
writeFileSync(
  resolve(DIR, fileName),
  serializeJurisdictionDirectoryAsset(buildJurisdictionDirectoryAsset(artifact)),
);
writeFileSync(MODULE, renderJurisdictionDirectoryAssetModule(path));
console.log(`Wrote ${path} (${artifact.rows.length} rows) and its URL module.`);
