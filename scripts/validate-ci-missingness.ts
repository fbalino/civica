import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  assessCiCompleteness,
  CURRENT_CI_MISSINGNESS_POLICY,
} from "../src/lib/ci/missingness-policy";
import { CURRENT_CI_METHODOLOGY_VERSION } from "../src/lib/ci/current-release";

const methodology = readFileSync("content/methodology-civica-index.md", "utf8");
const calculator = readFileSync("src/lib/ci/calculate-v2.ts", "utf8");
const legacyCalculator = readFileSync("src/lib/ci/calculate.ts", "utf8");
const api = readFileSync("src/lib/api/helpers.ts", "utf8");
const countryUi = readFileSync("src/components/ci/CIPulseScoreDisplay.tsx", "utf8");

assert.equal(
  CURRENT_CI_MISSINGNESS_POLICY.methodologyVersion,
  CURRENT_CI_METHODOLOGY_VERSION,
);
assert.equal(
  assessCiCompleteness(new Set(["democratic_quality", "rule_of_law"]))
    .completeness,
  "insufficient",
);
assert.match(methodology, /Publication threshold/);
assert.match(methodology, /exactly one optional dimension/);
assert.match(methodology, /should not be compared with full estimates as if coverage were equal/);
assert.match(calculator, /assessCiCompleteness\(present\)/);
assert.match(api, /minimum_dimensions_for_publication/);
assert.match(countryUi, /Not directly comparable with full estimates/);
assert.match(legacyCalculator, /LEGACY_CI_METHODOLOGY_VERSION = "v1\.0"/);
assert.match(legacyCalculator, /use calculate:ci:v2 for current Index releases/);

async function validateLive(): Promise<void> {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT
      j.iso3,
      c.completeness_flag AS "completenessFlag",
      c.is_partial AS "isPartial",
      c.dimensions_available AS "dimensionsAvailable",
      c.missing_dimensions AS "missingDimensions",
      array_agg(DISTINCT d.dimension ORDER BY d.dimension)
        FILTER (WHERE d.dimension IS NOT NULL) AS dimensions
    FROM ci_composite_scores c
    JOIN jurisdictions j ON j.id = c.jurisdiction_id
    LEFT JOIN ci_dimension_scores d
      ON d.jurisdiction_id = c.jurisdiction_id
      AND d.quarter = c.quarter
      AND d.methodology_version = c.methodology_version
    WHERE c.methodology_version = ${CURRENT_CI_METHODOLOGY_VERSION}
    GROUP BY c.jurisdiction_id, j.iso3, c.completeness_flag, c.is_partial,
      c.dimensions_available, c.missing_dimensions
    ORDER BY j.iso3
  `;
  const errors: string[] = [];
  for (const row of rows) {
    const assessment = assessCiCompleteness(new Set(row.dimensions as string[]));
    if (assessment.completeness === "insufficient") errors.push(`${row.iso3}: published despite insufficient coverage`);
    if (row.completenessFlag !== assessment.completeness) errors.push(`${row.iso3}: completeness flag drift`);
    if (row.isPartial !== (assessment.completeness === "partial")) errors.push(`${row.iso3}: partial boolean drift`);
    if (row.dimensionsAvailable !== assessment.present.length) errors.push(`${row.iso3}: available-count drift`);
    if (JSON.stringify(row.missingDimensions ?? []) !== JSON.stringify(assessment.missing)) errors.push(`${row.iso3}: missing-list drift`);
  }
  assert.deepEqual(errors, []);
  const partial = rows.filter((row) => row.isPartial).length;
  console.log(`PASS — ${rows.length} live ${CURRENT_CI_METHODOLOGY_VERSION} composites conform (${partial} partial; zero insufficient rows published).`);
}

if (process.argv.includes("--live")) {
  validateLive().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  console.log(`PASS — ${CURRENT_CI_MISSINGNESS_POLICY.id} agrees across calculation, methodology, API, UI, and sealed legacy code.`);
}
