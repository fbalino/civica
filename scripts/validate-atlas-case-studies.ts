import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  ATLAS_CASE_STUDIES_PATH,
  atlasCaseStudyReportErrors,
  buildAtlasCaseStudyReport,
  renderAtlasCaseStudyReport,
  type AtlasCaseStudyReport,
} from "../src/lib/atlas/case-studies";
import { loadAtlasQueryRelease } from "../src/lib/exports/atlas-query";

async function main() {
  const expected = buildAtlasCaseStudyReport(await loadAtlasQueryRelease());
  const checked = JSON.parse(
    readFileSync(ATLAS_CASE_STUDIES_PATH, "utf8"),
  ) as AtlasCaseStudyReport;
  const errors = atlasCaseStudyReportErrors(checked);

  assert.deepEqual(errors, []);
  assert.equal(
    renderAtlasCaseStudyReport(checked),
    renderAtlasCaseStudyReport(expected),
    "checked case-study inputs or tables drifted; run npm run generate:atlas-case-studies",
  );
  const pagePath =
    "src/app/(reader)/methodology/case-studies/page.tsx";
  const page = readFileSync(pagePath, "utf8");
  const apiDocs = readFileSync("src/app/api-docs/page.tsx", "utf8");
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  const nav = readFileSync("src/components/methodologyNavItems.ts", "utf8");
  const footer = readFileSync("src/components/SiteFooter.tsx", "utf8");
  assert.ok(existsSync(pagePath), "public case-study page is missing");
  assert.match(page, /ATLAS_CASE_STUDY_REPORT/);
  assert.match(page, /study\.decisionTrail/);
  assert.match(page, /study\.sourceRights/);
  assert.match(page, /study\.limitations/);
  assert.match(page, /study\.citation/);
  assert.match(apiDocs, /ATLAS_CASE_STUDY_REPORT/);
  assert.match(apiDocs, /recipe\.path/);
  for (const source of [sitemap, nav, footer]) {
    assert.match(source, /\/methodology\/case-studies/);
  }

  console.log(
    `PASS — ${checked.schemaVersion}: ${checked.cases.length} frozen case studies reproduce byte-exactly from ${checked.release.id}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
