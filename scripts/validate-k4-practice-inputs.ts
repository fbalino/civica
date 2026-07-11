import assert from "node:assert/strict";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { K4_PRACTICE_INPUT_CONTRACT, K4_PRACTICE_INDICATORS, K4_PRACTICE_TEMPORAL_BREAKS } from "../src/lib/ci/k4-practice-inputs";
import { K4_PRACTICE_PANEL_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";

config({ path: ".env.local" });
const live = process.argv.includes("--live");
const dir = `data/releases/${K4_PRACTICE_PANEL_RELEASE_ID}`;
const manifest = JSON.parse(readFileSync(`${dir}/manifest.v1.json`, "utf8"));
const coverage = JSON.parse(readFileSync(`${dir}/coverage.v1.json`, "utf8"));
const breaks = JSON.parse(readFileSync(`${dir}/temporal-breaks.v1.json`, "utf8"));

assert.equal(manifest.releaseId, K4_PRACTICE_PANEL_RELEASE_ID);
assert.equal(manifest.upstream.archiveSha256, K4_PRACTICE_INPUT_CONTRACT.upstream.archiveSha256);
assert.deepEqual(manifest.indicators, K4_PRACTICE_INDICATORS);
assert.deepEqual(breaks.breaks, K4_PRACTICE_TEMPORAL_BREAKS);
assert.equal(manifest.scope.expectedRows, 194 * 25 * 3);
assert.equal(manifest.scope.expectedRows, manifest.scope.observedRows + manifest.scope.missingRows);
assert.equal(researchPanelHash(coverage.coverage), manifest.coverageSha256);
assert.equal(researchPanelHash(breaks.breaks), manifest.temporalBreaksSha256);
assert.equal(manifest.rights.publicBulkValues, false);
assert.equal(manifest.missingness.imputation, "none");
assert.ok(manifest.scope.observedRows > 0);

async function validateLive() {
  if (!live) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [release] = await sql`SELECT status,expected_rows AS "expectedRows",observed_rows AS "observedRows",missing_rows AS "missingRows",row_sha256 AS "rowSha256" FROM ci_research_panel_releases WHERE id=${K4_PRACTICE_PANEL_RELEASE_ID}`;
  assert.equal(release.status, "complete");
  assert.equal(Number(release.expectedRows), manifest.scope.expectedRows);
  assert.equal(Number(release.observedRows), manifest.scope.observedRows);
  assert.equal(Number(release.missingRows), manifest.scope.missingRows);
  assert.equal(release.rowSha256, manifest.rowSha256);
  const [rows] = await sql`SELECT count(*)::int total,count(*) FILTER (WHERE value_status='observed' AND uncertainty_lower IS NOT NULL AND uncertainty_upper IS NOT NULL)::int bounded,count(*) FILTER (WHERE value_status='missing' AND value IS NULL AND missing_reason IS NOT NULL)::int explicit_missing FROM ci_research_panel_rows WHERE release_id=${K4_PRACTICE_PANEL_RELEASE_ID}`;
  assert.equal(Number(rows.total), manifest.scope.expectedRows);
  assert.equal(Number(rows.bounded), manifest.scope.observedRows);
  assert.equal(Number(rows.explicit_missing), manifest.scope.missingRows);
  let immutable = false;
  try { await sql`UPDATE ci_research_panel_rows SET value=value WHERE release_id=${K4_PRACTICE_PANEL_RELEASE_ID} AND period_year=2000`; } catch { immutable = true; }
  assert.equal(immutable, true, "completed release rows must be immutable");
}

validateLive().then(() => {
  console.log(`PASS — K4 practice release ${manifest.rowSha256} has ${manifest.scope.observedRows}/${manifest.scope.expectedRows} observed cells with publisher uncertainty.`);
}).catch((error) => { console.error(error); process.exit(1); });
