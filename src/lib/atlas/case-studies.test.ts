import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ATLAS_CASE_STUDIES,
  ATLAS_CASE_STUDIES_PATH,
  atlasCaseStudyReportErrors,
  buildAtlasCaseStudyReport,
  renderAtlasCaseStudyReport,
  type AtlasCaseStudyReport,
} from "./case-studies";
import {
  loadAtlasQueryRelease,
  parseAtlasQueryArtifact,
} from "@/lib/exports/atlas-query";

test("three exact API recipes reproduce complete case-study inputs and tables", async () => {
  const report = buildAtlasCaseStudyReport(await loadAtlasQueryRelease());
  assert.equal(report.cases.length, 3);
  assert.deepEqual(
    report.cases.map(({ id }) => id),
    ATLAS_CASE_STUDIES.map(({ id }) => id),
  );
  assert.deepEqual(atlasCaseStudyReportErrors(report), []);
  assert.ok(
    report.cases.every((study) =>
      study.recipes.every(
        (recipe) =>
          recipe.path.startsWith("/api/v1/atlas/query?") &&
          recipe.inputRows.length === recipe.inputRowCount,
      ),
    ),
  );
});

test("checked case-study artifact is the byte-exact deterministic replay", async () => {
  const checked = JSON.parse(
    readFileSync(ATLAS_CASE_STUDIES_PATH, "utf8"),
  ) as AtlasCaseStudyReport;
  const regenerated = buildAtlasCaseStudyReport(await loadAtlasQueryRelease());
  assert.equal(
    renderAtlasCaseStudyReport(checked),
    renderAtlasCaseStudyReport(regenerated),
  );
});

test("a changed frozen input cannot retain the checked case-study result", () => {
  const artifact = readFileSync(
    "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
  );
  const manifest = readFileSync(
    "data/releases/atlas-2026-07-11/manifest.v1.json",
    "utf8",
  );
  const damaged = Buffer.from(artifact);
  damaged[damaged.length - 1] ^= 1;
  assert.throws(
    () => parseAtlasQueryArtifact(damaged, manifest),
    /compressed artifact hash mismatch/,
  );
});

test("semantic validation rejects an incomplete publication contract", async () => {
  const report = buildAtlasCaseStudyReport(await loadAtlasQueryRelease());
  const invalid = structuredClone(report);
  invalid.cases[0].limitations = [];
  assert.ok(
    atlasCaseStudyReportErrors(invalid).some((error) =>
      error.includes("publication contract is incomplete"),
    ),
  );
});
