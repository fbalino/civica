import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { CURRENT_CI_METHODOLOGY_VERSION } from "../src/lib/ci/current-release";
import { CURRENT_CI_UNCERTAINTY_POLICY } from "../src/lib/ci/uncertainty-policy";

const calculator = readFileSync("src/lib/ci/calculate-v2.ts", "utf8");
const normalization = readFileSync("src/lib/ci/normalize-v2.ts", "utf8");
const methodology = readFileSync("content/methodology-civica-index.md", "utf8");
const api = readFileSync("src/lib/api/helpers.ts", "utf8");
const audit = JSON.parse(
  readFileSync("data/releases/ci-beta-r4-2024-Q4/uncertainty-audit.v1.json", "utf8"),
) as Record<string, unknown>;

assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.methodologyVersion, CURRENT_CI_METHODOLOGY_VERSION);
assert.equal(CURRENT_CI_UNCERTAINTY_POLICY.sources.length, 4);
assert.equal(audit.methodologyVersion, CURRENT_CI_METHODOLOGY_VERSION);
assert.equal(
  audit.usableReleasedUncertaintyRows,
  CURRENT_CI_UNCERTAINTY_POLICY.usableReleasedUncertaintyRows,
);
assert.equal(audit.displayedRange, CURRENT_CI_UNCERTAINTY_POLICY.displayedRange);
assert.deepEqual(audit.sourceAudit, CURRENT_CI_UNCERTAINTY_POLICY.sources.map((source) => ({
  sourceId: source.sourceId,
  upstreamUncertainty: source.upstreamUncertainty,
  retainedInRelease: source.retainedInCurrentRelease,
  reference: source.reference,
})));
assert.doesNotMatch(calculator, /simulateComposite|sampleNormal|defaultUncertainty/);
assert.doesNotMatch(normalization, /defaultUncertainty/);
assert.match(calculator, /scoreLower: null/);
assert.match(calculator, /scoreUpper: null/);
assert.match(methodology, /publishes \*\*no composite uncertainty or input-variation range\*\*/);
assert.match(methodology, /usable uncertainty coverage is/);
assert.match(methodology, /has not estimated a covariance model/);
assert.match(api, /displayed_range/);
assert.match(api, /input_variation_range: "not_published"/);

async function validateLive(): Promise<void> {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [result] = await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE score_lower IS NOT NULL)::int AS lower_count,
      count(*) FILTER (WHERE score_upper IS NOT NULL)::int AS upper_count,
      count(*) FILTER (
        WHERE derivation_versions->'algorithm'->>'id' <> 'ci-composite/fixed-bounds-weighted-v3'
      )::int AS wrong_algorithm
    FROM ci_composite_scores
    WHERE methodology_version = ${CURRENT_CI_METHODOLOGY_VERSION}
  `;
  assert.equal(result.total, 190);
  assert.equal(result.lower_count, 0);
  assert.equal(result.upper_count, 0);
  assert.equal(result.wrong_algorithm, 0);
  console.log(`PASS — ${result.total} live ${CURRENT_CI_METHODOLOGY_VERSION} composites use the deterministic algorithm and publish zero generic bounds.`);
}

if (process.argv.includes("--live")) {
  validateLive().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  console.log(`PASS — ${CURRENT_CI_UNCERTAINTY_POLICY.id} removes generic spreads, random scoring, and unsupported covariance claims.`);
}
