/** DAT-003 DB/network/clock-free source/product/release rights gate. */

import { existsSync, readFileSync } from "node:fs";

import { SOURCE_INPUT_SPECS } from "../src/lib/data/source-input-manifest";
import {
  PRODUCT_RIGHTS,
  RELEASE_ARTIFACT_RIGHTS,
  SOURCE_RIGHTS,
  buildRightsManifest,
  evaluatePublicExport,
} from "../src/lib/rights/manifest";

const problems: string[] = [];
const sourceIds = SOURCE_INPUT_SPECS.map((record) => record.sourceId).sort();
const rightsIds = SOURCE_RIGHTS.map((record) => record.sourceId).sort();
if (JSON.stringify(sourceIds) !== JSON.stringify(rightsIds)) {
  problems.push("source rights do not exactly close the production source set");
}
for (const source of SOURCE_RIGHTS) {
  if (!source.termsUrl.startsWith("https://")) {
    problems.push(`${source.sourceId}: terms URL is not HTTPS`);
  }
  if (source.publicExport === "allowed" && source.reviewStatus !== "verified") {
    problems.push(`${source.sourceId}: pending source permits public export`);
  }
  if (source.reviewStatus === "verified" && !source.reviewedAt) {
    problems.push(`${source.sourceId}: verified source has no review date`);
  }
}
for (const product of PRODUCT_RIGHTS) {
  if (product.fields.length === 0)
    problems.push(`${product.productId}: no field rights`);
}
for (const artifact of RELEASE_ARTIFACT_RIGHTS) {
  if (!existsSync(artifact.artifactPath)) {
    problems.push(`${artifact.releaseId}: artifact path is missing`);
  }
  if (
    artifact.artifactKind === "metadata-only" &&
    artifact.excludedSourcePayloads.length === 0
  ) {
    problems.push(
      `${artifact.releaseId}: metadata artifact names no excluded payloads`,
    );
  }
}

const exportRoutePath = "src/app/api/countries/[slug]/export/route.ts";
const exportRoute = readFileSync(exportRoutePath, "utf8");
if (
  !/evaluatePublicExport\(\s*["']country-export-json-csv["']/.test(exportRoute)
) {
  problems.push("country export route does not call the rights gate");
}
if (!exportRoute.includes("buildCountryResearchExport"))
  problems.push(
    "country export does not use the DAT-027 research export builder",
  );
if (!exportRoute.includes("countryResearchExportCsv"))
  problems.push("country export JSON/CSV implementations are not shared");
if (!evaluatePublicExport("country-export-json-csv", ["wikidata"]).allowed)
  problems.push("country export unexpectedly blocks a verified source");
if (evaluatePublicExport("country-export-json-csv", ["vdem"]).allowed)
  problems.push("country export unexpectedly permits a pending source");

const machineRoute = readFileSync(
  "src/app/api/rights-manifest/route.ts",
  "utf8",
);
if (!machineRoute.includes("buildRightsManifest()")) {
  problems.push(
    "machine-readable rights route does not render the canonical manifest",
  );
}
const manifest = buildRightsManifest();

console.log("=== DAT-003 rights-manifest validation ===\n");
console.log(`Source records: ${manifest.sources.length}`);
console.log(
  `Verified sources: ${manifest.sources.filter((row) => row.reviewStatus === "verified").length}`,
);
console.log(
  `Pending/blocked sources: ${manifest.sources.filter((row) => row.reviewStatus !== "verified").length}`,
);
console.log(`Product records: ${manifest.products.length}`);
console.log(`Release artifacts: ${manifest.releaseArtifacts.length}`);

if (problems.length > 0) {
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(`\nFAILED — ${problems.length} rights-manifest problem(s).`);
  process.exitCode = 1;
} else {
  console.log(
    "\nPASS — source, field, product, and release rights fail closed.",
  );
}
