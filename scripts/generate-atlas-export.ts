import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import {
  ATLAS_EXPORT_RELEASE_ID,
  atlasExportSha256,
  buildAtlasExport,
  loadAtlasExportInput,
  serializeAtlasExport,
} from "../src/lib/exports/atlas-release";

config({ path: ".env.local", override: true });

async function main() {
  const release = buildAtlasExport(await loadAtlasExportInput());
  const serialized = serializeAtlasExport(release);
  const sha256 = atlasExportSha256(serialized);
  const releaseDir = resolve("data/releases", ATLAS_EXPORT_RELEASE_ID);
  mkdirSync(releaseDir, { recursive: true });
  const compressed = gzipSync(serialized, { level: 9 });
  const compressedSha256 = createHash("sha256").update(compressed).digest("hex");
  const publicFile = `civica-${ATLAS_EXPORT_RELEASE_ID}.json.gz`;
  writeFileSync(
    resolve(releaseDir, "manifest.v1.json"),
    `${JSON.stringify({
      schemaVersion: "civica-atlas-export-manifest/v1",
      releaseId: ATLAS_EXPORT_RELEASE_ID,
      releaseDate: release.releaseDate,
      sha256,
      byteLength: Buffer.byteLength(serialized),
      compressedSha256,
      compressedByteLength: compressed.byteLength,
      counts: release.counts,
      encoding: "gzip",
      publicDownload: `/downloads/${publicFile}`,
    }, null, 2)}\n`,
  );
  writeFileSync(
    resolve(releaseDir, "atlas-export.v1.json.gz"),
    compressed,
  );
  console.log(
    `Wrote ${release.counts.jurisdictions} jurisdictions, ${release.counts.facts} facts, ` +
      `${release.counts.sources} sources; sha256 ${sha256}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
