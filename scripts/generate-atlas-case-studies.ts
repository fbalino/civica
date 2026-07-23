import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  ATLAS_CASE_STUDIES_PATH,
  buildAtlasCaseStudyReport,
  renderAtlasCaseStudyReport,
} from "../src/lib/atlas/case-studies";
import { loadAtlasQueryRelease } from "../src/lib/exports/atlas-query";

async function main() {
  const report = buildAtlasCaseStudyReport(await loadAtlasQueryRelease());
  mkdirSync(dirname(ATLAS_CASE_STUDIES_PATH), { recursive: true });
  writeFileSync(ATLAS_CASE_STUDIES_PATH, renderAtlasCaseStudyReport(report));
  console.log(
    `Wrote ${ATLAS_CASE_STUDIES_PATH} (${report.cases.length} case studies, ${report.semanticSha256})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
