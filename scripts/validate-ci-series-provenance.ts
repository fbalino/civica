import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { config } from "dotenv";

import audit from "../data/releases/ci-series-provenance-audit-2026-07-v1/manifest.v1.json";
import { GOVERNANCE_EVIDENCE_SERIES } from "../src/lib/ci/governance-evidence";
import { CI_RELEASE_CONTRACTS } from "../src/lib/ci/release-selection";
import { CI_SERIES_TYPES, ciSeriesProvenanceErrors } from "../src/lib/ci/series-provenance";

assert.equal(audit.schemaVersion, "ci-series-provenance-audit/v1");
assert.deepEqual([...audit.availableSeriesTypes, ...audit.unavailableSeriesTypes].sort(), [...CI_SERIES_TYPES].sort());
assert.equal(audit.groups.length, 8);
assert.match(audit.legacyCalculationTimezone, /timestamp without time zone/);
assert.equal(audit.groups.reduce((sum, row) => sum + row.rows, 0), 1236);
assert.ok(audit.groups.every((row) => row.seriesType === "harmonized_backcast" && row.originalPublicationCutAt === null));
assert.ok(audit.groups.every((row) => Number(row.quarter.slice(0, 4)) < new Date(row.calculatedAtMin).getUTCFullYear()));
assert.match(audit.disposition, /No genuine historical as-published Civica Index release exists/);

for (const release of CI_RELEASE_CONTRACTS) assert.deepEqual(ciSeriesProvenanceErrors(release.series), []);
assert.deepEqual(ciSeriesProvenanceErrors(GOVERNANCE_EVIDENCE_SERIES), []);

const requiredTokens: Record<string, string[]> = {
  "src/lib/db/schema.ts": ["seriesType: text(\"series_type\")", "calculatedAt: timestamp(\"calculated_at\")"],
  "src/lib/api/contract/schemas.ts": ["zCiSeriesProvenance", "originalPublicationCutAt", "calculatedAt", "methodVersion"],
  "src/app/api/governance-evidence/[slug]/route.ts": ["series_type", "availableSeriesTypes"],
  "src/app/governance-evidence/page.tsx": ["citationLabel", "originalPublicationCutAt"],
  "src/lib/ci/governance-evidence.ts": ["availableSeriesTypes", "series: CiSeriesProvenance"],
  "content/methodology-civica-index.md": ["`series_type`", "calculated in 2026", "no genuine historical as-published Index series"],
};
for (const [path, tokens] of Object.entries(requiredTokens)) {
  const source = readFileSync(path, "utf8");
  for (const token of tokens) assert.ok(source.includes(token), `${path} is missing ${token}`);
}

async function validateLive() {
  config({ path: ".env.local", override: true });
  const { neon } = await import("@neondatabase/serverless");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT methodology_version, quarter, to_char(timezone('UTC', min(calculated_at) AT TIME ZONE 'America/Montevideo'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') min_calc, to_char(timezone('UTC', max(calculated_at) AT TIME ZONE 'America/Montevideo'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') max_calc, count(*)::int rows FROM ci_composite_scores GROUP BY methodology_version, quarter ORDER BY methodology_version, quarter`;
  const normalized = rows.map((row) => ({
    methodologyVersion: String(row.methodology_version),
    quarter: String(row.quarter),
    calculatedAtMin: String(row.min_calc),
    calculatedAtMax: String(row.max_calc),
    rows: Number(row.rows),
  }));
  assert.deepEqual(normalized, audit.groups.map(({ methodologyVersion, quarter, calculatedAtMin, calculatedAtMax, rows }) => ({ methodologyVersion, quarter, calculatedAtMin, calculatedAtMax, rows })));
}

async function main() {
  if (process.argv.includes("--live")) await validateLive();
  console.log(`PASS — ${audit.releaseId}: ${audit.groups.length} stored method/quarter groups are classified as harmonized backcasts; the historical as-published state remains explicit and empty.${process.argv.includes("--live") ? " Live calculation clocks match." : ""}`);
}

void main();
