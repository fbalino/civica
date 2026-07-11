import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import manifest from "../data/releases/ci-research-panel-2000-2024-v1/manifest.v1.json";
import coverageArtifact from "../data/releases/ci-research-panel-2000-2024-v1/coverage.v1.json";
import breaksArtifact from "../data/releases/ci-research-panel-2000-2024-v1/temporal-breaks.v1.json";
import {
  CI_RESEARCH_PANEL_END_YEAR,
  CI_RESEARCH_PANEL_GENERATOR_VERSION,
  CI_RESEARCH_PANEL_INDICATORS,
  CI_RESEARCH_PANEL_RELEASE_ID,
  CI_RESEARCH_PANEL_RIGHTS_POSTURE,
  CI_RESEARCH_PANEL_START_YEAR,
  CI_RESEARCH_PANEL_TEMPORAL_BREAKS,
  researchPanelHash,
} from "../src/lib/ci/research-panel";

const releaseNote = readFileSync("data/releases/ci-research-panel-2000-2024-v1/README.md", "utf8");

assert.equal(manifest.releaseId, CI_RESEARCH_PANEL_RELEASE_ID);
assert.equal(manifest.period.start, CI_RESEARCH_PANEL_START_YEAR);
assert.equal(manifest.period.end, CI_RESEARCH_PANEL_END_YEAR);
assert.equal(manifest.scope.indicators, CI_RESEARCH_PANEL_INDICATORS.length);
assert.equal(manifest.scope.expectedRows, manifest.scope.jurisdictions * manifest.scope.indicators * 25);
assert.equal(manifest.scope.expectedRows, manifest.scope.observedRows + manifest.scope.missingRows);
assert.equal(manifest.generatorVersion, CI_RESEARCH_PANEL_GENERATOR_VERSION);
assert.equal(manifest.rightsPosture, CI_RESEARCH_PANEL_RIGHTS_POSTURE);
assert.equal(manifest.publicBulkValuesIncluded, false);
assert.equal(manifest.valuesLocation, "private_neon_ci_research_panel_rows");
assert.match(manifest.rowSha256, /^[a-f0-9]{64}$/);
assert.equal(researchPanelHash(coverageArtifact.coverage), manifest.coverageSha256);
assert.equal(researchPanelHash(breaksArtifact.breaks), manifest.temporalBreaksSha256);
assert.deepEqual(breaksArtifact.breaks, CI_RESEARCH_PANEL_TEMPORAL_BREAKS);
assert.equal(coverageArtifact.coverage.length, CI_RESEARCH_PANEL_INDICATORS.length);
assert.doesNotMatch(JSON.stringify(manifest), /"value"\s*:/);
assert.doesNotMatch(JSON.stringify(coverageArtifact), /"value"\s*:/);
for (const reason of ["outside_comparable_series", "outside_captured_release", "source_not_published_for_period", "source_no_observation_for_jurisdiction_period"]) {
  assert.match(releaseNote, new RegExp(reason));
}
assert.match(releaseNote, /does not carry values forward/);
assert.match(releaseNote, /current_harmonized_backcast_not_as_published/);

async function validateLive() {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [release] = await sql`SELECT * FROM ci_research_panel_releases WHERE id=${CI_RESEARCH_PANEL_RELEASE_ID}`;
  assert.equal(release.status, "complete");
  assert.equal(Number(release.expected_rows), manifest.scope.expectedRows);
  assert.equal(release.row_sha256, manifest.rowSha256);
  assert.equal(release.coverage_sha256, manifest.coverageSha256);
  assert.equal(release.temporal_breaks_sha256, manifest.temporalBreaksSha256);
  const dbRows = await sql`
    SELECT release_id AS "releaseId",jurisdiction_id::text AS "jurisdictionId",period_year AS "periodYear",
      dimension,indicator_id AS "indicatorId",source_id AS "sourceId",source_owner AS "sourceOwner",
      retrieval_path AS "retrievalPath",value,value_status AS "valueStatus",missing_reason AS "missingReason",
      native_unit AS "nativeUnit",native_min AS "nativeMin",native_max AS "nativeMax",is_inverted AS "isInverted",
      transform_id AS "transformId",source_vintage AS "sourceVintage",source_vintage_status AS "sourceVintageStatus",
      artifact_hash AS "artifactHash",uncertainty_status AS "uncertaintyStatus",
      uncertainty_lower AS "uncertaintyLower",uncertainty_upper AS "uncertaintyUpper",
      revision_status AS "revisionStatus",series_type AS "seriesType",content_hash AS "contentHash"
    FROM ci_research_panel_rows WHERE release_id=${CI_RESEARCH_PANEL_RELEASE_ID}
    ORDER BY source_id,indicator_id,period_year,jurisdiction_id
  ` as Array<Record<string, unknown>>;
  assert.equal(dbRows.length, manifest.scope.expectedRows);
  for (const row of dbRows) {
    const { contentHash, ...core } = row;
    assert.equal(contentHash, researchPanelHash(core));
  }
  assert.equal(researchPanelHash(dbRows), manifest.rowSha256);
  let mutationRejected = false;
  try {
    await sql`UPDATE ci_research_panel_rows SET value=value WHERE release_id=${CI_RESEARCH_PANEL_RELEASE_ID} AND period_year=${CI_RESEARCH_PANEL_START_YEAR}`;
  } catch (error) {
    mutationRejected = /immutable/.test(String(error));
  }
  assert.equal(mutationRejected, true, "completed panel mutation must be rejected by trigger");
  console.log(`PASS — ${dbRows.length} private frozen rows reproduce ${manifest.rowSha256}; completed release mutation is rejected.`);
}

if (process.argv.includes("--live")) {
  validateLive().catch((error) => { console.error(error); process.exit(1); });
} else {
  console.log(`PASS — ${manifest.releaseId} manifest, coverage, temporal breaks, rights posture, and hashes close without public values.`);
}
