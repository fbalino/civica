import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import {
  ATLAS_EXPORT_RELEASE_ID,
  buildAtlasReleaseBom,
  buildAtlasExport,
  loadAtlasExportInput,
  serializeAtlasExport,
} from "../src/lib/exports/atlas-release";

config({ path: ".env.local", override: true });

async function main() {
  const release = buildAtlasExport(await loadAtlasExportInput());
  const serialized = serializeAtlasExport(release);
  const releaseDir = resolve("data/releases", ATLAS_EXPORT_RELEASE_ID);
  mkdirSync(releaseDir, { recursive: true });
  const compressed = gzipSync(serialized, { level: 9 });
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const bom = buildAtlasReleaseBom({
    release,
    serialized,
    compressed,
    codeCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    tools: {
      node: process.version,
      next: packageJson.dependencies.next,
      drizzleOrm: packageJson.dependencies["drizzle-orm"],
      typescript: packageJson.devDependencies.typescript,
      tsx: packageJson.devDependencies.tsx,
    },
  });
  writeFileSync(
    resolve(releaseDir, "manifest.v1.json"),
    `${JSON.stringify(bom, null, 2)}\n`,
  );
  writeFileSync(
    resolve(releaseDir, "atlas-export.v1.json.gz"),
    compressed,
  );
  console.log(
    `Wrote ${release.counts.jurisdictions} jurisdictions, ${release.counts.facts} facts, ` +
      `${release.counts.sources} sources; sha256 ${bom.files[0].semanticSha256}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
